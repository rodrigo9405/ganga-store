/* Ganga Store — núcleo compartido (tienda y panel).
   Sin base de datos: los datos publicados viven en data/store.js dentro del repositorio
   y los borradores del panel se guardan en el navegador (IndexedDB). */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});
  const TZ = 'America/Argentina/Buenos_Aires';
  GS.TZ = TZ;

  /* ---------- utilidades ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  GS.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  GS.uid = (p) => (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  GS.slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  GS.clone = (o) => JSON.parse(JSON.stringify(o));
  const fmtARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  GS.precio = (n) => fmtARS.format(Math.round(Number(n) || 0));
  GS.num = (n) => new Intl.NumberFormat('es-AR').format(Math.round(Number(n) || 0));
  GS.compacto = (n) => new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
  GS.$ = (sel, root) => (root || document).querySelector(sel);
  GS.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  GS.pad = (n) => String(n).padStart(2, '0');

  /* ---------- fechas en hora argentina ---------- */
  const partsFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
  });
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  GS.ahora = () => (GS._ahoraFija ? new Date(GS._ahoraFija) : new Date());
  GS.arParts = (date) => {
    const o = {};
    for (const p of partsFmt.formatToParts(date || GS.ahora())) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, s: +o.second, dow: WD[o.weekday] };
  };
  GS.key = (y, m, d) => `${y}-${GS.pad(m)}-${GS.pad(d)}`;
  GS.hoyKey = (date) => { const p = GS.arParts(date); return GS.key(p.y, p.m, p.d); };
  GS.keyToUTC = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  GS.utcToKey = (dt) => GS.key(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  GS.sumarDias = (k, n) => { const dt = GS.keyToUTC(k); dt.setUTCDate(dt.getUTCDate() + n); return GS.utcToKey(dt); };
  GS.inicioDia = (k) => new Date(k + 'T00:00:00-03:00');
  GS.finDia = (k) => new Date(k + 'T23:59:59-03:00');
  GS.fechaLarga = (k, opts) => new Intl.DateTimeFormat('es-AR', Object.assign({ timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }, opts || {})).format(GS.keyToUTC(k));
  GS.fechaCorta = (k) => { const [, m, d] = k.split('-'); return `${+d}/${+m}`; };
  GS.fechaHora = (iso) => new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  GS.diaSemana = (k) => new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'short' }).format(GS.keyToUTC(k)).replace('.', '');
  GS.mesCorto = (m) => new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', month: 'short' }).format(new Date(Date.UTC(2020, m - 1, 1))).replace('.', '');
  GS.mesLargo = (m) => new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', month: 'long' }).format(new Date(Date.UTC(2020, m - 1, 1)));
  GS.restante = (hasta) => {
    const ms = Math.max(0, hasta - GS.ahora());
    const s = Math.floor(ms / 1000);
    return { total: ms, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  };

  /* ---------- horario de atención ---------- */
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  GS.DIAS = DIAS;
  const aMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  GS.estadoHorario = (settings) => {
    const hours = (settings && settings.hours) || [];
    if (!hours.length) return null;
    const p = GS.arParts();
    const nowMin = p.h * 60 + p.min;
    const hoy = hours.filter((r) => r.days.includes(p.dow));
    for (const r of hoy) {
      if (nowMin >= aMin(r.open) && nowMin < aMin(r.close)) return { abierto: true, texto: `Abierto ahora, hasta las ${r.close}` };
    }
    for (let i = 0; i < 8; i++) {
      const dow = (p.dow + i) % 7;
      const rs = hours.filter((r) => r.days.includes(dow)).sort((a, b) => aMin(a.open) - aMin(b.open));
      for (const r of rs) {
        if (i === 0 && aMin(r.open) <= nowMin) continue;
        const cuando = i === 0 ? 'hoy' : i === 1 ? 'mañana' : 'el ' + DIAS[dow];
        return { abierto: false, texto: `Cerrado. Abrimos ${cuando} a las ${r.open}` };
      }
    }
    return { abierto: false, texto: 'Cerrado' };
  };
  GS.horarioTexto = (settings) => {
    const hours = (settings && settings.hours) || [];
    return hours.map((r) => {
      const ds = [...r.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      const nom = (d) => DIAS[d].charAt(0).toUpperCase() + DIAS[d].slice(1);
      let txt;
      const consecutivos = ds.every((d, i) => i === 0 || ((ds[i - 1] + 1) % 7) === d);
      if (ds.length > 2 && consecutivos) txt = `${nom(ds[0])} a ${DIAS[ds[ds.length - 1]]}`;
      else txt = ds.map((d, i) => (i ? DIAS[d] : nom(d))).join(', ').replace(/, ([^,]+)$/, ' y $1');
      return { dias: txt, horas: `${r.open} a ${r.close}` };
    });
  };

  /* ---------- promociones y precios ---------- */
  GS.promoEstado = (p) => {
    if (!p.active) return 'pausada';
    const now = GS.ahora();
    if (now < GS.inicioDia(p.start)) return 'programada';
    if (now > GS.finDia(p.end)) return 'finalizada';
    return 'activa';
  };
  GS.promosActivas = (data) => (data.promotions || []).filter((p) => GS.promoEstado(p) === 'activa')
    .sort((a, b) => GS.finDia(a.end) - GS.finDia(b.end));
  GS.promoDeProducto = (data, pid) => {
    let best = null;
    for (const p of GS.promosActivas(data)) {
      if ((p.productIds || []).includes(pid) && (!best || p.discount > best.discount)) best = p;
    }
    return best;
  };
  GS.precioDe = (data, prod) => {
    const promo = GS.promoDeProducto(data, prod.id);
    const original = Number(prod.price) || 0;
    if (!promo || !promo.discount) return { final: original, original, promo: null };
    return { final: Math.round(original * (1 - promo.discount / 100)), original, promo };
  };
  GS.productosVisibles = (data) => (data.products || []).filter((p) => p.visible !== false);
  GS.categoria = (data, id) => (data.categories || []).find((c) => c.id === id);
  GS.categoriasOrdenadas = (data) => [...(data.categories || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  GS.primeraImagen = (prod) => {
    for (const c of prod.colors || []) if (c.images && c.images[0]) return c.images[0];
    return '';
  };

  /* ---------- redes y contacto ---------- */
  GS.limpiarNumero = (n) => String(n || '').replace(/[^\d]/g, '');
  GS.waLink = (num, texto) => `https://wa.me/${GS.limpiarNumero(num)}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
  const handle = (v) => String(v || '').trim().replace(/^@/, '');
  const urlDe = (v, base) => {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return base + handle(v).replace(/^\/+/, '');
  };
  GS.redes = (s) => {
    s = s || {};
    const out = [];
    if (s.whatsapp) out.push({ id: 'whatsapp', label: 'WhatsApp', detalle: s.phone || '+' + GS.limpiarNumero(s.whatsapp), url: GS.waLink(s.whatsapp, `Hola ${s.storeName || ''}! Quería hacer una consulta.`), icon: 'chat' });
    if (s.instagram) out.push({ id: 'instagram', label: 'Instagram', detalle: /^https?:/i.test(s.instagram) ? 'Ver perfil' : '@' + handle(s.instagram), url: urlDe(s.instagram, 'https://www.instagram.com/'), icon: 'camera' });
    if (s.facebook) out.push({ id: 'facebook', label: 'Facebook', detalle: /^https?:/i.test(s.facebook) ? 'Ver página' : handle(s.facebook), url: urlDe(s.facebook, 'https://www.facebook.com/'), icon: 'people' });
    if (s.tiktok) out.push({ id: 'tiktok', label: 'TikTok', detalle: /^https?:/i.test(s.tiktok) ? 'Ver perfil' : '@' + handle(s.tiktok), url: urlDe(s.tiktok, 'https://www.tiktok.com/@'), icon: 'note' });
    if (s.phone) {
      const tel = GS.limpiarNumero(s.phone).replace(/^0/, '');
      const wa = GS.limpiarNumero(s.whatsapp);
      // Si el teléfono es el mismo número del WhatsApp, usamos el formato internacional completo (+54 9 …)
      const destino = wa && tel && wa.endsWith(tel) ? '+' + wa : (tel.startsWith('54') ? '+' + tel : '+54' + tel);
      out.push({ id: 'telefono', label: 'Llamar', detalle: s.phone, url: 'tel:' + destino, icon: 'phone' });
    }
    if (s.email) out.push({ id: 'email', label: 'Email', detalle: s.email, url: 'mailto:' + s.email, icon: 'mail' });
    if (s.address || s.mapsUrl) out.push({ id: 'mapa', label: 'Cómo llegar', detalle: s.address || 'Ver en el mapa', url: s.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.address), icon: 'pin' });
    return out;
  };

  /* ---------- íconos (genéricos, trazo fino) ---------- */
  const I = {
    menu: '<path d="M3 7h18M3 12h18M3 17h18"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chat: '<path d="M4 19.5l1.3-3.9A8 8 0 1 1 8.6 19z"/><path d="M9.2 9.3c.3 2.4 2.1 4.4 4.6 5l1-1.1 2 .8-.4 1.6c-3.9.2-7.6-3.3-7.7-7.2l1.6-.4.8 2z"/>',
    camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
    people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.2c2.2.1 3.9 1.6 4.4 4.3"/>',
    note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    phone: '<path d="M5 4h4l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v4c0 .6-.4 1-1 1A16 16 0 0 1 4 5c0-.6.4-1 1-1z"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13"/><path d="M4 6.5l8 6 8-6"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    share: '<circle cx="6" cy="12" r="2.3"/><circle cx="17.5" cy="6" r="2.3"/><circle cx="17.5" cy="18" r="2.3"/><path d="M8 11l7.5-4M8 13l7.5 4"/>',
    left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    up: '<path d="M6 14.5L12 8l6 6.5"/>',
    down: '<path d="M6 9.5l6 6.5 6-6.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M4 4l16 16M10 6c.7-.2 1.3-.5 2-.5 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.6 7.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    tag: '<path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8.5" r="1.4"/>',
    box: '<path d="M4 7.5L12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M4 7.5l8 3.5 8-3.5M12 11v9"/>',
    grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    users: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v4h16v-4"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.6a4.5 4.5 0 0 1-.5 8.9z"/><path d="M12 15.5V11M9.8 13l2.2-2.2 2.2 2.2"/>',
    star: '<path d="M12 3.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    logout: '<path d="M14 4H5v16h9M10 12h10M16.5 8.5L20 12l-3.5 3.5"/>',
    store: '<path d="M4 9.5L5.5 4h13L20 9.5M4 9.5h16M4 9.5c0 1.6 1.3 2.5 2.7 2.5S9.3 11 9.3 9.5c0 1.5 1.2 2.5 2.7 2.5s2.7-1 2.7-2.5c0 1.5 1.2 2.5 2.6 2.5S20 11.1 20 9.5M5.5 12v8h13v-8"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    key: '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M15.5 7.5L18 10"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17v.5"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  };
  GS.icon = (name, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${I[name] || ''}</svg>`;

  /* ---------- almacenamiento local (IndexedDB) ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('ganga-store', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  };
  GS.idb = {
    get: (k) => tx('readonly', (s) => s.get(k)).catch(() => undefined),
    set: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    del: (k) => tx('readwrite', (s) => s.delete(k)),
  };
  GS.ls = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } },
  };

  /* Imágenes subidas que todavía no están publicadas: se guardan como data URL y
     después de publicar se recuerdan por su ruta mientras GitHub Pages se actualiza. */
  GS.imgCache = {};
  GS.img = (src) => (src && GS.imgCache[src]) || src || '';

  /* ---------- carga de datos publicados ---------- */
  GS.cargarScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
  GS.cargarPublicado = async () => {
    delete window.GANGA_STORE;
    await GS.cargarScript('data/store.js?v=' + Date.now());
    if (!window.GANGA_STORE) throw new Error('Los datos de la tienda están vacíos o dañados.');
    return GS.clone(window.GANGA_STORE);
  };
  /* Las cuentas del equipo van en un archivo aparte que la tienda nunca descarga
     (en Cloudflare se puede proteger con Access junto con el panel). */
  GS.cargarCuentas = async () => {
    delete window.GANGA_CUENTAS;
    try { await GS.cargarScript('data/cuentas.js?v=' + Date.now()); } catch (e) { return null; }
    return window.GANGA_CUENTAS && Array.isArray(window.GANGA_CUENTAS.accounts) ? GS.clone(window.GANGA_CUENTAS.accounts) : null;
  };
  /* Si la tienda tiene dominio propio, quien entre por la dirección técnica
     (pages.dev, workers.dev o github.io) pasa al dominio de la marca. */
  GS.irADominioPropio = (settings) => {
    const dom = String((settings && settings.domain) || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (!dom || location.hostname === dom) return false;
    if (!/\.(pages|workers)\.dev$|\.github\.io$/.test(location.hostname)) return false;
    const archivo = location.pathname.split('/').pop();
    location.replace('https://' + dom + '/' + (archivo && archivo !== 'index.html' ? archivo : '') + location.search + location.hash);
    return true;
  };
  GS.normalizar = (d) => {
    d.settings = d.settings || {};
    ['categories', 'products', 'promotions', 'accounts'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    d.products.forEach((p) => { p.colors = p.colors || []; p.sizes = p.sizes || []; p.colors.forEach((c) => { c.images = c.images || []; }); });
    return d;
  };
})();
