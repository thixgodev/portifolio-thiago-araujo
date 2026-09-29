// Pós-build: gera o HTML estático de cada rota (home + um por case), com título,
// descrição e Open Graph próprios, além de sitemap.xml e robots.txt.
// URL pública: SITE_URL (ex.: https://thiagoaraujo.com.br) ou o domínio de produção da Vercel.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SERVER = path.join(ROOT, 'dist-server/entry-server.js');

const { render, site, projects, THEMES } = await import(pathToFileURL(SERVER).href);
const template = await readFile(path.join(DIST, 'index.html'), 'utf8');

const SITE_URL = (process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '')).replace(/\/$/, '');
const abs = p => (SITE_URL ? SITE_URL + p : p);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HOME_DESC = 'Thiago Araujo é Diretor Criativo em São Paulo. Direção criativa, direção de arte, branding, campanhas e experiências digitais.';
const routes = [{
  url: '/', mode: 'brand',
  title: 'Thiago Araujo — Diretor Criativo em São Paulo',
  ogTitle: 'Thiago Araujo — Diretor Criativo',
  desc: HOME_DESC,
  ogDesc: 'Direção criativa, direção de arte, branding, campanhas e experiências digitais. São Paulo, Brasil.',
  image: '/assets/stayme/hero.jpg',
}];
const still = m => (m ? (m.mediaType === 'video' ? m.poster : m.src) : '');
for (const p of projects) {
  for (const mode of ['brand', 'digital']) {
    if (mode === 'digital' && !p.digital) continue;
    const src = mode === 'digital' ? { ...p, ...p.digital } : p;
    const kind = mode === 'digital' ? 'Produto digital' : 'Projeto';
    routes.push({
      url: (mode === 'digital' ? '/digital/' : '/projetos/') + p.slug, mode,
      title: `${src.title}${mode === 'digital' ? ' (digital)' : ''} — ${site.name}`,
      ogTitle: `${src.title} — ${site.name}`,
      desc: [src.tagline, src.category].filter(Boolean).join(' · ') || `${kind} de ${site.name}, ${site.role}.`,
      image: still(src.hero) || src.poster || src.cover,
      bg: (src.palette && src.palette.bg) || THEMES[mode].bg,
    });
  }
}

for (const r of routes) {
  const head = [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.desc)}">`,
    `<link rel="canonical" href="${esc(abs(r.url))}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:title" content="${esc(r.ogTitle)}">`,
    `<meta property="og:description" content="${esc(r.ogDesc || r.desc)}">`,
    `<meta property="og:url" content="${esc(abs(r.url))}">`,
    r.image ? `<meta property="og:image" content="${esc(abs(r.image))}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join('\n');
  const th = THEMES[r.mode];
  let html = template
    .replace(/<!--head-->[\s\S]*?<!--\/head-->/, head)
    .replace('<!--app-->', render(r.url))
    .replace('content="#050a10"', `content="${esc(th.bg)}"`);
  if (r.mode === 'digital') html = html.replace('<html lang="pt-BR">', `<html lang="pt-BR" data-mode="digital" style="background:${th.bg}">`);
  const out = r.url === '/' ? path.join(DIST, 'index.html') : path.join(DIST, r.url, 'index.html');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, html);
}

const today = new Date().toISOString().slice(0, 10);
await writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => `  <url><loc>${esc(abs(r.url))}</loc><lastmod>${today}</lastmod><priority>${r.url === '/' ? '1.0' : r.mode === 'digital' ? '0.7' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`);
await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ''}`);
await rm(path.join(ROOT, 'dist-server'), { recursive: true, force: true });
console.log(`prerender: ${routes.length} rotas${SITE_URL ? ' em ' + SITE_URL : ' (sem SITE_URL: links relativos)'}`);
