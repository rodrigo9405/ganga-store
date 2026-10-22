/* Ganga Store — guardado en GitHub.
   El repositorio funciona como "base de datos": cada vez que se guarda un cambio en el panel
   se crea un commit con data/store.js, data/cuentas.js y las fotos nuevas en img/subidas/.
   El hosting conectado al repositorio actualiza la tienda en uno o dos minutos.
   El acceso a GitHub es un token: se guarda cifrado con la contraseña de cada cuenta
   (así nadie tiene que configurarlo en su dispositivo) y nunca queda legible en el repositorio. */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});
  const API = 'https://api.github.com';
  const CLAVE = 'gs_github';
  const CLAVE_SES = 'gs_github_ses';
  // Repositorio de la tienda
  const PREDETERMINADO = { owner: 'rodrigo9405', repo: 'ganga-store' };

  const G = (GS.github = {});
  let tokenSesion = '';
  try { tokenSesion = sessionStorage.getItem(CLAVE_SES) || ''; } catch (e) { /* sin almacenamiento */ }

  G.config = () => {
    const c = GS.ls.get(CLAVE, {}) || {};
    const auto = G.detectar();
    return { owner: c.owner || auto.owner || PREDETERMINADO.owner, repo: c.repo || auto.repo || PREDETERMINADO.repo, branch: c.branch || 'main', token: tokenSesion || c.token || '' };
  };
  G.guardarConfig = (c) => {
    const prev = GS.ls.get(CLAVE, {}) || {};
    GS.ls.set(CLAVE, { owner: (c.owner || '').trim(), repo: (c.repo || '').trim(), branch: (c.branch || 'main').trim(), token: c.token === undefined ? prev.token || '' : String(c.token).trim() });
  };
  /* Usa un token para esta sesión; si `recordar`, también queda en este dispositivo */
  G.usarToken = (tok, recordar) => {
    tokenSesion = String(tok || '').trim();
    try { if (tokenSesion) sessionStorage.setItem(CLAVE_SES, tokenSesion); else sessionStorage.removeItem(CLAVE_SES); } catch (e) { /* nada */ }
    if (recordar) G.guardarConfig(Object.assign(G.config(), { token: tokenSesion }));
  };
  G.olvidarToken = () => {
    tokenSesion = '';
    try { sessionStorage.removeItem(CLAVE_SES); } catch (e) { /* nada */ }
    G.guardarConfig(Object.assign(G.config(), { token: '' }));
  };
  G.configurado = () => { const c = G.config(); return !!(c.owner && c.repo && c.token); };
  /* Si la tienda corre en usuario.github.io/repositorio, completa los datos solos */
  G.detectar = () => {
    const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!m) return {};
    const seg = location.pathname.split('/').filter(Boolean)[0];
    const repo = seg && !/\.html?$/.test(seg) ? seg : `${m[1]}.github.io`;
    return { owner: m[1], repo };
  };
  G.urlTienda = (settings) => {
    const dom = String((settings && settings.domain) || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (dom) return 'https://' + dom + '/';
    const c = G.config();
    if (!G.detectar().owner || !c.owner) return '';
    return c.repo.toLowerCase() === `${c.owner.toLowerCase()}.github.io` ? `https://${c.owner}.github.io/` : `https://${c.owner}.github.io/${c.repo}/`;
  };

  async function api(ruta, opts) {
    opts = opts || {};
    const c = G.config();
    let r;
    try {
      r = await fetch(API + ruta, {
        method: opts.method || 'GET',
        body: opts.body,
        cache: 'no-store',
        headers: Object.assign({ Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', Authorization: 'Bearer ' + c.token, 'X-GitHub-Api-Version': '2022-11-28' }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      });
    } catch (e) {
      const err = new Error('Sin conexión a internet. Los cambios quedan guardados en este dispositivo y se suben solos cuando vuelva la conexión.');
      err.red = true;
      throw err;
    }
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).message || ''; } catch (e) { /* sin cuerpo */ }
      const err = new Error(traducir(r.status, msg));
      err.status = r.status;
      throw err;
    }
    if (r.status === 204) return null;
    return opts.raw ? r.text() : r.json();
  }
  function traducir(status, msg) {
    if (status === 401) return 'GitHub rechazó el acceso: el token venció o fue borrado. El súper administrador tiene que activar el guardado de nuevo en Ajustes.';
    if (status === 403) return 'El token no tiene permiso para escribir en el repositorio. Tiene que tener "Contents: Read and write". ' + (msg ? `(${msg})` : '');
    if (status === 404) return 'No se encontró el repositorio. Revisá que el token tenga acceso a ese repositorio.';
    if (status === 409) return 'El repositorio está vacío o en conflicto. Probá de nuevo en un momento.';
    if (status === 422) return 'GitHub no aceptó los cambios: ' + msg;
    return `GitHub respondió con un error (${status}). ${msg}`;
  }
  const ruta = () => { const c = G.config(); return `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`; };

  G.probar = async () => {
    const info = await api(ruta());
    if (info.permissions && info.permissions.push === false) throw new Error('El token puede leer el repositorio pero no escribir. Activá el permiso "Contents: Read and write".');
    const c = G.config();
    await api(`${ruta()}/git/ref/heads/${encodeURIComponent(c.branch)}`);
    return info;
  };

  /* ---------- lectura directa del repositorio (siempre la última versión) ---------- */
  const leerJS = (txt, nombre) => {
    const m = String(txt).match(new RegExp('window\\.' + nombre + '\\s*=\\s*'));
    if (!m) throw new Error('El archivo de datos del repositorio está dañado.');
    return JSON.parse(txt.slice(m.index + m[0].length).trim().replace(/;\s*$/, ''));
  };
  async function leerEn(sha) {
    const store = leerJS(await api(`${ruta()}/contents/data/store.js?ref=${sha}`, { raw: true }), 'GANGA_STORE');
    try {
      const cu = leerJS(await api(`${ruta()}/contents/data/cuentas.js?ref=${sha}`, { raw: true }), 'GANGA_CUENTAS');
      store.accounts = cu.accounts || [];
    } catch (e) {
      if (e.status !== 404) throw e; // versiones viejas tenían las cuentas dentro de store.js
    }
    return GS.normalizar(store);
  }
  G.leerRemoto = async () => {
    const c = G.config();
    const ref = await api(`${ruta()}/git/ref/heads/${encodeURIComponent(c.branch)}`);
    return leerEn(ref.object.sha);
  };

  /* ---------- fusión: suma los cambios de otra persona en vez de pisarlos ---------- */
  const COLECCIONES = ['categories', 'products', 'promotions', 'accounts'];
  const J = (x) => JSON.stringify(x === undefined ? null : x);
  /* base: versión desde la que se editó (o null si no se sabe); local: lo editado; remoto: lo último guardado */
  GS.fusionar = (base, local, remoto) => {
    const out = GS.clone(remoto);
    COLECCIONES.forEach((col) => {
      const B = new Map(((base && base[col]) || []).map((x) => [x.id, x]));
      const L = new Map((local[col] || []).map((x) => [x.id, x]));
      let lista = (out[col] || []).slice();
      (local[col] || []).forEach((item) => {
        const b = B.get(item.id);
        if (base && b && J(b) === J(item)) return; // no lo tocaste: queda lo último guardado
        const i = lista.findIndex((x) => x.id === item.id);
        if (i >= 0) lista[i] = GS.clone(item); else lista.push(GS.clone(item));
      });
      if (base) lista = lista.filter((x) => !(B.has(x.id) && !L.has(x.id))); // lo borraste vos
      out[col] = lista;
    });
    const ls = local.settings || {}, bs = (base && base.settings) || {};
    out.settings = out.settings || {};
    new Set([...Object.keys(ls), ...Object.keys(bs)]).forEach((k) => {
      if (!base || J(ls[k]) !== J(bs[k])) { if (k in ls) out.settings[k] = GS.clone(ls[k]); else delete out.settings[k]; }
    });
    return out;
  };

  /* ---------- fotos ---------- */
  const ES_DATA = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i;
  const EXT = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', gif: 'gif', 'svg+xml': 'svg' };
  G.recorrerImagenes = (data, fn) => {
    (data.products || []).forEach((p) => (p.colors || []).forEach((c) => { c.images = (c.images || []).map((src) => fn(src)); }));
    (data.promotions || []).forEach((p) => { if (p.image) p.image = fn(p.image); });
    (data.categories || []).forEach((c) => { if (c.image) c.image = fn(c.image); });
  };
  const subidasDe = (data) => {
    const s = new Set();
    G.recorrerImagenes(GS.clone(data), (src) => { if (/^img\/subidas\//.test(src)) s.add(src); return src; });
    return s;
  };
  G.contarFotosNuevas = (data) => { let n = 0; G.recorrerImagenes(GS.clone(data), (src) => { if (ES_DATA.test(src)) n++; return src; }); return n; };

  G.contenidoStore = (data) => {
    const sinCuentas = Object.assign({}, data);
    delete sinCuentas.accounts;
    return '/* Datos publicados de Ganga Store. Este archivo lo actualiza el panel de administración cada vez que se guarda un cambio. */\n'
      + 'window.GANGA_STORE = ' + JSON.stringify(sinCuentas, null, 1) + ';\n';
  };
  G.contenidoCuentas = (data) => '/* Cuentas del panel de Ganga Store (contraseñas con hash PBKDF2). La tienda no carga este archivo. */\n'
    + 'window.GANGA_CUENTAS = ' + JSON.stringify({ rev: data.rev, accounts: data.accounts || [] }, null, 1) + ';\n';

  /**
   * Guarda `local` en el repositorio. `base` es la versión desde la que se editó.
   * Si otra persona guardó en el medio, se fusionan los cambios de los dos.
   * Devuelve { data, cache, fusion } con las rutas definitivas de las fotos.
   */
  G.guardar = async (local, base, autor) => {
    const c = G.config();
    let ultimoError;
    for (let intento = 0; intento < 3; intento++) {
      const ref = await api(`${ruta()}/git/ref/heads/${encodeURIComponent(c.branch)}`);
      const commitBase = await api(`${ruta()}/git/commits/${ref.object.sha}`);
      const remoto = await leerEn(ref.object.sha);
      const fusion = !base || remoto.rev !== base.rev;
      const data = fusion ? GS.fusionar(base, local, remoto) : GS.clone(local);
      data.rev = 'r' + Date.now().toString(36);
      data.updatedAt = new Date().toISOString();
      data.updatedBy = autor || '';

      // fotos nuevas → archivos
      const pendientes = [];
      const cache = {};
      G.recorrerImagenes(data, (src) => {
        const m = typeof src === 'string' && src.match(ES_DATA);
        if (!m) return src;
        const destino = `img/subidas/${GS.uid('f')}.${EXT[m[1].toLowerCase()] || 'jpg'}`;
        pendientes.push({ destino, base64: src.slice(src.indexOf(',') + 1) });
        cache[destino] = src;
        return destino;
      });
      const arbol = [];
      for (const p of pendientes) {
        const blob = await api(`${ruta()}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: p.base64, encoding: 'base64' }) });
        arbol.push({ path: p.destino, mode: '100644', type: 'blob', sha: blob.sha });
      }
      arbol.push({ path: 'data/store.js', mode: '100644', type: 'blob', content: G.contenidoStore(data) });
      arbol.push({ path: 'data/cuentas.js', mode: '100644', type: 'blob', content: G.contenidoCuentas(data) });

      // fotos que ya no usa nadie
      const ahora = subidasDe(data);
      const borrar = [...subidasDe(remoto)].filter((p) => !ahora.has(p));
      let tree;
      try {
        tree = await api(`${ruta()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: commitBase.tree.sha, tree: arbol.concat(borrar.map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null }))) }) });
      } catch (e) {
        if (!borrar.length) throw e;
        tree = await api(`${ruta()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: commitBase.tree.sha, tree: arbol }) });
      }
      const fecha = new Intl.DateTimeFormat('es-AR', { timeZone: GS.TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date());
      const commit = await api(`${ruta()}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `Cambios en la tienda (${fecha})${autor ? ' por ' + autor : ''}`, tree: tree.sha, parents: [ref.object.sha] }) });
      try {
        await api(`${ruta()}/git/refs/heads/${encodeURIComponent(c.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
      } catch (e) {
        // alguien guardó justo en este momento: se vuelve a leer y fusionar
        if (e.status === 422 || e.status === 409) { ultimoError = e; continue; }
        throw e;
      }
      return { data: GS.normalizar(data), cache, fusion: fusion && !!base };
    }
    throw ultimoError || new Error('No se pudo guardar. Probá de nuevo.');
  };
})();
