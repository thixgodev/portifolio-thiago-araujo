// Imagens responsivas: cada arquivo de public/assets/ tem variantes WebP em /_img/
// (geradas por scripts/optimize-media.mjs). O navegador escolhe a menor que cobre a tela.
import type { ImgHTMLAttributes } from 'react';
import manifest from './generated/media.json';

type Entry = { w: number; h: number; variants: { w: number; src: string }[] };
const M = manifest as unknown as Record<string, Entry>;

export const entry = (src?: string): Entry | undefined => (src ? M[src] : undefined);
export const ratioOf = (src?: string) => { const e = entry(src); return e ? e.w / e.h : 1; };

export function srcSet(src?: string) {
  const e = entry(src);
  return e ? e.variants.map(v => `${v.src} ${v.w}w`).join(', ') : undefined;
}

// Uma única URL (poster de vídeo, og:image): a menor variante com pelo menos `min` px de largura.
export function pick(src: string | undefined, min = 1600) {
  const e = entry(src);
  if (!e) return src || '';
  return (e.variants.find(v => v.w >= min) || e.variants[e.variants.length - 1]).src;
}

// `sizes` para object-fit: cover — a imagem precisa cobrir a largura E a altura da caixa.
export function coverSizes(src: string | undefined, boxW: string, boxH: string) {
  return `max(${boxW}, calc(${boxH} * ${ratioOf(src).toFixed(3)}))`;
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string; sizes: string };

export function Img({ src, sizes, ...rest }: Props) {
  const e = entry(src);
  if (!e) return <img src={src} {...rest} />;
  return <img srcSet={srcSet(src)} sizes={sizes} src={pick(src, 1200)} width={e.w} height={e.h} {...rest} />;
}
