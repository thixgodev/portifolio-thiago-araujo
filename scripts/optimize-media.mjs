// Gera versões WebP responsivas de cada imagem em public/assets/ e um manifesto
// (src/generated/media.json) com dimensões e variantes. Os originais continuam
// em public/assets/ (vídeos e fallback); as variantes vão para public/_img/.
// Incremental: só reprocessa imagens cujo conteúdo mudou (hash), então as variantes
// ficam versionadas no git e o build da Vercel não precisa refazê-las.
import { readdir, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public/assets');
const OUT = path.join(ROOT, 'public/_img');
const MANIFEST = path.join(ROOT, 'src/generated/media.json');

const WIDTHS = [480, 800, 1200, 1600, 2400];
const LOGO_WIDTHS = [420, 840];
const QUALITY = 80;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(jpe?g|png|webp)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const prev = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
const manifest = {};
const files = await walk(SRC);
let done = 0, skipped = 0;

await Promise.all(files.map(async file => {
  const rel = '/' + path.relative(path.join(ROOT, 'public'), file).split(path.sep).join('/');
  const key = createHash('sha1').update(await readFile(file)).digest('hex').slice(0, 16);
  const old = prev[rel];
  if (old && old.key === key && old.variants.every(v => existsSync(path.join(ROOT, 'public', v.src)))) {
    manifest[rel] = old; skipped++; return;
  }
  const meta = await sharp(file).metadata();
  const isLogo = rel.startsWith('/assets/logos/') || rel === '/assets/favicon.png';
  const ladder = isLogo ? LOGO_WIDTHS : WIDTHS;
  const widths = ladder.filter(w => w < meta.width);
  widths.push(meta.width); // o tamanho original sempre entra: nenhum detalhe se perde em telas grandes
  const base = rel.replace(/^\/assets\//, '').replace(/\.[^.]+$/, '');
  const variants = [];
  for (const w of [...new Set(widths)]) {
    const src = `/_img/${base}-${w}.${key.slice(0, 8)}.webp`; // hash no nome: cache imutável seguro
    const dest = path.join(ROOT, 'public', src);
    await mkdir(path.dirname(dest), { recursive: true });
    await sharp(file).resize({ width: w, withoutEnlargement: true })
      .webp({ quality: isLogo ? 90 : QUALITY, alphaQuality: 100, effort: 5, smartSubsample: true })
      .toFile(dest);
    variants.push({ w, src });
  }
  manifest[rel] = { key, w: meta.width, h: meta.height, variants };
  done++;
}));

// Remove variantes que não pertencem mais a nenhuma imagem (arquivo trocado ou apagado).
const keep = new Set(Object.values(manifest).flatMap(e => e.variants.map(v => path.join(ROOT, 'public', v.src))));
let removed = 0;
if (existsSync(OUT)) for (const f of await walk(OUT)) if (!keep.has(f)) { await rm(f); removed++; }

await mkdir(path.dirname(MANIFEST), { recursive: true });
const sorted = Object.fromEntries(Object.keys(manifest).sort().map(k => [k, manifest[k]]));
await writeFile(MANIFEST, JSON.stringify(sorted, null, 1));
console.log(`media: ${done} processadas, ${skipped} em cache, ${removed} removidas, ${files.length} no total`);
