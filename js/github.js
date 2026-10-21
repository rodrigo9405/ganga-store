/* Ganga Store — publicación en GitHub.
   El repositorio funciona como "base de datos": al publicar se crea un commit con
   data/store.js y las fotos nuevas en img/subidas/. GitHub Pages actualiza la tienda
   en uno o dos minutos. El token se guarda solo en este navegador, nunca en el repositorio. */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});
  const API = 'https://api.github.com';
  const CLAVE = 'gs_github';

  const G = (GS.github = {});

  G.config = () => {
    const c = GS.ls.get(CLAVE, {}) || {};
    const auto = G.detectar();
    return { owner: c.owner || auto.owner || '', repo: c.repo || auto.repo || '', branch: c.branch || 'main', token: c.token || '' };
  };
  G.guardarConfig = (c) => GS.ls.set(CLAVE, { owner: (c.owner || '').trim(), repo: (c.repo || '').trim(), branch: (c.branch || 'main').trim(), token: (c.token || '').trim() });
  G.configurado = () => { const c = G.config(); return !!(c.owner && c.repo && c.token); };
  /* Si la tienda corre en usuario.github.io/repositorio, completa los datos solos */
  G.detectar = () => {
    const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!m) return {};
    const seg = location.pathname.split('/').filter(Boolean)[0];
    const repo = seg && !/\.html?$/.test(seg) ? seg : `${m[1]}.github.io`;
    return { owner: m[1], repo };
  };
  G.urlTienda = () => {
    const c = G.config();
    if (!c.owner) return '';
    return c.repo.toLowerCase() === `${c.owner.toLowerCase()}.github.io` ? `https://${c.owner}.github.io/` : `https://${c.owner}.github.io/${c.repo}/`;
  };

  async function api(ruta, opts) {
    const c = G.config();
    const r = await fetch(API + ruta, Object.assign({}, opts, {
      headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + c.token, 'X-GitHub-Api-Version': '2022-11-28' }, opts && opts.body ? { 'Content-Type': 'application/json' } : {}),
    }));
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).message || ''; } catch (e) { /* sin cuerpo */ }
      const err = new Error(traducir(r.status, msg));
      err.status = r.status;
      throw err;
    }
    return r.status === 204 ? null : r.json();
  }
  function traducir(status, msg) {
    if (status === 401) return 'GitHub rechazó el token. Revisá que esté bien copiado y que no haya vencido.';
    if (status === 403) return 'El token no tiene permiso para escribir en el repositorio. Dale permiso de "Contents: Read and write". ' + (msg ? `(${msg})` : '');
    if (status === 404) return 'No se encontró el repositorio o la rama. Revisá usuario, repositorio y rama, y que el token tenga acceso a ese repositorio.';
    if (status === 409) return 'El repositorio está vacío o en conflicto. Subí al menos un archivo y probá de nuevo.';
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

  /* Revisión publicada en GitHub (para avisar si otra persona publicó mientras editabas) */
  G.revRemota = async () => {
    const c = G.config();
    try {
      const f = await api(`${ruta()}/contents/data/store.js?ref=${encodeURIComponent(c.branch)}`);
      const bin = atob(String(f.content || '').replace(/\n/g, ''));
      const txt = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
      const m = txt.match(/"rev":\s*"([^"]+)"/);
      return m ? m[1] : null;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  };

  const ES_DATA = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i;
  const EXT = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', gif: 'gif', 'svg+xml': 'svg' };
  /* Recorre todas las imágenes del modelo de datos */
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

  G.contenidoStore = (data) => '/* Datos publicados de Ganga Store. Este archivo lo actualiza el panel de administración al presionar "Publicar". */\n'
    + 'window.GANGA_STORE = ' + JSON.stringify(data, null, 1) + ';\n';

  /**
   * Publica `data`. `anterior` es la versión publicada (para borrar fotos que ya no se usan).
   * progreso(paso, detalle) informa el avance. Devuelve { data, cache } con las rutas definitivas.
   */
  G.publicar = async (dataOriginal, anterior, autor, progreso) => {
    const c = G.config();
    const avisar = progreso || (() => {});
    const data = GS.clone(dataOriginal);
    data.rev = 'r' + Date.now().toString(36);
    data.updatedAt = new Date().toISOString();
    data.updatedBy = autor || '';

    avisar('conectar');
    const ref = await api(`${ruta()}/git/ref/heads/${encodeURIComponent(c.branch)}`);
    const commitBase = await api(`${ruta()}/git/commits/${ref.object.sha}`);

    // 1. fotos nuevas → blobs
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
    for (let i = 0; i < pendientes.length; i++) {
      avisar('fotos', `${i + 1} de ${pendientes.length}`);
      const blob = await api(`${ruta()}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: pendientes[i].base64, encoding: 'base64' }) });
      arbol.push({ path: pendientes[i].destino, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 2. datos
    avisar('datos');
    arbol.push({ path: 'data/store.js', mode: '100644', type: 'blob', content: G.contenidoStore(data) });

    // 3. fotos que ya no usa ningún producto
    const antes = anterior ? subidasDe(anterior) : new Set();
    const ahora = subidasDe(data);
    const borrar = [...antes].filter((p) => !ahora.has(p));
    let tree;
    try {
      tree = await api(`${ruta()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: commitBase.tree.sha, tree: arbol.concat(borrar.map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null }))) }) });
    } catch (e) {
      if (!borrar.length) throw e;
      tree = await api(`${ruta()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: commitBase.tree.sha, tree: arbol }) });
    }

    avisar('commit');
    const fecha = new Intl.DateTimeFormat('es-AR', { timeZone: GS.TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    const commit = await api(`${ruta()}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `Actualización de la tienda (${fecha})${autor ? ' por ' + autor : ''}`, tree: tree.sha, parents: [ref.object.sha] }) });
    await api(`${ruta()}/git/refs/heads/${encodeURIComponent(c.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    avisar('listo');
    return { data, cache, commit: commit.sha };
  };

  /* Espera a que GitHub Pages sirva la versión nueva (hasta ~4 minutos) */
  G.esperarOnline = async (rev, alTerminar) => {
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      try {
        const r = await fetch('data/store.js?v=' + Date.now(), { cache: 'no-store' });
        const txt = await r.text();
        if (txt.includes(`"rev": "${rev}"`)) { alTerminar(true); return; }
      } catch (e) { /* sin conexión, reintenta */ }
    }
    alTerminar(false);
  };
})();
