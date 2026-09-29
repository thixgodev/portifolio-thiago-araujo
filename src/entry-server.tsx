// Usado só no build (scripts/prerender.mjs): gera o HTML estático de cada rota.
import { renderToString } from 'preact-render-to-string';
import Portfolio, { THEMES } from './Portfolio';
import { site, projects } from './data/projects';
import { pick } from './media';

export const render = (url: string) => renderToString(<Portfolio url={url} />);
export { site, projects, THEMES, pick };
