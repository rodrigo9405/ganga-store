/* Ganga Store — base de datos (Supabase).
   La tienda lee el catálogo con pedidos simples a la API (sin librerías, para que cargue rápido).
   El panel usa la librería oficial (js/vendor/supabase.js) para iniciar sesión, guardar y subir fotos. */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});
  const CFG = window.GANGA_CONFIG || {};
  const D = (GS.db = {});
  D.configurado = () => !!(CFG.supabaseUrl && CFG.supabaseKey);

  /* ---------- traducción entre la base de datos y el modelo de la tienda ---------- */
  const iso = (t) => (t ? new Date(t).toISOString() : '');
  const MAPA = {
    categories: {
      tabla: 'categorias',
      a: (c) => ({ id: c.id, nombre: c.name, slug: c.slug, orden: Number(c.order) || 0, imagen: c.image || '' }),
      de: (r) => ({ id: r.id, name: r.nombre, slug: r.slug, order: r.orden, image: r.imagen || '' }),
    },
    products: {
      tabla: 'productos',
      a: (p) => ({
        id: p.id, nombre: p.name, categoria_id: p.categoryId || null, precio: Math.round(Number(p.price) || 0),
        descripcion: p.description || '', talles: p.sizes || [], colores: p.colors || [], visible: p.visible !== false,
        creado: p.createdAt || new Date().toISOString(), actualizado: new Date().toISOString(),
      }),
      de: (r) => ({
        id: r.id, name: r.nombre, categoryId: r.categoria_id || '', price: r.precio, description: r.descripcion || '',
        sizes: r.talles || [], colors: r.colores || [], visible: r.visible !== false, createdAt: iso(r.creado),
      }),
    },
    promotions: {
      tabla: 'promociones',
      a: (p) => ({
        id: p.id, titulo: p.title, subtitulo: p.subtitle || '', descuento: Math.round(Number(p.discount) || 0),
        inicio: p.start, fin: p.end, estilo: p.style || 'negro', productos: p.productIds || [], imagen: p.image || '', activa: p.active !== false,
      }),
      de: (r) => ({
        id: r.id, title: r.titulo, subtitle: r.subtitulo || '', discount: r.descuento, start: r.inicio, end: r.fin,
        style: r.estilo || 'negro', productIds: r.productos || [], image: r.imagen || '', active: r.activa !== false,
      }),
    },
  };
  const cuentaDe = (r) => ({ id: r.id, username: r.correo, name: r.nombre, role: r.rol, active: r.activo !== false, pin: r.rol === 'superadmin' });

  function armar(ajustes, cats, prods, promos) {
    return GS.normalizar({
      schema: 3,
      settings: (ajustes && ajustes.datos) || {},
      categories: (cats || []).map(MAPA.categories.de),
      products: (prods || []).map(MAPA.products.de),
      promotions: (promos || []).map(MAPA.promotions.de),
      accounts: [],
    });
  }

  /* ---------- tienda: lectura pública ---------- */
  async function rest(ruta, opts) {
    opts = opts || {};
    let r;
    try {
      r = await fetch(`${CFG.supabaseUrl}/rest/v1/${ruta}`, {
        method: opts.method || 'GET',
        headers: Object.assign({ apikey: CFG.supabaseKey, Accept: 'application/json' }, opts.body ? { 'Content-Type': 'application/json' } : {}),
        body: opts.body,
        cache: 'no-store',
        keepalive: !!opts.keepalive,
      });
    } catch (e) { throw new Error('No hay conexión con la tienda. Revisá tu internet y probá de nuevo.'); }
    if (!r.ok) throw new Error(r.status === 503 || r.status === 540 ? 'La tienda está despertando. Probá de nuevo en unos segundos.' : `No se pudo cargar la tienda (${r.status}).`);
    return r.status === 204 ? null : r.json();
  }
  D.cargarTienda = async () => {
    if (!D.configurado()) throw new Error('Falta configurar la base de datos (js/config.js).');
    const [aj, cats, prods, promos] = await Promise.all([
      rest('ajustes?select=datos&id=eq.1'),
      rest('categorias?select=id,nombre,slug,orden,imagen&order=orden.asc'),
      rest('productos?select=id,nombre,categoria_id,precio,descripcion,talles,colores,visible,creado&order=creado.desc'),
      rest('promociones?select=id,titulo,subtitulo,descuento,inicio,fin,estilo,productos,imagen,activa'),
    ]);
    return armar(aj && aj[0], cats, prods, promos);
  };
  D.registrarVisita = () => rest('rpc/registrar_visita', { method: 'POST', body: '{}', keepalive: true }).catch(() => {});

  /* Estado del negocio: si el súper administrador suspendió la tienda, se muestra "Página en mantenimiento" */
  D.MSJ_SUSPENDIDA = 'La tienda está suspendida temporalmente. Comunicate con el súper administrador para reactivarla.';
  D.estadoNegocio = async () => {
    const r = await rest('rpc/estado_negocio', { method: 'POST', body: '{}' });
    return r && typeof r === 'object' ? r : { activo: true };
  };

  /* ---------- panel: cliente con sesión ---------- */
  const CLAVE_RECORDAR = 'gs_recordar';
  let cliente = null;
  const almacen = () => { try { return localStorage.getItem(CLAVE_RECORDAR) === '0' ? sessionStorage : localStorage; } catch (e) { return undefined; } };
  D.cliente = () => {
    if (cliente) return cliente;
    if (!window.supabase || !window.supabase.createClient) throw new Error('No se cargó la librería de la base de datos.');
    cliente = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'gs-sesion', storage: almacen() },
    });
    return cliente;
  };
  const err = (e, def) => {
    if (!e) return null;
    const m = String(e.message || e.error_description || e || '');
    if (/Failed to fetch|NetworkError|network/i.test(m)) { const x = new Error('Sin conexión a internet. Los cambios quedan en este dispositivo y se guardan solos cuando vuelva la conexión.'); x.red = true; return x; }
    if (/JWT|token is expired|not authenticated|row-level security/i.test(m)) { const x = new Error('Tu sesión venció o no tenés permiso. Volvé a ingresar.'); x.sesion = true; return x; }
    return new Error(def ? `${def} (${m})` : m);
  };
  const ok = (res, def) => { if (res.error) throw err(res.error, def); return res.data; };

  /* Inicio de sesión */
  D.ingresar = async (correo, pass, recordar) => {
    try { localStorage.setItem(CLAVE_RECORDAR, recordar ? '1' : '0'); } catch (e) { /* nada */ }
    cliente = null;
    const sb = D.cliente();
    const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: pass });
    if (error) {
      const m = String(error.message || '');
      if (/banned/i.test(m)) {
        const est = await D.estadoNegocio().catch(() => null);
        throw new Error(est && est.activo === false ? D.MSJ_SUSPENDIDA : 'Esta cuenta está desactivada. Pedile acceso al súper administrador.');
      }
      if (/Invalid login|invalid_credentials|Email not confirmed/i.test(m)) throw new Error('Correo o contraseña incorrectos.');
      throw err(error);
    }
    return data.session;
  };
  D.sesion = async () => {
    const { data } = await D.cliente().auth.getSession();
    return data.session || null;
  };
  D.salir = async () => { try { await D.cliente().auth.signOut({ scope: 'local' }); } catch (e) { /* nada */ } };
  D.miPerfil = async () => {
    const sb = D.cliente();
    const { data: u } = await sb.auth.getUser();
    if (!u || !u.user) return null;
    const r = ok(await sb.from('perfiles').select('id,correo,nombre,rol,activo').eq('id', u.user.id).maybeSingle(), 'No se pudo leer tu cuenta');
    return r ? cuentaDe(r) : null;
  };

  /* Clave de 4 dígitos del súper administrador (se verifica en la base de datos) */
  D.estadoPin = async () => ok(await D.cliente().rpc('estado_pin')) || null;
  D.crearPin = async (pin) => ok(await D.cliente().rpc('crear_pin', { p_pin: pin }));
  D.verificarPin = async (pin) => ok(await D.cliente().rpc('verificar_pin', { p_pin: pin }));
  D.cambiarPin = async (actual, nuevo) => ok(await D.cliente().rpc('cambiar_pin', { p_actual: actual, p_nuevo: nuevo }));

  /* Suspender o reactivar la tienda (solo el súper administrador) */
  D.cambiarEstadoNegocio = async (activo) => ok(await D.cliente().rpc('cambiar_estado_negocio', { p_activo: !!activo }), 'No se pudo cambiar el estado de la tienda');

  /* Contraseñas */
  D.cambiarMiContrasena = async (actual, nueva) => ok(await D.cliente().rpc('cambiar_mi_contrasena', { p_actual: actual, p_nueva: nueva }));
  D.cambiarContrasenaCuenta = async (id, nueva) => ok(await D.cliente().rpc('cambiar_contrasena_cuenta', { p_id: id, p_nueva: nueva }));

  /* Todo lo que ve el panel */
  D.cargarTodo = async () => {
    const sb = D.cliente();
    const [aj, cats, prods, promos, perfiles] = await Promise.all([
      sb.from('ajustes').select('datos').eq('id', 1).maybeSingle(),
      sb.from('categorias').select('id,nombre,slug,orden,imagen').order('orden'),
      sb.from('productos').select('id,nombre,categoria_id,precio,descripcion,talles,colores,visible,creado').order('creado', { ascending: false }),
      sb.from('promociones').select('id,titulo,subtitulo,descuento,inicio,fin,estilo,productos,imagen,activa'),
      sb.from('perfiles').select('id,correo,nombre,rol,activo').order('rol', { ascending: false }),
    ]);
    const datos = armar(ok(aj, 'No se pudieron leer los ajustes'), ok(cats), ok(prods), ok(promos));
    datos.accounts = (ok(perfiles) || []).map(cuentaDe);
    return datos;
  };

  /* Visitas para el panel */
  D.visitasRango = async (desde, hasta) => ok(await D.cliente().rpc('visitas_rango', { p_desde: desde, p_hasta: hasta }), 'No se pudieron leer las visitas') || [];

  /* ---------- fotos ---------- */
  const ES_DATA = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
  const EXT = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', gif: 'gif' };
  const prefijoFotos = () => `${CFG.supabaseUrl}/storage/v1/object/public/${CFG.bucketFotos}/`;
  const recorrer = (data, fn) => {
    (data.products || []).forEach((p) => (p.colors || []).forEach((c) => { c.images = (c.images || []).map(fn); }));
    (data.promotions || []).forEach((p) => { if (p.image) p.image = fn(p.image); });
    (data.categories || []).forEach((c) => { if (c.image) c.image = fn(c.image); });
  };
  const fotosDe = (data) => { const s = new Set(); recorrer(GS.clone(data), (src) => { if (String(src).startsWith(prefijoFotos())) s.add(src); return src; }); return s; };
  D.contarFotosNuevas = (data) => { let n = 0; recorrer(GS.clone(data), (s) => { if (ES_DATA.test(s)) n++; return s; }); return n; };
  async function subirFotos(data) {
    const pendientes = new Map();
    recorrer(data, (src) => { if (typeof src === 'string' && ES_DATA.test(src) && !pendientes.has(src)) pendientes.set(src, null); return src; });
    const sb = D.cliente();
    for (const src of pendientes.keys()) {
      const m = src.match(ES_DATA);
      const ext = EXT[m[1].toLowerCase()] || 'jpg';
      const blob = await (await fetch(src)).blob();
      const ruta = `${new Date().toISOString().slice(0, 7)}/${GS.uid('f')}.${ext}`;
      const { error } = await sb.storage.from(CFG.bucketFotos).upload(ruta, blob, { contentType: blob.type || `image/${ext}`, cacheControl: '31536000', upsert: false });
      if (error) throw err(error, 'No se pudo subir una foto');
      pendientes.set(src, prefijoFotos() + ruta);
    }
    recorrer(data, (src) => pendientes.get(src) || src);
    return pendientes;
  }

  /* ---------- guardar: solo lo que cambió ---------- */
  const J = (x) => JSON.stringify(x === undefined ? null : x);
  function diferencias(antes, despues, col) {
    const A = new Map((antes[col] || []).map((x) => [x.id, x]));
    const B = new Map((despues[col] || []).map((x) => [x.id, x]));
    const cambiados = [...B.values()].filter((x) => !A.has(x.id) || J(A.get(x.id)) !== J(x));
    const borrados = [...A.keys()].filter((id) => !B.has(id));
    return { cambiados, borrados };
  }
  /**
   * Guarda en la base de datos la diferencia entre `antes` (lo último guardado) y `despues`.
   * Devuelve los datos guardados, con las fotos nuevas ya convertidas en direcciones de la carpeta de fotos.
   */
  D.guardar = async (antes, despuesOriginal) => {
    const sb = D.cliente();
    const despues = GS.clone(despuesOriginal);
    const cache = await subirFotos(despues);
    const dif = {};
    Object.keys(MAPA).forEach((col) => { dif[col] = diferencias(antes, despues, col); });
    // altas y cambios (primero categorías, por la relación con productos)
    for (const col of ['categories', 'products', 'promotions']) {
      const { cambiados } = dif[col];
      if (cambiados.length) ok(await sb.from(MAPA[col].tabla).upsert(cambiados.map(MAPA[col].a)), 'No se pudo guardar');
    }
    // bajas (en orden inverso)
    for (const col of ['promotions', 'products', 'categories']) {
      const { borrados } = dif[col];
      if (borrados.length) ok(await sb.from(MAPA[col].tabla).delete().in('id', borrados), 'No se pudo borrar');
    }
    if (J(antes.settings) !== J(despues.settings)) {
      ok(await sb.from('ajustes').update({ datos: despues.settings, actualizado: new Date().toISOString() }).eq('id', 1), 'No se pudieron guardar los ajustes');
    }
    // cuentas: nombre y estado (las contraseñas se cambian aparte)
    for (const c of despues.accounts || []) {
      const prev = (antes.accounts || []).find((x) => x.id === c.id);
      if (prev && (prev.name !== c.name || prev.active !== c.active)) ok(await sb.rpc('actualizar_cuenta', { p_id: c.id, p_nombre: c.name, p_activo: c.active }), 'No se pudo actualizar la cuenta');
    }
    // fotos que ya no usa nadie
    const usadas = fotosDe(despues);
    const sobran = [...fotosDe(antes)].filter((u) => !usadas.has(u)).map((u) => u.slice(prefijoFotos().length));
    if (sobran.length) sb.storage.from(CFG.bucketFotos).remove(sobran).catch(() => {});
    const imgs = {};
    cache.forEach((url, src) => { if (url) imgs[url] = src; });
    return { data: despues, cache: imgs };
  };
})();
