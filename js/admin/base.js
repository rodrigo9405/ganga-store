/* Ganga Store — panel: ingreso, estructura y guardado automático en la base de datos (Supabase) */
(function () {
  'use strict';
  const GS = window.GS;
  const { esc, $, $$, icon } = GS;
  const A = (GS.A = { vistas: {} });
  const DB = GS.db;

  A.pub = null;      // lo último guardado en la base de datos
  A.data = null;     // copia de trabajo
  A.yo = null;       // cuenta que inició sesión
  A.sucio = false;

  A.generarPass = () => {
    const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const r = crypto.getRandomValues(new Uint32Array(12));
    return Array.from(r, (n) => abc[n % abc.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
  };
  A.validarPass = (p) => (p.length < 10 ? 'Usá al menos 10 caracteres.' : null);

  /* ---------- datos ---------- */
  const firma = (d) => JSON.stringify(Object.assign({}, d, { rev: '', updatedAt: '', updatedBy: '' }));
  A.firma = firma;
  let borradorBase = null;
  async function cargarDatos() {
    A.pub = GS.normalizar(await DB.cargarTodo());
    GS.imgCache = (await GS.idb.get('imgcache')) || {};
    const b = await GS.idb.get('borrador');
    // borradores de la versión anterior (sin base de datos) no se usan
    borradorBase = b && b.data && b.db === true ? b : null;
    if (b && !borradorBase) await GS.idb.del('borrador').catch(() => {});
    aplicarBorrador();
  }
  /* Junta lo guardado con lo que haya quedado pendiente en este dispositivo */
  function aplicarBorrador() {
    const b = borradorBase;
    A.data = b && b.data ? GS.normalizar(GS.fusionar(b.base || null, b.data, A.pub)) : GS.clone(A.pub);
    A.sucio = firma(A.data) !== firma(A.pub);
    if (A.yo) A.yo = A.cuenta(A.yo.id) || A.yo;
  }
  A.recargar = async () => {
    try { A.pub = GS.normalizar(await DB.cargarTodo()); aplicarBorrador(); return true; } catch (e) { A.ultimoError = e.message; return false; }
  };
  async function guardarBorrador() {
    try {
      if (A.sucio) { borradorBase = { db: true, data: A.data, base: A.pub, at: Date.now() }; await GS.idb.set('borrador', borradorBase); }
      else { borradorBase = null; await GS.idb.del('borrador'); }
    } catch (e) { /* sin almacenamiento local: queda en memoria hasta que se guarde */ }
  }
  /* Se llama después de cada cambio: queda en el dispositivo y se guarda en la base de datos */
  A.guardar = async () => {
    A.sucio = firma(A.data) !== firma(A.pub);
    await guardarBorrador();
    if (A.sucio) { A.estado = 'pendiente'; programar(700); }
    pintarEstadoPub();
  };
  A.descartarBorrador = async () => {
    A.data = GS.clone(A.pub);
    A.sucio = false;
    await guardarBorrador();
    A.estado = 'ok';
    pintarEstadoPub();
  };

  function cambiarFotos(data, fn) {
    (data.products || []).forEach((p) => (p.colors || []).forEach((c) => { c.images = (c.images || []).map(fn); }));
    (data.promotions || []).forEach((p) => { if (p.image) p.image = fn(p.image); });
    (data.categories || []).forEach((c) => { if (c.image) c.image = fn(c.image); });
  }

  /* ---------- guardado automático ---------- */
  A.estado = 'ok';            // ok | pendiente | guardando | error
  A.ultimoError = '';
  let timer = null, enCurso = false, avisoTienda = false;
  function programar(ms) { clearTimeout(timer); timer = setTimeout(subir, ms); }
  async function subir() {
    if (enCurso || !A.yo) return;
    if (!A.sucio) { A.estado = 'ok'; pintarEstadoPub(); return; }
    enCurso = true;
    A.estado = 'guardando'; pintarEstadoPub();
    const enviado = GS.clone(A.data);
    const base = GS.clone(A.pub);
    try {
      const r = await DB.guardar(base, enviado);
      Object.assign(GS.imgCache, r.cache);
      try { await GS.idb.set('imgcache', GS.imgCache); } catch (e) { /* nada */ }
      A.pub = GS.normalizar(GS.clone(r.data));
      // Las pantallas abiertas usan A.data: no se reemplaza, solo se cambian (en el lugar)
      // las fotos recién subidas por su dirección definitiva.
      const aUrl = new Map(Object.entries(r.cache).map(([url, src]) => [src, url]));
      if (aUrl.size) cambiarFotos(A.data, (src) => aUrl.get(src) || src);
      A.yo = A.cuenta(A.yo.id) || A.yo;
      A.sucio = firma(A.data) !== firma(A.pub);
      await guardarBorrador();
      A.estado = A.sucio ? 'pendiente' : 'ok';
      A.ultimoError = '';
      A.ultimoGuardado = Date.now();
      if (!avisoTienda) { avisoTienda = true; A.toast('Guardado. Tus clientes ya lo ven en la tienda.'); }
    } catch (e) {
      A.estado = 'error';
      A.ultimoError = e.message;
      if (e.red) programar(20000);
      if (e.sesion) { A.toast(e.message, true); setTimeout(() => A.salir(), 2500); }
    }
    enCurso = false;
    if (A.sucio && A.estado !== 'error') programar(300);
    pintarEstadoPub();
  }
  A.subirAhora = () => { clearTimeout(timer); return subir(); };
  A.publicar = A.subirAhora;
  window.addEventListener('online', () => { if (A.sucio) programar(500); });

  A.esSuper = () => A.yo && A.yo.role === 'superadmin';
  A.cuenta = (id) => A.data.accounts.find((a) => a.id === id);

  /* ---------- utilidades de interfaz ---------- */
  A.toast = (msg, error) => {
    const zona = $('#toasts');
    if (!zona) return;
    const t = document.createElement('div');
    t.className = 'toast' + (error ? ' error' : '');
    t.textContent = msg;
    zona.appendChild(t);
    setTimeout(() => t.remove(), error ? 6000 : 3200);
  };
  A.dialogo = ({ titulo, cuerpo, pie, ancho, alCerrar }) => {
    const d = document.createElement('dialog');
    d.className = 'dlg';
    if (ancho) d.style.width = ancho;
    d.innerHTML = `<div class="dlg-cab"><h2>${esc(titulo)}</h2><button class="btn btn-icono" type="button" data-cerrar aria-label="Cerrar">${icon('close')}</button></div>
      <div class="dlg-cuerpo">${cuerpo || ''}</div>${pie ? `<div class="dlg-pie">${pie}</div>` : ''}`;
    document.body.appendChild(d);
    d.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) d.close(); });
    d.addEventListener('close', () => { if (alCerrar) alCerrar(d.returnValue); d.remove(); });
    d.showModal();
    return d;
  };
  A.confirmar = ({ titulo, texto, ok, peligro }) => new Promise((res) => {
    let r = false;
    const d = A.dialogo({
      titulo, cuerpo: `<p>${texto}</p>`,
      pie: `<button class="btn btn-suave" type="button" data-cerrar>Cancelar</button><button class="btn ${peligro ? 'btn-peligro' : ''}" type="button" data-ok>${esc(ok || 'Aceptar')}</button>`,
      alCerrar: () => res(r),
    });
    $('[data-ok]', d).onclick = () => { r = true; d.close(); };
    $('[data-ok]', d).focus();
  });
  A.img = (src, alt) => `<img src="${esc(GS.img(src) || 'img/marca/sin-foto.svg')}" alt="${esc(alt || '')}" loading="lazy" onerror="this.onerror=null;this.src='img/marca/sin-foto.svg'">`;
  A.comprimir = (file, max, calidad) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const lado = max || 1400;
      const s = Math.min(1, lado / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', calidad || 0.84));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error(`No se pudo leer la imagen "${file.name}". Probá con un JPG o PNG.`)); };
    im.src = url;
  });
  A.descargar = (nombre, contenido, tipo) => {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo || 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  };
  A.leerForm = (form) => Object.fromEntries(new FormData(form).entries());
  A.titulo = (t) => { $('#admTitulo').textContent = t; document.title = `${t} | Panel Ganga Store`; };
  A.vista = () => $('#vista');
  /* Avisa si se sale de un formulario con cambios sin guardar */
  A.guardia = null;

  /* ---------- sesión ---------- */
  A.salir = async () => {
    await DB.salir();
    location.hash = '';
    location.reload();
  };

  function cajaIngreso(contenido, msg) {
    document.body.className = '';
    document.body.innerHTML = `<main class="login">
      <div class="login-caja">
        <div class="login-marca"><img src="img/marca/corona.png" alt=""><h1>GANGA STORE</h1><p>Panel de administración</p></div>
        <form id="fIngreso" novalidate>${contenido}<p class="error" id="eIngreso" role="alert">${esc(msg || '')}</p></form>
        <p class="login-pie"><a href="./">Ir a la tienda</a></p>
      </div></main><div class="toast-zona" id="toasts" aria-live="polite"></div>`;
    return $('#fIngreso');
  }
  const errorIngreso = (t) => { $('#eIngreso').textContent = t; };

  function pantallaIngreso(msg) {
    const f = cajaIngreso(`
      <label class="campo"><span>Correo</span><input name="u" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label class="campo"><span>Contraseña</span><input name="p" type="password" autocomplete="current-password" required></label>
      <label class="check"><input type="checkbox" name="r"> <span>Mantener la sesión abierta en este dispositivo</span></label>
      <button class="btn btn-block" type="submit">Ingresar</button>`, msg);
    f.elements.namedItem('u').focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = A.leerForm(f);
      const btn = $('button[type=submit]', f);
      const correo = String(d.u || '').trim().toLowerCase();
      if (!correo || !d.p) { errorIngreso('Completá correo y contraseña.'); return; }
      btn.disabled = true; btn.textContent = 'Verificando…';
      try {
        await DB.ingresar(correo, d.p, d.r === 'on');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Ingresar';
        errorIngreso(err.message);
        return;
      }
      GS.visitas.excluirDispositivo(true);
      await continuar();
    };
  }

  /* Después de iniciar sesión (o al volver con la sesión abierta) */
  async function continuar() {
    let perfil;
    try { perfil = await DB.miPerfil(); } catch (e) { pantallaIngreso(e.message); return; }
    if (!perfil) { await DB.salir(); pantallaIngreso('Esta cuenta no tiene acceso al panel.'); return; }
    if (!perfil.active) { await DB.salir(); pantallaIngreso('Esta cuenta está desactivada. Pedile acceso al súper administrador.'); return; }
    if (perfil.role === 'superadmin') {
      let est;
      try { est = await DB.estadoPin(); } catch (e) { pantallaIngreso(e.message); return; }
      if (!est || !est.tiene) { if (!(await crearPin())) return; }
      else if (!est.verificado) { if (!(await pedirPin(est.bloqueo))) return; }
    }
    try { await cargarDatos(); } catch (e) {
      pantallaIngreso('No se pudieron cargar los datos: ' + e.message);
      return;
    }
    A.yo = A.cuenta(perfil.id) || perfil;
    montar();
  }

  const campoPin = (nombre, etiqueta) => `<label class="campo"><span>${etiqueta}</span><input name="${nombre}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" style="letter-spacing:.5em;font-size:22px;text-align:center"></label>`;
  const hora = (iso) => new Intl.DateTimeFormat('es-AR', { timeZone: GS.TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  /* Segundo paso del súper administrador: la clave extra de 4 dígitos (la verifica la base de datos) */
  function pedirPin(bloqueo) {
    return new Promise((res) => {
      const f = cajaIngreso(`<p class="ayuda" style="font-size:15px;color:var(--ink-2)">Por seguridad, escribí tu clave extra de 4 dígitos.</p>
        ${campoPin('pin', 'Clave de 4 dígitos')}
        <button class="btn btn-block" type="submit">Ingresar</button>
        <button class="btn btn-suave btn-block" type="button" id="pinVolver">Usar otra cuenta</button>`,
      bloqueo ? `Demasiados intentos. Probá de nuevo después de las ${hora(bloqueo)}.` : '');
      const inp = f.elements.namedItem('pin');
      const btn = $('button[type=submit]', f);
      inp.focus();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const v = inp.value.trim();
        if (!/^\d{4}$/.test(v)) { errorIngreso('Escribí los 4 números.'); return; }
        btn.disabled = true;
        let r;
        try { r = await DB.verificarPin(v); } catch (err) { btn.disabled = false; errorIngreso(err.message); return; }
        btn.disabled = false;
        if (r === 'ok') { res(true); return; }
        inp.value = ''; inp.focus();
        if (r === 'bloqueado') { const est = await DB.estadoPin().catch(() => null); errorIngreso(`Demasiados intentos. Probá de nuevo${est && est.bloqueo ? ' después de las ' + hora(est.bloqueo) : ' en 15 minutos'}.`); }
        else errorIngreso('La clave de 4 dígitos no es correcta.');
      };
      $('#pinVolver').onclick = async () => { await DB.salir(); pantallaIngreso(); res(false); };
    });
  }

  /* Primera vez: el súper administrador elige su clave de 4 dígitos */
  function crearPin() {
    return new Promise((res) => {
      const f = cajaIngreso(`<p class="ayuda" style="font-size:15px;color:var(--ink-2)">Es tu primer ingreso. Elegí la clave extra de 4 dígitos que te vamos a pedir cada vez que entres.</p>
        ${campoPin('a', 'Clave de 4 dígitos')}
        ${campoPin('b', 'Repetila')}
        <button class="btn btn-block" type="submit">Guardar clave y entrar</button>`);
      f.elements.namedItem('a').focus();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const a = f.elements.namedItem('a').value.trim(), b = f.elements.namedItem('b').value.trim();
        if (!/^\d{4}$/.test(a)) { errorIngreso('La clave tiene que tener exactamente 4 números.'); return; }
        if (a !== b) { errorIngreso('Las dos claves no coinciden.'); return; }
        try {
          if (await DB.crearPin(a)) { res(true); return; }
          errorIngreso('No se pudo guardar la clave. Volvé a ingresar.');
        } catch (err) { errorIngreso(err.message); }
      };
    });
  }

  /* ---------- estructura ---------- */
  const NAV = [
    { r: 'panel', t: 'Panel', i: 'chart' },
    { r: 'productos', t: 'Productos', i: 'box' },
    { r: 'categorias', t: 'Categorías', i: 'grid' },
    { r: 'promociones', t: 'Promociones', i: 'tag' },
    { r: 'cuentas', t: 'Cuentas', i: 'users', super: true },
    { r: 'ajustes', t: 'Ajustes', i: 'gear' },
  ];
  function montar() {
    document.body.className = 'adm-body';
    const rol = A.esSuper() ? 'Súper administrador' : 'Administrador';
    document.body.innerHTML = `
      <a class="skip" href="#vista">Saltar al contenido</a>
      <div class="adm">
        <nav class="adm-nav" id="admNav" aria-label="Secciones del panel">
          <a class="adm-marca" href="#/panel"><img src="img/marca/corona.png" alt=""><span>GANGA STORE<small>Panel de administración</small></span></a>
          <div class="adm-links">
            ${NAV.filter((n) => !n.super || A.esSuper()).map((n) => `<a href="#/${n.r}" data-r="${n.r}">${icon(n.i)} ${n.t}</a>`).join('')}
            <div class="sep"></div>
            <a href="./" target="_blank" rel="noopener" id="linkTienda">${icon('store')} Ver la tienda</a>
          </div>
          <div class="adm-usuario">
            <span class="avatar" aria-hidden="true">${esc((A.yo.name || A.yo.username).charAt(0).toUpperCase())}</span>
            <div><b>${esc(A.yo.name || A.yo.username)}</b><small>${rol}</small></div>
            <button class="btn btn-icono" id="btnSalir" type="button" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('logout')}</button>
          </div>
        </nav>
        <div class="adm-velo" id="admVelo"></div>
        <div class="adm-main">
          <header class="adm-top">
            <button class="btn btn-icono solo-movil" id="btnMenu" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="admNav">${icon('menu')}</button>
            <h1 id="admTitulo">Panel</h1>
            <div class="guardado" id="pubEstado" role="status" aria-live="polite"></div>
          </header>
          <main class="adm-cont" id="vista" tabindex="-1"></main>
        </div>
      </div>
      <div class="toast-zona" id="toasts" aria-live="polite"></div>`;
    const menu = (si) => {
      $('#admNav').classList.toggle('abierto', si);
      $('#admVelo').classList.toggle('abierto', si);
      $('#btnMenu').setAttribute('aria-expanded', String(si));
    };
    $('#btnMenu').onclick = () => menu(true);
    $('#admVelo').onclick = () => menu(false);
    $('#admNav').addEventListener('click', (e) => { if (e.target.closest('a')) menu(false); });
    $('#btnSalir').onclick = async () => {
      if (A.sucio && !(await A.confirmar({ titulo: 'Cerrar sesión', texto: A.estado === 'guardando' || A.estado === 'pendiente' ? 'Todavía se están guardando cambios. Esperá unos segundos para no perderlos.' : 'Hay cambios que no se pudieron guardar. Quedan en este dispositivo y se guardan la próxima vez que entres.', ok: 'Cerrar sesión igual' }))) return;
      A.salir();
    };
    $('#vista').addEventListener('click', (e) => { if (e.target.closest('[data-reintentar]')) A.subirAhora(); });
    $('#pubEstado').addEventListener('click', (e) => { if (e.target.closest('[data-acc=reintentar]')) A.subirAhora(); });
    pintarEstadoPub();
    window.onhashchange = rutear;
    window.onbeforeunload = (e) => {
      if ((A.guardia && A.guardia()) || A.sucio) { e.preventDefault(); e.returnValue = ''; }
    };
    if (A.sucio) programar(400);
    rutear();
  }
  function pintarEstadoPub() {
    const box = $('#pubEstado');
    if (!box) return;
    const e = A.estado;
    box.dataset.estado = e;
    if (e === 'error') box.innerHTML = `<button class="btn btn-chico btn-peligro" type="button" data-acc="reintentar" title="${esc(A.ultimoError)}">${icon('refresh')} <span>Reintentar</span></button>`;
    else if (e === 'guardando' || e === 'pendiente') box.innerHTML = `<span class="g-txt girando">${icon('refresh')} <span>Guardando…</span></span>`;
    else box.innerHTML = `<span class="g-txt ok" title="Todo está guardado en la base de datos">${icon('check')} <span>Guardado</span></span>`;
    const lt = $('#linkTienda');
    if (lt) lt.href = A.sucio ? './?preview=1' : './';
    const av = document.getElementById('avisoGuardado');
    if (av && A.vistas.avisoGuardado) av.innerHTML = A.vistas.avisoGuardado();
  }
  A.pintarEstadoPub = pintarEstadoPub;

  /* ---------- rutas ---------- */
  let ultimo = '';
  function rutear() {
    const h = location.hash || '#/panel';
    if (A.guardia && h !== ultimo && A.guardia()) {
      if (!confirm('Tenés cambios sin guardar en este formulario. ¿Salir igual?')) { history.replaceState(null, '', ultimo); return; }
    }
    A.guardia = null;
    ultimo = h;
    const partes = h.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    let clave = partes[0] || 'panel';
    if (clave === 'cuentas' && !A.esSuper()) clave = 'panel';
    const vista = A.vistas[clave] || A.vistas.panel;
    $$('.adm-links a[data-r]').forEach((a) => { if (a.dataset.r === clave) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    A.vista().innerHTML = '';
    window.scrollTo(0, 0);
    vista(partes.slice(1));
  }
  A.ir = (ruta) => { location.hash = ruta; };
  A.rutear = rutear;

  /* ---------- arranque ---------- */
  async function iniciar() {
    document.documentElement.setAttribute('data-tema', 'minimal');
    if (!DB.configurado() || !window.supabase) {
      cajaIngreso('', 'No se pudo conectar con la base de datos. Revisá tu conexión y recargá la página.');
      return;
    }
    let ses = null;
    try { ses = await DB.sesion(); } catch (e) { /* sin sesión */ }
    if (ses) await continuar();
    else pantallaIngreso();
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
