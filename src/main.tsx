import { hydrateRoot, createRoot } from 'preact/compat/client';
import '@fontsource/inter-tight/latin-300.css';
import '@fontsource/inter-tight/latin-400.css';
import '@fontsource/inter-tight/latin-500.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';
import './styles.css';
import Portfolio from './Portfolio';

const el = document.getElementById('app')!;
// No build, o HTML de cada rota já vem pré-renderizado: o React só "hidrata". No dev, renderiza do zero.
if (el.firstElementChild) hydrateRoot(el, <Portfolio />);
else createRoot(el).render(<Portfolio />);
