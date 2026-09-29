import { Component as ReactComponent, type CSSProperties } from 'react';
import { site, projects } from './data/projects';
import { Img, coverSizes, pick, ratioOf, srcSet } from './media';

// Ajustes finos da coreografia (antes eram "tweaks" do editor).
const P = {
  galleryMotion: 'cinematic' as 'cinematic' | 'minimal',
  snap: false,
  drumTilt: 60, // graus por altura de tela
  videoStart: 50, // % da duração em que o vídeo de capa começa
  titleBleed: 112, // largura do título da galeria, em vw
};

const U = {
  clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)),
  lerp: (a: number, b: number, u: number) => a + (b - a) * u,
  smooth: (x: number, a: number, b: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); },
  easeInOut: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  easeOut: (u: number) => 1 - Math.pow(1 - u, 3),
  expoOut: (u: number) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  pad: (n: number) => String(n).padStart(2, '0'),
};

// Dois modos de leitura: "brand" (Marcas, fundo preto) e "digital" (Produtos digitais, fundo claro).
export const THEMES: Record<string, Record<string, string>> = {
  brand: { bg: '#050a10', bgimg: 'radial-gradient(55% 45% at 12% 30%,rgba(22,128,214,.13),transparent 72%),radial-gradient(50% 40% at 88% 78%,rgba(22,128,214,.10),transparent 72%)', logo: 'none', ink: '#f4f3ef', ink2: '#dcdbd6', mute: '#8a8a86', panel: '#0b121b', line: 'rgba(244,243,239,.18)', line2: 'rgba(244,243,239,.14)', glow: 'drop-shadow(0 0 36px rgba(0,0,0,.7))' },
  digital: { bg: '#f4f3ef', bgimg: 'none', logo: 'brightness(0)', ink: '#0a0a0a', ink2: '#3d3d3a', mute: '#6b6b67', panel: '#e7e6e1', line: 'rgba(10,10,10,.18)', line2: 'rgba(10,10,10,.14)', glow: 'drop-shadow(0 0 36px rgba(0,0,0,.22))' },
};

// Rotas: /projetos/<slug> (Marcas) · /digital/<slug> (Produtos digitais) · /#marcas · /#digital · /#sobre · /#clientes · /#contato
export const hashFor = (mode: string, slug?: string | null) =>
  slug ? (mode === 'digital' ? '/digital/' : '/projetos/') + slug : (mode === 'digital' ? '/#digital' : '/#marcas');
const CASE_PATH = /^\/(projetos|digital)\/([\w-]+)\/?$/;
const CASE_HASH = /^#\/(projetos|digital)\/([\w-]+)/; // links antigos (#/projetos/<slug>)

export function routeFromPath(pathname: string) {
  const m = pathname.match(CASE_PATH);
  if (!m) return null;
  const mode = m[1] === 'digital' ? 'digital' : 'brand';
  const p = projects.find(x => x.slug === m[2]);
  return p && (mode === 'brand' || p.digital) ? { mode, slug: m[2] } : null;
}

// Medidas das caixas, para o navegador escolher a variante certa de cada imagem.
const CARD_W = 'min(84vw, 40vh)';
const NEXT_W = 'min(84vw, 52.8vh)';
const cardSizes = (src: string, w: string) => `calc(${w} * ${Math.max(1, 1.25 * ratioOf(src)).toFixed(3)})`;
const BLOCK_SIZES: Record<string, string> = {
  full: '100vw', wide: '100vw', small: 'min(100vw, max(280px, 36vw), 640px)', vertical: 'min(100vw, max(320px, 42vw))',
  pair: '(max-width: 800px) 100vw, 50vw', textMedia: 'min(100vw, 520px)',
};

type State = { route: { name: string; slug: string | null }; mode: string; entered: boolean; introPending: boolean; mobile: boolean; tr: any };

export default class Portfolio extends ReactComponent<{ url?: string }, State> {
  [k: string]: any;
  data = { site, projects };
  state: State;
  raf = 0; introStart = 0; homeScroll = 0; T = 1; vw = 1; vh = 1; boxH = 1; heroFs = 100; rows: Record<string, any> = {}; stack: HTMLElement[] = []; heroLines: HTMLElement[] = []; heroMeta: HTMLElement[] = []; settled = true; idleT: any = 0; busy = false;

  constructor(props: { url?: string }) {
    super(props);
    // Só o caminho decide o estado inicial (igual no HTML pré-renderizado e no navegador); o hash é lido depois de montar.
    const path = props.url ?? (typeof location !== 'undefined' ? location.pathname : '/');
    const r = routeFromPath(path);
    this.state = r
      ? { route: { name: 'case', slug: r.slug }, mode: r.mode, entered: true, introPending: true, mobile: false, tr: null }
      : { route: { name: 'home', slug: null }, mode: 'brand', entered: false, introPending: true, mobile: false, tr: null };
  }

  // ── lifecycle ──────────────────────────────────────────────
  componentDidMount() {
    this.root = document.querySelector('[data-portfolio-root]');
    this.mqMobile = matchMedia('(max-width: 767px)');
    this.mqRM = matchMedia('(prefers-reduced-motion: reduce)');
    this.canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (this.mqMobile.matches) this.setState({ mobile: true });
    this.onMQ = (e: MediaQueryListEvent) => this.setState({ mobile: e.matches });
    this.mqMobile.addEventListener('change', this.onMQ);
    this.onScroll = () => { this.settled = false; this.requestFrame(); clearTimeout(this.idleT); this.idleT = setTimeout(() => this.onIdle(), 150); };
    this.onResize = () => { this.measure(); this.fitTitles(); this.requestFrame(); };
    document.addEventListener('scroll', this.onScroll, { passive: true, capture: true });
    window.addEventListener('resize', this.onResize);
    this.onPop = () => this.applyHash(false);
    window.addEventListener('popstate', this.onPop);
    window.addEventListener('hashchange', this.onPop);
    this.onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && this.state.route.name === 'case') this.goHome(); };
    window.addEventListener('keydown', this.onKey);
    if (this.canHover) {
      this.onMove = (e: MouseEvent) => { if (this.cursorEl) this.cursorEl.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`; };
      window.addEventListener('mousemove', this.onMove, { passive: true });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this.fitTitles(); this.measure(); this.requestFrame(); });
    this._prev = this.state;
    this.applyTheme();
    this.collect();
    this.applyHash(true);
    this.startIntro();
  }
  componentWillUnmount() {
    this.mqMobile.removeEventListener('change', this.onMQ);
    document.removeEventListener('scroll', this.onScroll, { capture: true });
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('popstate', this.onPop);
    window.removeEventListener('hashchange', this.onPop);
    window.removeEventListener('keydown', this.onKey);
    if (this.onMove) window.removeEventListener('mousemove', this.onMove);
    if (this.io) this.io.disconnect();
    clearTimeout(this.idleT);
    cancelAnimationFrame(this.raf);
  }
  componentDidUpdate() {
    const prev = this._prev || {}; this._prev = this.state;
    this.applyTheme();
    if (prev.route !== this.state.route || prev.mode !== this.state.mode || prev.entered !== this.state.entered) {
      this.collect();
    } else if (prev.mobile !== this.state.mobile) {
      this.toggle = this.root && this.root.querySelector('[data-mode-toggle]'); this._toggleOn = undefined; this._hdrKey = undefined;
      this.measure(); this.fitTitles(); this.requestFrame();
    }
  }

  // ── theme ──────────────────────────────────────────────────
  // A landing (hero) é sempre preta; o tema do modo vale dentro da galeria e nos cases.
  themeMode() { return (this.state.entered || this.state.route.name === 'case') ? this.state.mode : 'brand'; }
  applyTheme() {
    const mode = this.themeMode();
    if (this._theme === mode && this._themeRoot === this.root) return;
    this._theme = mode; this._themeRoot = this.root;
    const th = THEMES[mode] || THEMES.brand;
    if (this.root) Object.keys(th).forEach(k => this.root.style.setProperty('--' + k, th[k]));
    document.documentElement.setAttribute('data-mode', mode);
    document.documentElement.style.background = document.body.style.background = th.bg;
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', th.bg);
  }

  // ── DOM collection & measurement ──────────────────────────
  collect() {
    if (!this.root) return;
    const q = (s: string) => Array.from(this.root.querySelectorAll(s)) as HTMLElement[];
    this.cursorEl = this.root.querySelector('[data-cursor]');
    this.cursorIn = this.root.querySelector('[data-cursor-in]');
    this.exhibit = this.root.querySelector('[data-exhibit]');
    this.stage = this.root.querySelector('[data-stage]');
    this.heroText = this.root.querySelector('[data-hero-text]');
    this.heroBg = this.root.querySelector('[data-hero-bg]');
    this.logoTrack = this.root.querySelector('[data-logo-track]');
    this.stack = q('[data-stack]').sort((a, b) => +a.dataset.stack! - +b.dataset.stack!);
    this.heroLines = q('[data-hero-line]');
    this.heroMeta = q('[data-hero-meta]');
    this.toggle = this.root.querySelector('[data-mode-toggle]'); this._toggleOn = undefined;
    this.header = this.root.querySelector('[data-header]'); this.caseHeroText = this.root.querySelector('[data-case-hero-text]'); this._hdrKey = undefined;
    if (this.state.route.name === 'home' && !this.state.entered) this._t = 0;
    this.rows = {};
    const row = (i: string | number) => (this.rows[i] = this.rows[i] || {});
    this.plane0 = this.root.querySelector('[data-plane="0"]');
    q('[data-row-title]').forEach(el => { row(el.dataset.rowTitle!).title = el; });
    q('[data-row-media]').forEach(el => { row(el.dataset.rowMedia!).media = el; });
    q('[data-row-line]').forEach(el => { row(el.dataset.rowLine!).line = el; });
    q('[data-plane]').forEach(el => { row(el.dataset.plane!).plane = el; });
    q('[data-row]').forEach(el => { row(el.dataset.row!).section = el; });
    if (this.stage) { row(0).section = this.stage; row(0).media = this.stack[0] || null; }
    this.measure();
    this.fitTitles();
    this.setupLazyVideos();
    this.syncToggle();
    this.requestFrame();
  }
  measure() {
    if (!this.root) return;
    this.vw = this.root.clientWidth || window.innerWidth;
    this.vh = this.stage ? this.stage.offsetHeight : window.innerHeight;
    if (this.exhibit && this.stage) this.T = Math.max(1, this.exhibit.offsetHeight - this.stage.offsetHeight);
    if (this.stack[0]) this.boxH = this.stack[0].offsetHeight || 1;
    if (this.heroText) this.heroFs = parseFloat(getComputedStyle(this.heroText).fontSize) || 100;
  }
  fitTitles() {
    if (!this.root) return;
    const bleed = P.titleBleed / 100;
    const vw = this.root.clientWidth || window.innerWidth;
    const vh = this.vh > 1 ? this.vh : window.innerHeight;
    this.root.querySelectorAll('[data-fit-title]').forEach((el: HTMLElement) => {
      el.style.fontSize = '100px';
      const w = el.offsetWidth || 1; // largura de layout: ignora o tambor 3D
      const target = vw * (this.state.mobile ? 1.04 : bleed);
      const fs = Math.max(56, Math.min(100 * target / w, vh * 0.5));
      el.style.fontSize = fs.toFixed(1) + 'px';
    });
  }
  setupLazyVideos() {
    if (this.io) this.io.disconnect();
    const vids = Array.from(this.root.querySelectorAll('video[data-lazy-src]')) as any[];
    vids.forEach(v => {
      v.muted = true; v.defaultMuted = true; // o React não garante o atributo `muted`; sem ele o play() é bloqueado
      if (v.hasAttribute('data-cover')) this.wireCover(v);
      const cur = v.getAttribute('src');
      if (cur && cur !== v.dataset.lazySrc) { v.__cv = undefined; v.removeAttribute('src'); v.load(); }
    });
    if (!vids.length || typeof IntersectionObserver === 'undefined') return;
    // Capas (data-cover) só são pré-carregadas aqui; play/pause delas acontece em frame(), pelo centro da tela.
    this.io = new IntersectionObserver(entries => entries.forEach(en => {
      const v = en.target as any, cover = v.hasAttribute('data-cover');
      if (en.isIntersecting) {
        if (!v.getAttribute('src')) { if (cover) v.preload = 'auto'; v.setAttribute('src', v.dataset.lazySrc); v.load(); }
        if (!cover) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      } else if (!cover && !v.paused) v.pause();
    }), { rootMargin: '60% 0px 60% 0px', threshold: 0.01 });
    vids.forEach(v => this.io.observe(v));
  }
  // Vídeo de capa: nasce no ponto em que o logo começa a se formar (coverStart do projeto, ou videoStart)
  // e, ao terminar, volta sempre para esse ponto — nunca para o zero.
  coverStartOf(v: any) {
    const d = v.duration; if (!isFinite(d) || d <= 0) return 0;
    const raw = parseFloat(v.dataset.start);
    const s = isFinite(raw) ? (raw <= 1 ? d * raw : raw) : d * P.videoStart / 100;
    return U.clamp(s, 0, Math.max(0, d - 0.2));
  }
  seekStart(v: any) { try { v.currentTime = this.coverStartOf(v); } catch (e) {} }
  wireCover(v: any) {
    if (v.__wired) return; v.__wired = true;
    v.addEventListener('loadedmetadata', () => { if (v.__cv !== 'play') this.seekStart(v); }); // frame de repouso = início do logo
    v.addEventListener('ended', () => { if (v.__cv === 'play') { this.seekStart(v); const p = v.play(); if (p && p.catch) p.catch(() => {}); } });
  }
  reduceMotion() { return !!(this.mqRM && this.mqRM.matches); }

  // ── intro ──────────────────────────────────────────────────
  // Sem loader: aguarda fontes + retrato (teto de 700ms) e inicia a coreografia de entrada.
  startIntro() {
    if (this._introArmed) return;
    this._introArmed = true;
    const s = this.data.site;
    const waits: Promise<any>[] = [document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve()];
    if (s && s.heroImage) waits.push(new Promise(res => {
      const im = new Image(); im.onload = im.onerror = res;
      im.sizes = this.heroSizes(); const ss = srcSet(s.heroImage); if (ss) im.srcset = ss; im.src = pick(s.heroImage, 1200); // mesma variante que o <img> do hero
    }));
    let fired = false;
    const go = () => {
      if (fired) return; fired = true;
      this.introStart = this.reduceMotion() ? performance.now() - 10000 : performance.now() + 120;
      this.setState({ introPending: false });
      this.measure(); this.fitTitles(); this.requestFrame();
    };
    Promise.all(waits).then(go, go);
    setTimeout(go, 700);
  }
  heroSizes() { return coverSizes(this.data.site.heroImage, '100vw', '100vh'); }

  // ── choreography ───────────────────────────────────────────
  // Tambor 3D: cada linha é um plano que gira e se comprime em direção ao centro da tela.
  // d = distância do centro da linha ao centro da viewport, em alturas de tela.
  drum(d: number, mode: string) {
    const vh = this.vh, a = Math.min(Math.abs(d), 1);
    const tOp = 1 - U.smooth(a, 0.22, 0.6), iOp = 1 - U.smooth(a, 0.5, 0.95), bl = U.smooth(a, 0.1, 0.6) * 8; // desfoque dos vizinhos, em px
    if (mode === 'flat') return { ty: 0, tz: 0, rx: 0, br: 1, op: 1, tOp, iOp, bl };
    if (mode === 'gentle') return { ty: -d * 0.04 * vh, tz: 0, rx: -d * 14, br: 1 - a * 0.3, op: 1, tOp, iOp, bl };
    const A = P.drumTilt * (this.state.mobile ? 0.8 : 1);
    // compressão: y visual = K·tanh(d/K). Menos inclinação → menos compressão, para o vizinho não invadir a linha do centro.
    const K = U.clamp(0.68 + (75 - A) / 100, 0.5, 0.95);
    const rx = -U.clamp(d * A, -80, 80);
    const th = Math.abs(rx) * Math.PI / 180;
    return {
      ty: (K * Math.tanh(d / K) - d) * vh,
      tz: -0.5 * vh * (1 - Math.cos(th)),
      rx,
      br: 1 - 0.4 * Math.min(Math.abs(d) / 0.9, 1),
      op: 1 - U.smooth(Math.abs(d), 0.85, 1.15),
      tOp, iOp, bl,
    };
  }
  drumTransform(D: any) { return `translate3d(0, ${D.ty.toFixed(1)}px, ${D.tz.toFixed(1)}px) rotateX(${D.rx.toFixed(2)}deg)`; }
  drumFilter(D: any, br?: number) { return `brightness(${(br == null ? D.br : br).toFixed(3)})` + (D.bl > 0.05 ? ` blur(${D.bl.toFixed(1)}px)` : ''); }
  // Snap (opcional, P.snap): quando o scroll para dentro da galeria, centraliza o projeto mais próximo.
  snapTargets() {
    if (!this.exhibit || !this.stage) return [];
    const vh = this.vh, list = [this.yOf(this.exhibit) + this.T];
    Object.keys(this.rows).forEach(idx => { const r = this.rows[idx]; if (idx !== '0' && r.section) list.push(this.yOf(r.section) + r.section.offsetHeight / 2 - vh / 2); });
    return list;
  }
  onIdle() {
    const finish = () => { this.settled = true; this.requestFrame(); };
    if (this.state.route.name !== 'home' || !this.exhibit || P.snap !== true) return finish();
    const targets = this.snapTargets(); if (!targets.length) return finish();
    const y = this.getScrollTop();
    const zoneStart = targets[0] - 0.45 * this.T, zoneEnd = targets[targets.length - 1] + 0.45 * this.vh;
    if (y < zoneStart || y > zoneEnd) return finish();
    let best = targets[0]; targets.forEach(ty => { if (Math.abs(ty - y) < Math.abs(best - y)) best = ty; });
    if (Math.abs(best - y) <= 1.5) return finish();
    this.scrollToY(best, true);
  }
  // Capa: toca (a partir do início do logo) quando o card está perto do centro; ao se afastar, pausa e volta ao frame de repouso.
  coverPlayback(card: HTMLElement, on: boolean, off: boolean) {
    const v = card && card.querySelector('video[data-cover]') as any;
    if (!v) return;
    if (on && v.__cv !== 'play') {
      v.__cv = 'play';
      if (!v.getAttribute('src')) { v.preload = 'auto'; v.setAttribute('src', v.dataset.lazySrc); v.load(); }
      const go = () => { if (v.__cv !== 'play') return; this.seekStart(v); const p = v.play(); if (p && p.catch) p.catch(() => {}); };
      if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
    } else if (off && v.__cv !== 'stop') {
      v.__cv = 'stop';
      if (!v.paused) v.pause();
      if (v.readyState > 0) this.seekStart(v);
    }
  }
  // Seletor Marcas / Produtos digitais, fixo no topo: aparece quando o hero sai da tela; na galeria sem hero e nos cases fica sempre visível.
  syncToggle(t?: number) {
    if (t !== undefined) this._t = t;
    const el = this.toggle; if (!el) return;
    const on = this.state.route.name === 'case' || this.state.entered || (this._t || 0) > 0.7;
    if (on === this._toggleOn) return;
    this._toggleOn = on;
    el.style.opacity = on ? '1' : '0';
    el.style.pointerEvents = on ? 'auto' : 'none';
    el.style.transform = on ? 'translate(-50%, 0)' : 'translate(-50%, -10px)';
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  currentCase() {
    const r = this.state.route; if (r.name !== 'case') return null;
    const list = (this.state.mode === 'digital' ? this._digital : this._brand) || [];
    return list.find((p: any) => p.slug === r.slug) || null;
  }
  // Case: enquanto o topo (hero na cor do projeto) está sob o cabeçalho, o cabeçalho e o seletor usam a paleta do projeto; depois voltam ao blend.
  caseFrame() {
    this.syncToggle();
    const cs = this.currentCase(), el = this.caseHeroText;
    if (!cs || !el) { this.setHeaderOver(false); return; }
    const lim = this.header ? this.header.offsetHeight * 0.7 : 48;
    this.setHeaderOver(el.getBoundingClientRect().bottom > lim, cs);
  }
  setHeaderOver(on: boolean, cs?: any) {
    if (on && !cs) on = false;
    const key = on ? cs.palBg + '|' + cs.palInk : '0';
    if (this._hdrKey === key) return;
    this._hdrKey = key; this._hdrOn = on;
    const h = this.header, t = this.toggle;
    if (h) { h.style.mixBlendMode = on ? 'normal' : 'difference'; h.style.setProperty('--hdr', on ? cs.palInk : '#f4f3ef'); }
    if (t) {
      if (on) { t.style.setProperty('--bg', cs.palBg); t.style.setProperty('--ink', cs.palInk); t.style.setProperty('--line', cs.palLine); }
      else ['--bg', '--ink', '--line'].forEach(k => t.style.removeProperty(k));
    }
  }
  requestFrame() { if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = 0; this.frame(); }); }
  frame() {
    if (this.state.route.name === 'case') { this.caseFrame(); return; }
    this.setHeaderOver(false);
    if (!this.stage || !this.exhibit) return;
    const now = performance.now();
    const rm = this.reduceMotion();
    const introT = this.introStart ? (rm ? 99 : (now - this.introStart) / 1000) : -1;
    const vh = this.vh;
    const minimal = rm || P.galleryMotion === 'minimal';
    const mode = rm ? 'flat' : (minimal ? 'gentle' : 'full');
    const er = this.exhibit.getBoundingClientRect();
    const dbgAttr = document.documentElement.getAttribute('data-dc-t');
    const dbg = dbgAttr !== null && dbgAttr !== '';
    const t = dbg ? parseFloat(dbgAttr!) : (this.state.entered ? 1 : U.clamp(-er.top / this.T, 0, 1)); // sem hero, a galeria já começa aberta
    this.syncToggle(t);
    const sr = this.stage.getBoundingClientRect();
    const d0 = dbg ? 0 : (sr.top + sr.height / 2 - vh / 2) / vh;
    const D0 = this.drum(d0, mode);
    const vis = (el: HTMLElement, on: boolean) => { el.style.visibility = on ? 'visible' : 'hidden'; };
    this.stage.style.perspectiveOrigin = `50% ${(vh / 2 - sr.top).toFixed(1)}px`;
    if (this.plane0) this.plane0.style.transform = this.drumTransform(D0);

    // Retrato de fundo: aparece na entrada e recua (cresce + some) quando a exposição começa
    const eb = introT < 0 ? 0 : U.expoOut(U.clamp(introT / 1.4, 0, 1));
    const bgOut = U.smooth(t, 0.02, 0.55);
    if (this.heroBg) {
      const s = (rm ? 1 : 1.05 - 0.05 * eb) * (1 + (minimal ? 0.03 : 0.1) * U.easeOut(t));
      this.heroBg.style.transform = `scale(${s.toFixed(4)})`;
      this.heroBg.style.opacity = (eb * (1 - bgOut)).toFixed(3);
      vis(this.heroBg, eb * (1 - bgOut) > 0.001);
    }
    // Carrossel de marcas (fim da página): só anima enquanto está na tela.
    if (this.logoTrack) {
      const br = this.logoTrack.parentElement.getBoundingClientRect();
      const ps = (rm || br.bottom < 0 || br.top > vh) ? 'paused' : 'running';
      if (this.logoTrack.style.animationPlayState !== ps) this.logoTrack.style.animationPlayState = ps;
    }

    // A capa do projeto 01 surge do centro quando o retrato sai
    this.stack.forEach(el => {
      const u = U.easeInOut(U.smooth(t, 0.22, 0.9));
      const op = U.smooth(t, 0.22, 0.5);
      const ty = (1 - u) * 0.10 * vh;
      const sc = U.lerp(0.58, 1, u);
      el.style.transform = `translate(-50%, calc(-50% + ${ty.toFixed(1)}px)) scale(${sc.toFixed(4)})`;
      el.style.opacity = op.toFixed(3);
      el.style.filter = this.drumFilter(D0, U.lerp(0.7, 1, u) * D0.br);
      el.style.pointerEvents = op < 0.5 ? 'none' : 'auto';
      vis(el, op > 0.001);
      this.coverPlayback(el, t > 0.9 && Math.abs(d0) < 0.3, op < 0.3 || Math.abs(d0) > 0.5);
    });

    this.heroLines.forEach((el, k) => {
      const e = introT < 0 ? 0 : U.expoOut(U.clamp((introT - (0.5 + k * 0.1)) / 1.0, 0, 1));
      const o = 1 - U.smooth(t, 0.04 + 0.05 * k, 0.36 + 0.05 * k);
      const y = -U.easeOut(t) * 0.12 * vh + (1 - e) * 0.28 * this.heroFs;
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = o.toFixed(3);
      el.style.clipPath = rm ? 'none' : `inset(${U.lerp(108, -14, e).toFixed(2)}% -2% -12% -2%)`;
      vis(el, o > 0.001);
    });

    const em = introT < 0 ? 0 : U.expoOut(U.clamp((introT - 0.25) / 0.8, 0, 1));
    const mo = em * (1 - U.smooth(t, 0, 0.22));
    this.heroMeta.forEach(el => { el.style.opacity = mo.toFixed(3); vis(el, mo > 0.001); el.style.pointerEvents = mo < 0.3 ? 'none' : ''; });

    const r0 = this.rows[0];
    if (r0 && r0.title) {
      const s = U.smooth(t, 0.48, 0.86), o = s * D0.tOp;
      r0.title.style.opacity = o.toFixed(3);
      r0.title.style.transform = `translate3d(0, ${((1 - s) * 0.05 * vh).toFixed(1)}px, 0)`;
      vis(r0.title, o > 0.001);
    }
    if (r0 && r0.line) r0.line.style.opacity = (U.smooth(t, 0.66, 0.95) * D0.iOp).toFixed(3);

    Object.keys(this.rows).forEach(idx => {
      if (idx === '0') return;
      const r = this.rows[idx]; if (!r.section) return;
      const rr = r.section.getBoundingClientRect();
      const d = (rr.top + rr.height / 2 - vh / 2) / vh;
      if (Math.abs(d) > 2.4) { if (r.plane && r.plane.style.opacity !== '0') r.plane.style.opacity = '0'; return; }
      const D = this.drum(d, mode);
      r.section.style.perspectiveOrigin = `50% ${(vh / 2 - rr.top).toFixed(1)}px`;
      if (r.plane) { r.plane.style.transform = this.drumTransform(D); r.plane.style.opacity = D.op.toFixed(3); }
      if (r.media) { r.media.style.filter = this.drumFilter(D); r.media.style.pointerEvents = D.op > 0.5 ? 'auto' : 'none'; this.coverPlayback(r.media, Math.abs(d) < 0.3, Math.abs(d) > 0.5); }
      if (r.title) { r.title.style.opacity = D.tOp.toFixed(3); r.title.style.transform = `translate3d(0, ${(-d * 0.06 * vh).toFixed(1)}px, 0)`; vis(r.title, D.tOp > 0.001); }
      if (r.line) r.line.style.opacity = D.iOp.toFixed(3);
    });

    if (this.introStart && introT < 2.4) this.requestFrame();
  }

  // ── scrolling & routing ────────────────────────────────────
  getScroller() {
    let el = this.root && this.root.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
      el = el.parentElement;
    }
    return null;
  }
  getScrollTop() { const s = this.getScroller(); return s ? s.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0); }
  scrollToY(y: number, smooth?: boolean) { const s = this.getScroller(); (s || window).scrollTo({ top: Math.max(0, y), behavior: smooth && !this.reduceMotion() ? 'smooth' : 'auto' }); }
  yOf(el: HTMLElement) { const s = this.getScroller(); const base = s ? s.getBoundingClientRect().top : 0; return el.getBoundingClientRect().top - base + this.getScrollTop(); }
  scrollToSection(name: string, smooth?: boolean) {
    if (!this.root) return;
    if (name === 'projetos' || name === 'marcas' || name === 'digital') { if (this.exhibit) this.scrollToY(this.yOf(this.exhibit) + this.T, smooth); return; }
    const el = this.root.querySelector('#' + name);
    if (el) this.scrollToY(this.yOf(el), smooth);
  }
  pushUrl(url: string) { try { history.pushState(null, '', url); } catch (e) { try { location.href = url; } catch (_) {} } }
  applyHash(initial: boolean) {
    const d = this.data;
    const h = location.hash || '';
    let path = location.pathname;
    const legacy = h.match(CASE_HASH);
    if (legacy) { path = '/' + legacy[1] + '/' + legacy[2]; try { history.replaceState(null, '', path); } catch (e) {} }
    const r = routeFromPath(path);
    if (r) {
      if (this.state.route.slug !== r.slug || this.state.mode !== r.mode) {
        this.setState({ mode: r.mode, entered: true, route: { name: 'case', slug: r.slug } });
        requestAnimationFrame(() => this.scrollToY(0, false));
      }
      return;
    }
    if (path !== '/' && d) { try { history.replaceState(null, '', '/' + h); } catch (e) {} } // caminho desconhecido: volta para a home
    const fromCase = this.state.route.name !== 'home';
    const patch: Partial<State> = {};
    if (h === '#digital' || h === '#marcas') { patch.mode = h === '#digital' ? 'digital' : 'brand'; patch.entered = true; }
    else if (h === '' || h === '#') patch.entered = false; // landing: hero
    if (fromCase) patch.route = { name: 'home', slug: null };
    if (Object.keys(patch).length) this.setState(patch as State);
    if (fromCase) requestAnimationFrame(() => this.scrollToY(patch.entered === false ? 0 : (this.homeScroll || 0), false));
    else if (/^#(sobre|contato|clientes|projetos|marcas|digital)$/.test(h)) setTimeout(() => this.scrollToSection(h.slice(1), !initial), 80);
    else if (patch.entered === false) requestAnimationFrame(() => this.scrollToY(0, false));
  }
  navigate(slug: string | null) {
    this.pushUrl(slug ? hashFor(this.state.mode, slug) : '/');
    this.setState({ route: slug ? { name: 'case', slug } : { name: 'home', slug: null } });
    requestAnimationFrame(() => { this.scrollToY(slug ? 0 : (this.homeScroll || 0), false); this.requestFrame(); });
  }
  openProject(e: any, p: any) {
    if (e && e.metaKey || e && e.ctrlKey || e && e.shiftKey || e && e.button === 1) return; // nova aba: deixa o link seguir
    if (e && e.preventDefault) e.preventDefault();
    if (this.state.tr) return;
    this.cursorOff(e);
    const el = e && e.currentTarget;
    const rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (this.state.route.name === 'home') this.homeScroll = this.getScrollTop();
    if (!rect || this.reduceMotion() || !p.posterOrCover) { this.navigate(p.slug); return; }
    // Usa a mesma variante que já está na tela (em cache), para a transição não piscar.
    const shown = el.querySelector && el.querySelector('img') as HTMLImageElement | null;
    const src = (shown && shown.currentSrc) || pick(p.posterOrCover, 1200);
    const tr = { src, left: rect.left, top: rect.top, w: rect.width, h: rect.height, expanded: false, wipe: false };
    this.setState({ tr });
    requestAnimationFrame(() => requestAnimationFrame(() => this.setState({ tr: { ...tr, expanded: true } })));
    setTimeout(() => { this.navigate(p.slug); this.setState({ tr: { ...tr, expanded: true, wipe: true } }); }, 720);
    setTimeout(() => this.setState({ tr: null }), 720 + 680);
  }
  // Cortina: cobre a tela com a cor atual do fundo, troca a cena por baixo e revela.
  transition(go: () => void) {
    const veil = this.root && this.root.querySelector('[data-veil]');
    if (!veil || this.reduceMotion()) { go(); return; }
    if (this.busy) return;
    this.busy = true;
    const cs = this._hdrOn ? this.currentCase() : null;
    veil.style.background = cs ? cs.palBg : getComputedStyle(this.root).backgroundColor;
    veil.style.opacity = '1';
    setTimeout(() => { go(); setTimeout(() => { veil.style.opacity = '0'; this.busy = false; }, 80); }, 420);
  }
  goHome = (e?: any, section?: string) => {
    if (e && e.preventDefault) e.preventDefault();
    if (this.state.route.name === 'home' && !section) { this.scrollToY(this.homeScroll || 0, true); return; }
    this.transition(() => {
      this.pushUrl(section ? '/#' + section : hashFor(this.state.mode));
      this.setState({ route: { name: 'home', slug: null } });
      requestAnimationFrame(() => {
        if (section) this.scrollToSection(section, false); else this.scrollToY(this.homeScroll || 0, false);
        this.requestFrame();
      });
    });
  };
  // Troca de modo (seletor do topo): entra na galeria do modo, sem hero, começando pelo primeiro projeto. Num case com versão digital, fica no mesmo projeto.
  setMode(mode: string, e?: any) {
    if (e && e.preventDefault) e.preventDefault();
    const d = this.data; if (!d || this.busy) return;
    const r = this.state.route;
    const cur = r.name === 'case' ? d.projects.find(x => x.slug === r.slug) : null;
    if (this.state.mode === mode) { if (!cur && !this.state.entered) this.scrollToSection('projetos', true); return; } // já está no modo
    const stay = !!(cur && (mode === 'brand' || cur.digital));
    this.cursorOff(e);
    this.transition(() => {
      this.setState({ mode, entered: true, route: stay ? r : { name: 'home', slug: null } });
      this.pushUrl(hashFor(mode, stay ? cur.slug : null));
      requestAnimationFrame(() => { this.scrollToY(0, false); this.requestFrame(); });
    });
  }
  // Clique no nome: volta à landing (hero), sempre no tema preto.
  goLanding = (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (this.state.route.name === 'home' && !this.state.entered) { this.scrollToY(0, true); this.pushUrl('/'); return; }
    this.transition(() => {
      this.pushUrl('/');
      this.setState({ route: { name: 'home', slug: null }, entered: false });
      requestAnimationFrame(() => { this.scrollToY(0, false); this.requestFrame(); });
    });
  };
  // Chamada de rolagem do hero do case: leva até a imagem principal.
  toMedia = (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    const f = this.root && this.root.querySelector('[data-case-media]');
    if (f) this.scrollToY(this.yOf(f), true);
  };
  cue() {
    if (this._cue) return this._cue;
    const rm = this.mqRM ? this.mqRM.matches : false;
    const el = <span aria-hidden="true" className="cue"><span style={rm ? { animation: 'none' } : undefined} /></span>;
    if (this.mqRM) this._cue = el;
    return el;
  }
  // Lista dobrada: o trilho anda -50% e volta ao início sem emenda. `scale` compensa a proporção de cada logo (símbolos maiores, wordmarks largos menores).
  logoLoop(src: any[]) {
    if (this._logoSrc === src && this._logoLoop) return this._logoLoop;
    const B = 'clamp(34px,4.2vw,68px)';
    const l = (src || []).map(x => ({ name: x.name || '', src: x.src || '', text: x.text || x.name || '', isImg: !!x.src, isText: !x.src, h: `calc(${B} * ${x.scale || 1})`, fs: `calc(${B} * ${(x.scale || 1) * 0.78})`, sizes: `calc(${B} * ${((x.scale || 1) * ratioOf(x.src)).toFixed(3)})` }));
    this._logoSrc = src; this._logoLoop = l.concat(l); return this._logoLoop;
  }
  setBrand = (e: any) => this.setMode('brand', e);
  setDigital = (e: any) => this.setMode('digital', e);
  onNav = (e: any) => {
    const name = e.currentTarget.dataset.nav;
    e.preventDefault();
    if (this.state.route.name !== 'home') { this.goHome(null, name); return; }
    this.scrollToSection(name, true);
    this.pushUrl('/#' + name);
  };
  cursorOn = (e: any) => {
    if (!this.canHover || !this.cursorIn) return;
    if (e && e.currentTarget) e.currentTarget.style.cursor = 'none';
    this.cursorIn.style.opacity = '1'; this.cursorIn.style.transform = 'scale(1)';
  };
  cursorOff = (e: any) => {
    if (!this.cursorIn) return;
    if (e && e.currentTarget && e.currentTarget.style) e.currentTarget.style.cursor = '';
    this.cursorIn.style.opacity = '0'; this.cursorIn.style.transform = 'scale(.4)';
  };

  // ── data normalisation ─────────────────────────────────────
  normMedia(m: any) {
    if (!m) return null;
    const isVideo = m.mediaType === 'video';
    return { ...m, isVideo, isImage: !isVideo, poster: m.poster || '', ratio: m.ratio || '16 / 9', hasCaption: !!m.caption, alt: m.alt || '', caption: m.caption || '' };
  }
  normBlock(b: any) {
    const items = (b.items || []).map((m: any) => this.normMedia(m));
    const media = b.kind === 'media', L = b.layout || 'wide';
    return { ...b, items, one: items[0] || {}, text: b.text || {}, a: b.a || {}, b: b.b || {}, layout: L,
      isText: b.kind === 'text', isTextPair: b.kind === 'textPair', isStatement: b.kind === 'statement',
      isFull: media && L === 'full', isWide: media && L === 'wide', isSmall: media && L === 'small',
      isVertical: media && L === 'vertical', isPair: media && L === 'pair', isTextMedia: media && L === 'textMedia' };
  }
  // No modo digital, o objeto `digital` do projeto sobrescreve os campos da versão de marca.
  normProject(p: any, i: number, mode: string) {
    const dig = mode === 'digital';
    const src = dig ? { ...p, ...(p.digital || {}) } : p;
    const isVideo = src.mediaType === 'video';
    const th = THEMES[mode] || THEMES.brand, pal = src.palette || {}, pbg = pal.bg || th.bg, pink = pal.ink || th.ink;
    const n: any = { ...src, idx: i, mode, num: U.pad(i + 1), href: hashFor(mode, p.slug), isVideo, isImage: !isVideo,
      palBg: pbg, palInk: pink, palInk2: `color-mix(in oklab, ${pink} 88%, ${pbg})`, palMute: pal.mute || `color-mix(in oklab, ${pink} 70%, ${pbg})`, palLine: `color-mix(in oklab, ${pink} 25%, transparent)`,
      poster: src.poster || '', posterOrCover: isVideo ? (src.poster || '') : src.cover, coverAlt: src.coverAlt || src.title, coverStart: src.coverStart ?? '',
      aria: 'Ver projeto ' + src.title, titleLines: src.titleLines || [src.title], role: src.role || [],
      line: src.tagline || src.category || '', tagline: src.tagline || '', hasTagline: !!src.tagline, sector: src.sector || '', hasSector: !!src.sector, teaser: src.teaser || '', hasTeaser: !!src.teaser,
      heroM: this.normMedia(src.hero) || {}, blocks: (src.blocks || []).map((b: any) => this.normBlock(b)),
      credits: (src.credits || []).filter((c: any) => c && c.name) };
    n.open = (e: any) => this.openProject(e, n);
    return n;
  }
  renderVals() {
    const d = this.data, s = d.site || {};
    if (this._normSrc !== d) {
      const all = d.projects || [];
      this._brand = all.map((p, i) => this.normProject(p, i, 'brand'));
      this._digital = all.filter(p => p.digital).map((p, i) => this.normProject(p, i, 'digital'));
      this._normSrc = d;
    }
    const digital = this.state.mode === 'digital';
    const projects = (digital ? this._digital : this._brand) || [];
    const route = this.state.route;
    const cs = route.name === 'case' ? projects.find((p: any) => p.slug === route.slug) : null;
    const nx = cs && projects.length > 1 ? projects[(cs.idx + 1) % projects.length] : null;
    const tr = this.state.tr;
    const px = (v: number) => v.toFixed(1) + 'px';
    return {
      isHome: !cs, isCase: !!cs,
      mobile: this.state.mobile, notMobile: !this.state.mobile,
      showHero: !this.state.entered, showHeroBg: !this.state.entered && !!s.heroImage, exhibitH: this.state.entered ? '100svh' : '220svh',
      isBrand: !digital, isDigital: digital,
      brandFg: digital ? 'var(--ink)' : 'var(--bg)', brandBg: digital ? 'transparent' : 'var(--ink)',
      digitalFg: digital ? 'var(--bg)' : 'var(--ink)', digitalBg: digital ? 'var(--ink)' : 'transparent',
      siteName: s.name || 'Thiago Araujo', siteRole: s.role || 'Diretor Criativo', siteLocation: s.location || 'São Paulo, Brasil',
      siteCity: s.city || 'São Paulo', siteCountry: s.country || 'Brasil', bio: s.bio || '',
      emailHref: s.email ? 'mailto:' + s.email : '#contato', linkedinHref: s.linkedin || '#contato', instagramHref: s.instagram || '#contato',
      heroBg: s.heroImage || '', heroBgAlt: s.heroAlt || '',
      logoLoop: this.logoLoop(s.logos),
      stack: projects.slice(0, 1), rows: projects.slice(1), first: projects[0] || { title: '', category: '', line: '', num: '', year: '' }, count: U.pad(projects.length),
      cs: cs || {}, nx: nx || {}, hasNext: !!nx,
      hasTransition: !!tr, trSrc: tr ? tr.src : '',
      trLeft: tr ? (tr.expanded ? '0px' : px(tr.left)) : '0px', trTop: tr ? (tr.expanded ? '0px' : px(tr.top)) : '0px',
      trW: tr ? (tr.expanded ? '100%' : px(tr.w)) : '0px', trH: tr ? (tr.expanded ? '100%' : px(tr.h)) : '0px',
      trClip: tr && tr.wipe ? 'inset(100% 0 0 0)' : 'inset(0 0 0 0)',
      currentYear: new Date().getFullYear(),
      backHref: hashFor(this.state.mode),
    };
  }

  // ── render ─────────────────────────────────────────────────
  renderCover(p: any, sizes: string, lazy: boolean) {
    return <>
      {p.isVideo && <video data-cover="1" data-lazy-src={p.cover} data-start={p.coverStart} muted playsInline preload="none" aria-hidden="true" className="fill zoom h-zoom" />}
      {p.isImage && <Img src={p.cover} sizes={sizes} alt={p.coverAlt} loading={lazy ? 'lazy' : undefined} decoding={lazy ? 'async' : undefined} className="fill zoom h-zoom" />}
    </>;
  }
  rowLine(p: any, idx: number, style?: CSSProperties) {
    return <div data-row-line={idx} className="row-line lbl" style={style}>
      <span className="row-line-l"><span className="mono mute">{p.num}</span><span>{p.title}</span></span>
      <span className="row-line-r"><span className="mute">{p.line}</span><span className="mono nw">{p.year}</span></span>
    </div>;
  }
  media(m: any, layout: string, extraClass = '') {
    const posterMin = layout === 'full' || layout === 'wide' ? 1600 : 1200;
    return <>
      {m.isVideo && <video data-lazy-src={m.src} poster={m.poster ? pick(m.poster, posterMin) : undefined} muted loop playsInline preload="none" aria-label={m.alt} className={'m ' + extraClass} style={{ aspectRatio: m.ratio }} />}
      {m.isImage && <Img src={m.src} sizes={BLOCK_SIZES[layout] || '100vw'} alt={m.alt} loading="lazy" decoding="async" className={'m ' + extraClass} />}
    </>;
  }
  block(b: any, i: number) {
    const one = b.one;
    if (b.isText) return <div key={i} className="b-cols">
      <div className="b-k lbl">{b.label}</div>
      <p className="b-p b-p1">{b.body}</p>
    </div>;
    if (b.isTextPair) return <div key={i} className="b-cols">
      <div className="b-k lbl">{b.a.label}</div>
      <p className="b-p b-p2">{b.a.body}</p>
      <div className="b-p2"><div className="b-k2 lbl">{b.b.label}</div><p className="b-p">{b.b.body}</p></div>
    </div>;
    if (b.isStatement) return <p key={i} className="b-stmt">{b.text}</p>;
    if (b.isFull) return <figure key={i} className="b-full">{this.media(one, 'full')}{one.hasCaption && <figcaption className="cap lbl">{one.caption}</figcaption>}</figure>;
    if (b.isWide) return <figure key={i} className="b-wide">{this.media(one, 'wide')}{one.hasCaption && <figcaption className="cap lbl">{one.caption}</figcaption>}</figure>;
    if (b.isSmall) return <figure key={i} className="b-small">{this.media(one, 'small', 'm-bg')}{one.hasCaption && <figcaption className="cap lbl">{one.caption}</figcaption>}</figure>;
    if (b.isVertical) return <figure key={i} className="b-vert">{this.media(one, 'vertical', 'm-bg')}{one.hasCaption && <figcaption className="cap lbl">{one.caption}</figcaption>}</figure>;
    if (b.isPair) return <div key={i} className="b-pair">{b.items.map((m: any, j: number) =>
      <figure key={j}>{this.media(m, 'pair', 'm-bg')}{m.hasCaption && <figcaption className="cap lbl">{m.caption}</figcaption>}</figure>)}</div>;
    if (b.isTextMedia) return <div key={i} className="b-cols b-tm">
      <div className="b-k lbl">{b.text.label}</div>
      <p className="b-p b-p2">{b.text.body}</p>
      <figure>{this.media(one, 'textMedia', 'm-bg')}{one.hasCaption && <figcaption className="cap lbl">{one.caption}</figcaption>}</figure>
    </div>;
    return null;
  }
  footer(v: any) {
    return <footer className="foot">
      <div><div>{v.siteName}</div><div className="mute">{v.siteRole}</div></div>
      <div className="mute"><div>{v.siteCity}</div><div>{v.siteCountry}</div></div>
      <div className="foot-links">
        <a href={v.instagramHref} target="_blank" rel="noreferrer" className="h-mute">Instagram</a>
        <a href={v.linkedinHref} target="_blank" rel="noreferrer" className="h-mute">LinkedIn</a>
        <a href={v.emailHref} className="h-mute">E-mail</a>
      </div>
      <div className="foot-year mono">© {v.currentYear}</div>
    </footer>;
  }
  toggleEl(v: any) {
    return <div data-mode-toggle role="tablist" aria-label="Tipo de trabalho" aria-hidden="true" className={'toggle' + (v.mobile ? ' is-mobile' : '')}>
      <a href="/#marcas" role="tab" aria-selected={v.isBrand} onClick={this.setBrand} className="f-ink3" style={{ color: v.brandFg, background: v.brandBg }}>Marcas</a>
      <a href="/#digital" role="tab" aria-selected={v.isDigital} onClick={this.setDigital} className="f-ink3" style={{ color: v.digitalFg, background: v.digitalBg }}>Produtos digitais</a>
    </div>;
  }

  render() {
    const v = this.renderVals();
    const cs: any = v.cs, nx: any = v.nx, first: any = v.first;
    const th = THEMES[this.themeMode()] || THEMES.brand;
    const rootStyle = Object.fromEntries(Object.keys(th).map(k => ['--' + k, th[k]])) as CSSProperties;
    const cardS = (src: string) => cardSizes(src, CARD_W);
    return (
      <div data-portfolio-root style={rootStyle}>
        <header data-header className="hdr">
          <div className="hdr-l">
            {v.isHome && <a href="/" onClick={this.goLanding} aria-label="Thiago Araujo — início" className="hdr-name f-hdr">Thiago Araujo</a>}
            {v.isCase && <a data-back href={v.backHref} onClick={this.goHome} aria-label="Voltar aos projetos" className="hdr-back h-back f-hdr">
              <svg aria-hidden="true" width="24" height="10"><path d="M23 5H1.5M5.5 1 1.5 5l4 4" /></svg><span>Voltar</span></a>}
          </div>
          <nav aria-label="Principal" className="hdr-nav">
            <a href="/#projetos" data-nav="projetos" onClick={this.onNav} className="h-op50 f-hdr">Projetos</a>
            <a href="/#sobre" data-nav="sobre" onClick={this.onNav} className="h-op50 f-hdr">Sobre</a>
            <a href="/#clientes" data-nav="clientes" onClick={this.onNav} className="h-op50 f-hdr">Marcas</a>
            <a href="/#contato" data-nav="contato" onClick={this.onNav} className="h-op50 f-hdr">Contato</a>
          </nav>
        </header>

        {this.toggleEl(v)}

        <div data-cursor aria-hidden="true" className="cursor">
          <div data-cursor-in className="cursor-in">Ver<br />projeto ↗</div>
        </div>

        <div data-veil aria-hidden="true" className="veil" />

        {v.hasTransition && <div data-tr aria-hidden="true" className="tr" style={{ left: v.trLeft, top: v.trTop, width: v.trW, height: v.trH, clipPath: v.trClip }}>
          <img src={v.trSrc} alt="" className="fill" />
        </div>}

        {v.isHome && <main data-home data-screen-label="Home">
          <div data-exhibit id="projetos" className="exhibit" style={{ height: v.exhibitH }}>
            <div data-stage className="stage">
              {v.showHeroBg && <div data-hero-bg className="hero-bg">
                <Img src={v.heroBg} sizes={this.heroSizes()} alt={v.heroBgAlt} fetchPriority="high" className="fill" />
              </div>}

              <div data-plane="0" className="plane0">
                {this.rowLine(first, 0, { opacity: 0 })}
                <h2 data-row-title="0" className="row-title" style={{ opacity: 0 }}><span data-fit-title className="fit">{first.title}</span></h2>
                {v.stack.map((p: any, i: number) =>
                  <a key={p.mode + p.slug} data-stack={i} href={p.href} onClick={p.open} onMouseEnter={this.cursorOn} onMouseLeave={this.cursorOff} aria-label={p.aria} className="card card-stack f-ink">
                    <span className="card-in">{this.renderCover(p, cardS(p.cover), false)}</span>
                  </a>)}
              </div>

              {v.showHero && <>
                <h1 data-hero-text className="hero-text">
                  <span data-hero-line="0" className="hero-line">Thiago</span>
                  <span data-hero-line="1" className="hero-line" style={{ textAlign: 'right' }}>Araujo.</span>
                </h1>
                <div data-hero-meta className="hero-meta hero-meta-l">
                  <div>Diretor Criativo</div>
                  <div className="mute">São Paulo, Brasil</div>
                </div>
                <div data-hero-meta className="hero-meta hero-meta-r">
                  <div>Direção Criativa</div>
                  <div>Direção de Arte</div>
                  <div>Design</div>
                </div>
                {v.notMobile && <a data-hero-meta href="/#projetos" data-nav="projetos" onClick={this.onNav} className="hero-meta hero-cta h-mute f-ink">Ver projetos <span aria-hidden="true">↓</span></a>}
              </>}
            </div>
          </div>

          <div data-drum className="drum">
            {v.rows.map((p: any) =>
              <section key={p.mode + p.slug} data-row={p.idx} aria-label={p.title} className="drum-row">
                <div data-plane={p.idx} className="plane">
                  {this.rowLine(p, p.idx)}
                  <h2 data-row-title={p.idx} className="row-title"><span data-fit-title className="fit">{p.title}</span></h2>
                  <a data-row-media={p.idx} href={p.href} onClick={p.open} onMouseEnter={this.cursorOn} onMouseLeave={this.cursorOff} aria-label={p.aria} className="card card-row f-ink">
                    {this.renderCover(p, cardS(p.cover), true)}
                  </a>
                </div>
              </section>)}
          </div>

          <section id="sobre" aria-labelledby="sobre-h" className="sec about">
            <div className="sec-head lbl">
              <span id="sobre-h" className="mute">Sobre</span>
              <div className="about-meta"><span>{v.siteName}</span><span className="mute">{v.siteRole}</span></div>
            </div>
            <p className="bio">{v.bio}</p>
          </section>

          <section id="clientes" aria-labelledby="clientes-h" className="sec brands">
            <div className="sec-head lbl">
              <span id="clientes-h" className="mute">Marcas</span>
              <span className="mute" style={{ textAlign: 'right' }}>Com quem já trabalhei, direta ou indiretamente</span>
            </div>
            <div data-logo-belt className="belt">
              <div data-logo-track className="track">
                {v.logoLoop.map((lg: any, i: number) =>
                  <div key={i} className="logo">
                    {lg.isImg && <Img src={lg.src} sizes={lg.sizes} alt={lg.name} loading="lazy" decoding="async" style={{ height: lg.h }} />}
                    {lg.isText && <span style={{ fontSize: lg.fs }}>{lg.text}</span>}
                  </div>)}
              </div>
            </div>
          </section>

          <section id="contato" aria-labelledby="contato-h" className="sec contact">
            <div>
              <div id="contato-h" className="lbl mute">Tem uma ideia?</div>
              <h2>Vamos<br />conversar?</h2>
            </div>
            <div className="contact-foot">
              <div className="contact-links">
                <a href={v.emailHref} className="h-op55 f-ink">E-mail ↗</a>
                <a href={v.linkedinHref} target="_blank" rel="noreferrer" className="h-op55 f-ink">LinkedIn ↗</a>
                <a href={v.instagramHref} target="_blank" rel="noreferrer" className="h-op55 f-ink">Instagram ↗</a>
              </div>
              <span className="lbl mute nw">{v.siteLocation}.</span>
            </div>
          </section>

          {this.footer(v)}
        </main>}

        {v.isCase && <main data-case data-screen-label={'Case: ' + cs.title}>
          <div data-case-hero className="case-hero" style={{ '--pbg': cs.palBg, '--pink': cs.palInk, '--pink2': cs.palInk2, '--pmute': cs.palMute, '--pline': cs.palLine } as CSSProperties}>
            <div aria-hidden="true" className="case-hero-bg" />
            <article data-case-hero-text aria-labelledby="case-h" className="case-hero-text">
              <div className="case-top lbl">
                <span className="mono nw">Projeto {cs.num} / {v.count}</span>
                <span style={{ textAlign: 'right' }}>{cs.sector}</span>
              </div>
              <h1 id="case-h" className="case-h">{cs.titleLines.map((ln: string, i: number) => <span key={i}>{ln}</span>)}</h1>
              {cs.hasTagline && <p className="case-tag">{cs.tagline}</p>}
              <div className="case-facts">
                <div><div className="k">Cliente</div><div>{cs.client}</div></div>
                <div><div className="k">Ano</div><div className="mono">{cs.year}</div></div>
                <div><div className="k">Atuação</div>{cs.role.map((r: string, i: number) => <div key={i}>{r}</div>)}</div>
                <div><div className="k">Categoria</div><div>{cs.category}</div></div>
              </div>
              <div className="case-cue-wrap">
                <a data-case-cue href="#case-media" onClick={this.toMedia} aria-label="Rolar para ver o projeto" className="case-cue lbl h-op60 f-pink">
                  <span>Role para ver o projeto</span>
                  {this.cue()}
                </a>
              </div>
            </article>

            <figure id="case-media" data-case-media className="case-media">
              {cs.heroM.isVideo && <video data-lazy-src={cs.heroM.src} poster={cs.heroM.poster ? pick(cs.heroM.poster, 1600) : undefined} muted loop playsInline preload="none" aria-label={cs.heroM.alt} className="fill" />}
              {cs.heroM.isImage && <Img src={cs.heroM.src} sizes={coverSizes(cs.heroM.src, '100vw', 'min(100vh, max(56.25vw, 60vh))')} alt={cs.heroM.alt} loading="eager" fetchPriority="high" className="fill" />}
            </figure>
          </div>

          <div className="blocks">{cs.blocks.map((b: any, i: number) => this.block(b, i))}</div>

          <section aria-label="Créditos" className="credits">
            {cs.credits.map((c: any, i: number) => <div key={i}><div className="k">{c.role}</div><div>{c.name}</div></div>)}
          </section>

          {v.hasNext && <a data-next href={nx.href} onClick={nx.open} onMouseEnter={this.cursorOn} onMouseLeave={this.cursorOff} aria-label={'Próximo projeto: ' + nx.title} className="next f-inkin">
            <span className="next-top lbl"><span className="mute">Próximo projeto</span>{nx.hasTeaser && <span>{nx.teaser}</span>}</span>
            <span aria-hidden="true" className="next-title"><span data-fit-title className="fit">{nx.title}</span></span>
            <span className="next-card">
              <Img src={nx.posterOrCover} sizes={cardSizes(nx.posterOrCover, NEXT_W)} alt="" loading="lazy" decoding="async" className="fill zoom h-zoom" />
            </span>
            <span className="next-bot lbl">
              <span>{nx.category}</span>
              <span className="mono mute">{nx.num} / {v.count} →</span>
              <span className="mono">{nx.year}</span>
            </span>
          </a>}

          {this.footer(v)}
        </main>}
      </div>
    );
  }
}
