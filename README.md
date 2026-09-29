# Portfólio — Thiago Araujo

Site estático em **Vite + Preact + TypeScript**, hospedado na **Vercel**.

## Rodar localmente

```bash
npm install
npm run dev
```

## Adicionar ou editar um projeto

1. Coloque as imagens e vídeos em `public/assets/<slug>/`.
2. Edite `src/data/projects.ts` (os tipos de bloco estão documentados no próprio arquivo).
3. Rode `npm run media` para gerar as versões WebP das imagens novas e faça commit
   de `public/_img/` e `src/generated/media.json` junto (assim o deploy não precisa reprocessá-las).

## Como o build funciona

- `scripts/optimize-media.mjs`: gera variantes WebP responsivas (480–2400 px + tamanho original)
  de cada imagem, com hash no nome (cache imutável). Só reprocessa o que mudou.
- `vite build`: gera o JS/CSS do navegador em `dist/_app/`.
- `scripts/prerender.mjs`: gera o HTML de cada rota (`/`, `/projetos/<slug>`, `/digital/<slug>`)
  com título e Open Graph próprios, além de `sitemap.xml` e `robots.txt`.

URL pública usada no sitemap e no Open Graph: a variável `SITE_URL` (ex.: `https://thiagoaraujo.com.br`)
ou, sem ela, o domínio de produção que a Vercel informa no build.

## Rotas

`/projetos/<slug>` (Marcas) · `/digital/<slug>` (Produtos digitais) · `/#marcas` · `/#digital` · `/#sobre` · `/#clientes` · `/#contato`.
Links antigos no formato `#/projetos/<slug>` são redirecionados automaticamente.
