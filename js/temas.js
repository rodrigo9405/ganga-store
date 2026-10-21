/* Ganga Store — diseños por temporada según el calendario argentino.
   La tienda elige sola el diseño del día (hora de Buenos Aires).
   Desde el panel se puede forzar un diseño o dejarlo siempre minimalista. */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});

  /* ---------- calendario ---------- */
  function pascua(y) { // algoritmo gregoriano anónimo
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return GS.key(y, mes, dia);
  }
  function tercerDomingo(y, m) {
    const primero = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return GS.key(y, m, 1 + ((7 - primero) % 7) + 14);
  }
  const k = GS.key;

  /* Orden = prioridad cuando dos fechas se superponen (ej. Día del Padre y 20 de Junio). */
  function eventos(y) {
    const p = pascua(y), madre = tercerDomingo(y, 10), padre = tercerDomingo(y, 6), ninez = tercerDomingo(y, 8);
    const domingo = (key) => `domingo ${GS.fechaCorta(key)}`;
    return [
      { id: 'madre', desde: GS.sumarDias(madre, -7), hasta: madre, msg: `Día de la Madre: ${domingo(madre)}. Elegí su regalo.` },
      { id: 'padre', desde: GS.sumarDias(padre, -7), hasta: padre, msg: `Día del Padre: ${domingo(padre)}. Regalale estilo.` },
      { id: 'ninez', desde: GS.sumarDias(ninez, -7), hasta: ninez, msg: `Día de las Infancias: ${domingo(ninez)}.` },
      { id: 'carnaval', desde: GS.sumarDias(p, -50), hasta: GS.sumarDias(p, -47), msg: 'Carnaval: sumale color a tu look.' },
      { id: 'pascuas', desde: GS.sumarDias(p, -3), hasta: p, msg: 'Felices Pascuas de parte de todo el equipo.' },
      { id: 'navidad', desde: k(y, 12, 1), hasta: k(y, 12, 25), msg: 'Felices fiestas. Encontrá acá el regalo de Navidad.' },
      { id: 'anonuevo', desde: k(y, 12, 26), hasta: k(y, 12, 31), msg: `Brindamos por un ${y + 1} con mucho estilo.` },
      { id: 'anonuevo', desde: k(y, 1, 1), hasta: k(y, 1, 6), msg: `¡Feliz ${y}! Arrancá el año con ropa nueva.` },
      { id: 'sanvalentin', desde: k(y, 2, 8), hasta: k(y, 2, 14), msg: 'San Valentín, el 14 de febrero. Regalá algo que se note.' },
      { id: 'patrio', desde: k(y, 5, 22), hasta: k(y, 5, 25), msg: '25 de Mayo. ¡Viva la Patria!' },
      { id: 'patrio', desde: k(y, 6, 17), hasta: k(y, 6, 20), msg: '20 de Junio, Día de la Bandera.' },
      { id: 'patrio', desde: k(y, 7, 6), hasta: k(y, 7, 9), msg: '9 de Julio, Día de la Independencia.' },
      { id: 'amigo', desde: k(y, 7, 14), hasta: k(y, 7, 20), msg: 'Feliz Día del Amigo, el 20 de julio.' },
      { id: 'primavera', desde: k(y, 9, 14), hasta: k(y, 9, 23), msg: 'Llegó la primavera. Renová tu placard.' },
      { id: 'halloween', desde: k(y, 10, 20), hasta: k(y, 10, 31), msg: 'Halloween en Ganga Store.' },
    ];
  }

  GS.TEMAS = {
    minimal: { nombre: 'Minimalista', desc: 'Diseño base: blanco, negro y dorado.' },
    navidad: { nombre: 'Navidad', desc: 'Del 1 al 25 de diciembre.' },
    anonuevo: { nombre: 'Año Nuevo', desc: 'Del 26 de diciembre al 6 de enero (Reyes).' },
    sanvalentin: { nombre: 'San Valentín', desc: 'Del 8 al 14 de febrero.' },
    carnaval: { nombre: 'Carnaval', desc: 'Sábado a martes de Carnaval (fecha móvil).' },
    pascuas: { nombre: 'Pascuas', desc: 'Jueves Santo a Domingo de Pascua (fecha móvil).' },
    patrio: { nombre: 'Fechas patrias', desc: '25 de Mayo, 20 de Junio y 9 de Julio.' },
    padre: { nombre: 'Día del Padre', desc: 'Semana previa al tercer domingo de junio.' },
    amigo: { nombre: 'Día del Amigo', desc: 'Del 14 al 20 de julio.' },
    ninez: { nombre: 'Día de las Infancias', desc: 'Semana previa al tercer domingo de agosto.' },
    primavera: { nombre: 'Primavera', desc: 'Del 14 al 23 de septiembre.' },
    madre: { nombre: 'Día de la Madre', desc: 'Semana previa al tercer domingo de octubre.' },
    halloween: { nombre: 'Halloween', desc: 'Del 20 al 31 de octubre.' },
  };

  GS.temaEnFecha = (key) => {
    const y = +key.slice(0, 4);
    for (const ev of eventos(y)) if (key >= ev.desde && key <= ev.hasta) return ev;
    return { id: 'minimal', msg: '' };
  };
  GS.calendarioTemas = (y) => {
    const evs = eventos(y).filter((e) => !(e.id === 'anonuevo' && e.desde.slice(5) === '01-01'));
    return evs.sort((a, b) => a.desde.localeCompare(b.desde));
  };
  /* Devuelve el tema que corresponde hoy según la configuración */
  GS.temaActual = (settings) => {
    const modo = (settings && settings.themeMode) || 'auto';
    const hoy = GS.hoyKey();
    const auto = GS.temaEnFecha(hoy);
    if (modo === 'auto') return { id: auto.id, msg: auto.msg, hasta: auto.hasta, auto: true };
    if (modo === 'minimal' || modo === 'off') return { id: 'minimal', msg: '', auto: false };
    if (GS.TEMAS[modo]) {
      const y = +hoy.slice(0, 4);
      const ev = eventos(y).find((e) => e.id === modo) || {};
      return { id: modo, msg: ev.msg || '', auto: false };
    }
    return { id: 'minimal', msg: '', auto: false };
  };

  /* ---------- decoraciones (SVG) ---------- */
  const W = 1600; // ancho de la guirnalda; se recorta al centro en pantallas chicas
  const svg = (vb, body, cls) => `<svg class="${cls || ''}" viewBox="${vb}" preserveAspectRatio="${vb === '0 0 380 300' ? 'xMaxYMin meet' : 'xMidYMin slice'}" aria-hidden="true" focusable="false">${body}</svg>`;
  const rnd = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  const corazon = (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 3C-2-2-9-1-9 4c0 5 9 10 9 10s9-5 9-10c0-5-7-6-9-1z" fill="${c}"/>`;
  const flor = (x, y, r, c, centro) => {
    let p = '';
    for (let i = 0; i < 5; i++) {
      const a = (i * 72 - 90) * Math.PI / 180;
      p += `<ellipse cx="${(x + Math.cos(a) * r).toFixed(1)}" cy="${(y + Math.sin(a) * r).toFixed(1)}" rx="${r * 0.72}" ry="${r * 0.5}" transform="rotate(${i * 72} ${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)})" fill="${c}"/>`;
    }
    return p + `<circle cx="${x}" cy="${y}" r="${r * 0.42}" fill="${centro}"/>`;
  };
  const hoja = (x, y, s, rot, c) => `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0C6-8 18-8 24 0 18 8 6 8 0 0z" fill="${c}"/>`;
  const banderines = (colores, alto) => {
    let b = `<path d="M0 3 Q${W / 2} 10 ${W} 3" stroke="currentColor" stroke-opacity=".35" fill="none"/>`;
    for (let x = 8, i = 0; x < W; x += 34, i++) {
      const y = 3 + 7 * (1 - Math.pow((x - W / 2) / (W / 2), 2));
      b += `<path class="bnd" style="animation-delay:${(i % 7) * 0.2}s" d="M${x} ${y.toFixed(1)} L${x + 24} ${y.toFixed(1)} L${x + 12} ${(y + alto).toFixed(1)} Z" fill="${colores[i % colores.length]}"/>`;
    }
    return b;
  };
  const fila = (paso, fn) => { let b = ''; for (let x = paso / 2, i = 0; x < W; x += paso, i++) b += fn(x, i); return b; };

  const DECOR = {
    navidad() {
      const cols = ['#b3202a', '#d9b45a', '#2f6b45', '#e8e0c8'];
      let g = '';
      for (let x = 0; x < W; x += 44) g += `<path d="M${x} 2 Q${x + 22} 14 ${x + 44} 2" stroke="#2f4a35" stroke-width="1.4" fill="none"/>`;
      g += fila(44, (x, i) => `<g class="tw" style="animation-delay:${(i % 5) * 0.37}s"><rect x="${x - 2.5}" y="7" width="5" height="4" fill="#3b3b3b"/><ellipse cx="${x}" cy="16" rx="4.6" ry="6.5" fill="${cols[i % 4]}"/></g>`);
      let h = '';
      [[60, 80, '#b3202a', 26], [150, 140, '#d9b45a', 32], [235, 60, '#2f6b45', 22], [300, 120, '#b3202a', 18]].forEach(([x, l, c, r]) => {
        h += `<line x1="${x}" y1="0" x2="${x}" y2="${l}" stroke="#a7894b" stroke-width="1.2"/><rect x="${x - 6}" y="${l - 2}" width="12" height="8" fill="#a7894b"/>`;
        h += `<circle cx="${x}" cy="${l + 6 + r}" r="${r}" fill="${c}"/><ellipse cx="${x - r * 0.35}" cy="${l + 6 + r * 0.6}" rx="${r * 0.28}" ry="${r * 0.18}" fill="#fff" opacity=".45"/>`;
        h += `<path d="M${x - r} ${l + 6 + r} Q${x} ${l + 6 + r * 1.4} ${x + r} ${l + 6 + r}" stroke="#fff" stroke-opacity=".35" fill="none"/>`;
      });
      h += `<path class="tw" transform="translate(340 40)" d="M0-22L6-6 22-6 9 4 14 20 0 10-14 20-9 4-22-6-6-6z" fill="#d9b45a"/>`;
      return { guirnalda: svg(`0 0 ${W} 26`, g), hero: svg('0 0 380 300', h) };
    },
    anonuevo() {
      const g = fila(26, (x, i) => i % 3 === 0
        ? `<path class="tw" style="animation-delay:${(i % 6) * 0.3}s" transform="translate(${x} 9)" d="M0-6L1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5z" fill="#d9b45a"/>`
        : `<circle cx="${x}" cy="9" r="1.4" fill="#d9b45a" opacity=".7"/>`);
      let h = '';
      [[120, 110, 70], [290, 70, 48], [250, 210, 36]].forEach(([cx, cy, r], j) => {
        for (let i = 0; i < 16; i++) {
          const a = (i * 22.5) * Math.PI / 180;
          h += `<line class="fw" style="animation-delay:${j * 0.6}s" x1="${(cx + Math.cos(a) * r * 0.3).toFixed(1)}" y1="${(cy + Math.sin(a) * r * 0.3).toFixed(1)}" x2="${(cx + Math.cos(a) * r).toFixed(1)}" y2="${(cy + Math.sin(a) * r).toFixed(1)}" stroke="${i % 2 ? '#d9b45a' : '#f4e7c4'}" stroke-width="2" stroke-linecap="round"/>`;
        }
      });
      const r = rnd(7);
      for (let i = 0; i < 26; i++) h += `<rect x="${(r() * 380).toFixed(0)}" y="${(r() * 300).toFixed(0)}" width="4" height="9" transform="rotate(${(r() * 180).toFixed(0)})" fill="${i % 2 ? '#d9b45a' : '#efe1bb'}" opacity=".7"/>`;
      return { guirnalda: svg(`0 0 ${W} 18`, g), hero: svg('0 0 380 300', h) };
    },
    halloween() {
      const g = banderines(['#e8761b', '#5b2a86', '#1a1412'], 18);
      const bat = (x, y, s, d) => `<g class="bat" style="animation-delay:${d}s"><path transform="translate(${x} ${y}) scale(${s})" d="M0 0c-6-8-16-10-26-6 5 2 7 6 6 10-4-3-9-3-12 0 6 1 9 5 9 9 6-6 15-8 23-7-2-3-2-6 0-6 2 0 2 3 0 6 8-1 17 1 23 7 0-4 3-8 9-9-3-3-8-3-12 0-1-4 1-8 6-10C16-10 6-8 0 0z" fill="#4a2f63"/></g>`;
      let h = `<circle cx="250" cy="110" r="78" fill="#f3d9a4" opacity=".95"/><circle cx="250" cy="110" r="98" fill="#f3d9a4" opacity=".12"/>`;
      h += `<circle cx="226" cy="92" r="12" fill="#e2c288"/><circle cx="276" cy="134" r="16" fill="#e2c288"/><circle cx="270" cy="80" r="6" fill="#e2c288"/>`;
      h += bat(120, 70, 1.1, 0) + bat(330, 200, 0.8, 0.8) + bat(190, 210, 0.6, 1.6);
      return { guirnalda: svg(`0 0 ${W} 24`, g, 'c-halloween'), hero: svg('0 0 380 300', h) };
    },
    patrio() {
      const g = `<rect width="${W}" height="4" fill="#75aadb"/><rect y="4" width="${W}" height="4" fill="#fff"/><rect y="8" width="${W}" height="4" fill="#75aadb"/>`;
      let h = '';
      const cx = 240, cy = 120;
      for (let i = 0; i < 32; i++) {
        const a = (i * 11.25) * Math.PI / 180, r1 = 46, r2 = i % 2 ? 96 : 84;
        if (i % 2) h += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="#d9a72b" stroke-width="3" stroke-linecap="round"/>`;
        else {
          const pts = [];
          for (let t = 0; t <= 1; t += 0.125) { const rr = r1 + (r2 - r1) * t; const off = Math.sin(t * Math.PI * 3) * 0.05; pts.push(`${(cx + Math.cos(a + off) * rr).toFixed(1)} ${(cy + Math.sin(a + off) * rr).toFixed(1)}`); }
          h += `<polyline points="${pts.join(' ')}" stroke="#d9a72b" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
        }
      }
      h += `<circle cx="${cx}" cy="${cy}" r="40" fill="#e9b93a"/><circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="#c48d1e" stroke-width="2"/>`;
      h += `<circle cx="80" cy="220" r="36" fill="#75aadb"/><circle cx="80" cy="220" r="24" fill="#fff"/><circle cx="80" cy="220" r="12" fill="#75aadb"/>`;
      h += `<path d="M66 252 L58 296 L72 284 L80 298 L80 254 Z M94 252 L102 296 L88 284 L80 298 L80 254 Z" fill="#75aadb"/>`;
      return { guirnalda: svg(`0 0 ${W} 12`, g), hero: svg('0 0 380 300', h) };
    },
    madre() {
      const cols = ['#e7a3ad', '#c96b7c', '#f2cfc8'];
      const g = fila(40, (x, i) => flor(x, 12, 4.2, cols[i % 3], '#d9b45a') + hoja(x + 10, 13, 0.45, -20, '#8aa77b'));
      let h = flor(260, 90, 34, '#e7a3ad', '#d9b45a') + flor(170, 170, 24, '#c96b7c', '#f2d7a0') + flor(320, 200, 20, '#f2cfc8', '#d9b45a');
      h += hoja(200, 100, 2.2, 30, '#8aa77b') + hoja(300, 140, 1.8, 110, '#a4bd92') + hoja(130, 210, 1.6, -40, '#8aa77b');
      return { guirnalda: svg(`0 0 ${W} 24`, g), hero: svg('0 0 380 300', h) };
    },
    padre() {
      let g = '';
      for (let x = -20; x < W; x += 16) g += `<path d="M${x} 12 L${x + 12} 0 L${x + 18} 0 L${x + 6} 12 Z" fill="${(x / 16) % 2 ? '#c9a45c' : '#1f3354'}"/>`;
      let h = '<defs><clipPath id="cp-padre"><circle cx="250" cy="130" r="110"/></clipPath></defs><g clip-path="url(#cp-padre)">';
      for (let x = 100; x < 420; x += 34) h += `<path d="M${x} 0 L${x + 24} 0 L${x - 176} 300 L${x - 200} 300 Z" fill="${(x / 34) % 2 ? '#1f3354' : '#c9a45c'}" opacity=".9"/>`;
      h += '</g><circle cx="250" cy="130" r="110" fill="none" stroke="#c9a45c" stroke-width="2"/>';
      return { guirnalda: svg(`0 0 ${W} 12`, g), hero: svg('0 0 380 300', h) };
    },
    amigo() {
      const g = fila(30, (x, i) => `<circle cx="${x}" cy="9" r="7" fill="none" stroke="${i % 2 ? '#1f7a72' : '#d9b45a'}" stroke-width="2"/>`);
      const h = `<circle cx="210" cy="140" r="84" fill="#1f7a72" opacity=".85"/><circle cx="290" cy="140" r="84" fill="#d9b45a" opacity=".75"/>` + corazon(250, 128, 2.2, '#fff');
      return { guirnalda: svg(`0 0 ${W} 18`, g), hero: svg('0 0 380 300', h) };
    },
    ninez() {
      const cols = ['#e2574c', '#f6b73c', '#3c9ee2', '#59b36b', '#9a62d1'];
      const g = banderines(cols, 16);
      let h = '';
      [[140, 90, 0], [210, 60, 1], [280, 100, 2], [190, 140, 3], [330, 150, 4]].forEach(([x, y, i]) => {
        h += `<path d="M${x} ${y + 44} Q${x - 10} ${y + 110} ${200 + i * 6} 290" stroke="#8a8378" stroke-width="1.2" fill="none"/>`;
        h += `<g class="globo" style="animation-delay:${i * 0.5}s"><ellipse cx="${x}" cy="${y}" rx="34" ry="42" fill="${cols[i]}"/><ellipse cx="${x - 12}" cy="${y - 16}" rx="7" ry="11" fill="#fff" opacity=".4"/><path d="M${x - 5} ${y + 42} L${x + 5} ${y + 42} L${x} ${y + 48}Z" fill="${cols[i]}"/></g>`;
      });
      return { guirnalda: svg(`0 0 ${W} 22`, g), hero: svg('0 0 380 300', h) };
    },
    primavera() {
      const g = `<path d="M0 8 Q${W / 4} 2 ${W / 2} 8 T${W} 8" stroke="#7a9a5a" stroke-width="1.4" fill="none"/>` +
        fila(48, (x, i) => (i % 2 ? hoja(x, 8, 0.5, -30, '#8bb06a') : flor(x, 9, 3.6, ['#f3b6c4', '#f6dd84', '#c9b6ea'][i % 3], '#f6a93b')));
      let h = '';
      const r = rnd(3);
      for (let i = 0; i < 9; i++) h += flor(130 + r() * 220, 40 + r() * 220, 10 + r() * 18, ['#f3b6c4', '#f6dd84', '#c9b6ea', '#fff'][i % 4], '#f6a93b');
      for (let i = 0; i < 7; i++) h = hoja(130 + r() * 220, 40 + r() * 220, 1 + r(), r() * 360, i % 2 ? '#8bb06a' : '#a9c98a') + h;
      return { guirnalda: svg(`0 0 ${W} 18`, g), hero: svg('0 0 380 300', h) };
    },
    pascuas() {
      const cols = ['#c9b6ea', '#f3c6a5', '#a9d6c5', '#f6dd84'];
      const huevo = (x, y, s, c, i) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0-14C7-14 11-2 11 4 11 11 6 15 0 15S-11 11-11 4C-11-2-7-14 0-14z" fill="${c}"/><path d="M-10.5 2 L-7 -1 -3.5 2 0 -1 3.5 2 7 -1 10.5 2" stroke="#fff" stroke-width="${1.6 / s * 2}" fill="none" opacity="${i % 2 ? 0.8 : 0}"/><circle cx="-4" cy="8" r="1.6" fill="#fff" opacity="${i % 2 ? 0 : 0.8}"/><circle cx="4" cy="8" r="1.6" fill="#fff" opacity="${i % 2 ? 0 : 0.8}"/></g>`;
      const g = fila(36, (x, i) => huevo(x, 11, 0.55, cols[i % 4], i));
      const h = huevo(200, 160, 4.2, cols[0], 1) + huevo(290, 190, 3.4, cols[1], 0) + huevo(260, 90, 2.6, cols[2], 1);
      return { guirnalda: svg(`0 0 ${W} 22`, g), hero: svg('0 0 380 300', h) };
    },
    carnaval() {
      const cols = ['#d6336c', '#f6b73c', '#2bb3a3', '#5b5fd6', '#f26b38'];
      const g = banderines(cols, 16);
      let h = '';
      const r = rnd(11);
      for (let i = 0; i < 40; i++) {
        const x = 110 + r() * 270, y = r() * 300, c = cols[i % 5];
        h += i % 3 ? `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(2 + r() * 4).toFixed(1)}" fill="${c}"/>` : `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="6" height="12" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${c}"/>`;
      }
      h += `<path d="M140 40 C200 10 220 90 260 60 S330 20 360 80" stroke="#d6336c" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M160 250 C190 200 240 270 270 220 S330 200 350 240" stroke="#2bb3a3" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      return { guirnalda: svg(`0 0 ${W} 22`, g), hero: svg('0 0 380 300', h) };
    },
    sanvalentin() {
      const g = fila(32, (x, i) => corazon(x, 5, 0.6, i % 2 ? '#b3243b' : '#e7a3ad'));
      const h = corazon(250, 80, 6, '#b3243b') + corazon(170, 170, 3.4, '#e7a3ad') + corazon(320, 190, 2.4, '#d9b45a');
      return { guirnalda: svg(`0 0 ${W} 18`, g), hero: svg('0 0 380 300', h) };
    },
  };

  /* Aplica el tema al documento. Espera los contenedores .tema-guirnalda, .tema-hero y #temaCinta (opcionales). */
  GS.aplicarTema = (tema) => {
    const id = tema && GS.TEMAS[tema.id] ? tema.id : 'minimal';
    document.documentElement.setAttribute('data-tema', id);
    const dec = DECOR[id] ? DECOR[id]() : null;
    GS.$$('.tema-guirnalda').forEach((el) => { el.innerHTML = dec ? dec.guirnalda : ''; });
    GS.$$('.tema-hero').forEach((el) => { el.innerHTML = dec ? dec.hero : ''; });
    return id;
  };
  GS.decorTema = (id) => (DECOR[id] ? DECOR[id]() : null);
})();
