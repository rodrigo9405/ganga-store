/* Ganga Store — panel: estado, ingreso, estructura y publicación */
(function () {
  'use strict';
  const GS = window.GS;
  const { esc, $, $$, icon } = GS;
  const A = (GS.A = { vistas: {} });

  A.pub = null;      // versión publicada
  A.data = null;     // copia de trabajo (borrador)
  A.yo = null;       // cuenta que inició sesión
  A.sucio = false;

  /* ---------- contraseñas (PBKDF2-SHA256) ---------- */
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const deHex = (h) => new Uint8Array(h.match(/.{2}/g).map((x) => parseInt(x, 16)));
  A.hashPass = async (pass, saltHex, iter) => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: deHex(saltHex), iterations: iter, hash: 'SHA-256' }, key, 256);
    return hex(bits);
  };
  A.nuevaPass = async (pass) => {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const iter = 150000;
    return { salt, iter, hash: await A.hashPass(pass, salt, iter) };
  };
  A.generarPass = () => {
    const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const r = crypto.getRandomValues(new Uint32Array(12));
    return Array.from(r, (n) => abc[n % abc.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
  };
  A.validarPass = (p) => (p.length < 10 ? 'Usá al menos 10 caracteres.' : null);

  /* ---------- acceso a GitHub cifrado con la contraseña de cada cuenta (AES-GCM) ---------- */
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function claveDe(pass, saltHex, iter) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: deHex(saltHex), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  A.cifrar = async (texto, pass) => {
    const s = hex(crypto.getRandomValues(new Uint8Array(16))), iv = crypto.getRandomValues(new Uint8Array(12)), i = 200000;
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await claveDe(pass, s, i), new TextEncoder().encode(texto));
    return { s, iv: hex(iv), i, ct: b64(ct) };
  };
  A.descifrar = async (llave, pass) => {
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deHex(llave.iv) }, await claveDe(pass, llave.s, llave.i), deB64(llave.ct));
      return new TextDecoder().decode(pt);
    } catch (e) { return ''; }
  };
  /* Deja a una cuenta con acceso al guardado, cifrando el token con su contraseña */
  A.darAcceso = async (cuenta, pass) => {
    const tok = GS.github.config().token;
    if (tok) cuenta.llave = await A.cifrar(tok, pass);
  };
  A.pass = ''; // contraseña de esta sesión (solo en memoria, para cifrar el acceso si hace falta)

  /* ---------- datos ---------- */
  const firma = (d) => JSON.stringify(Object.assign({}, d, { rev: '', updatedAt: '', updatedBy: '' }));
  A.firma = firma;
  let borradorBase = null;
  async function cargarDatos() {
    const pub = await GS.cargarPublicado();
    const cuentas = await GS.cargarCuentas();
    if (cuentas) pub.accounts = cuentas;
    A.pub = GS.normalizar(pub);
    await GS.idb.del('publicadoLocal').catch(() => {});
    GS.imgCache = (await GS.idb.get('imgcache')) || {};
    const b = await GS.idb.get('borrador');
    borradorBase = b && b.data ? b : null;
    aplicarBorrador();
  }
  /* Junta lo guardado en GitHub con lo que haya quedado pendiente en este dispositivo */
  function aplicarBorrador() {
    const b = borradorBase;
    if (b && b.data) {
      const base = b.base || null;
      A.data = base && base.rev === A.pub.rev ? GS.normalizar(GS.clone(b.data)) : GS.normalizar(GS.fusionar(base, b.data, A.pub));
    } else A.data = GS.clone(A.pub);
    A.sucio = firma(A.data) !== firma(A.pub);
    if (A.yo) A.yo = A.cuenta(A.yo.id) || A.yo;
  }
  /* Trae la última versión directo del repositorio (sin esperar al hosting) */
  A.recargarDesdeGitHub = async () => {
    if (!GS.github.configurado()) return false;
    try {
      A.pub = await GS.github.leerRemoto();
      aplicarBorrador();
      return true;
    } catch (e) { A.ultimoError = e.message; return false; }
  };
  async function guardarBorrador() {
    try {
      if (A.sucio) { borradorBase = { data: A.data, base: A.pub, at: Date.now() }; await GS.idb.set('borrador', borradorBase); }
      else { borradorBase = null; await GS.idb.del('borrador'); }
    } catch (e) { /* sin almacenamiento local: queda en memoria hasta que se suba */ }
  }
  /* Se llama después de cada cambio: guarda en el dispositivo y sube a la tienda */
  A.guardar = async () => {
    A.sucio = firma(A.data) !== firma(A.pub);
    await guardarBorrador();
    if (A.sucio) { A.estado = GS.github.configurado() ? 'pendiente' : 'sin-conexion'; programar(900); }
    pintarEstadoPub();
  };
  A.descartarBorrador = async () => {
    A.data = GS.clone(A.pub);
    A.sucio = false;
    await guardarBorrador();
    A.estado = 'ok';
    pintarEstadoPub();
  };

  /* ---------- guardado automático ---------- */
  A.estado = 'ok';            // ok | pendiente | guardando | error | sin-conexion
  A.ultimoError = '';
  let timer = null, enCurso = false, avisoTienda = false;
  function programar(ms) { clearTimeout(timer); timer = setTimeout(subir, ms); }
  async function subir() {
    if (enCurso || !A.yo) return;
    if (!A.sucio) { A.estado = 'ok'; pintarEstadoPub(); return; }
    if (!GS.github.configurado()) { A.estado = 'sin-conexion'; pintarEstadoPub(); return; }
    enCurso = true;
    A.estado = 'guardando'; pintarEstadoPub();
    const enviado = GS.clone(A.data);
    const base = GS.clone(A.pub);
    try {
      const r = await GS.github.guardar(enviado, base, (A.yo && (A.yo.name || A.yo.username)) || '');
      Object.assign(GS.imgCache, r.cache);
      try { await GS.idb.set('imgcache', GS.imgCache); } catch (e) { /* nada */ }
      A.pub = GS.normalizar(GS.clone(r.data));
      A.data = firma(A.data) === firma(enviado) ? GS.clone(r.data) : GS.normalizar(GS.fusionar(enviado, A.data, r.data));
      A.yo = A.cuenta(A.yo.id) || A.yo;
      A.sucio = firma(A.data) !== firma(A.pub);
      await guardarBorrador();
      A.estado = A.sucio ? 'pendiente' : 'ok';
      A.ultimoError = '';
      A.ultimoGuardado = Date.now();
      if (r.fusion) {
        A.toast('Guardado. También se sumaron cambios que otra persona hizo hace un momento.');
        if (!A.guardia) rutear();
      } else if (!avisoTienda) {
        avisoTienda = true;
        A.toast('Guardado. La tienda se actualiza en uno o dos minutos.');
      }
    } catch (e) {
      A.estado = 'error';
      A.ultimoError = e.message;
      if (e.red) programar(20000);
    }
    enCurso = false;
    if (A.sucio && A.estado !== 'error') programar(300);
    pintarEstadoPub();
  }
  A.subirAhora = () => { clearTimeout(timer); return subir(); };
  window.addEventListener('online', () => { if (A.sucio) programar(500); });

  A.esSuper = () => A.yo && A.yo.role === 'superadmin';
  A.cuenta = (id) => A.data.accounts.find((a) => a.id === id);

  /* ---------- utilidades de interfaz ---------- */
  A.toast = (msg, error) => {
    const t = document.createElement('div');
    t.className = 'toast' + (error ? ' error' : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
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
  const SES = 'gs_sesion';
  const leerSesion = () => { try { return JSON.parse(sessionStorage.getItem(SES) || localStorage.getItem(SES) || 'null'); } catch (e) { return null; } };
  const guardarSesion = (s, recordar) => { try { sessionStorage.setItem(SES, JSON.stringify(s)); if (recordar) localStorage.setItem(SES, JSON.stringify(s)); } catch (e) { /* nada */ } };
  A.salir = () => { try { sessionStorage.removeItem(SES); localStorage.removeItem(SES); } catch (e) { /* nada */ } location.hash = ''; location.reload(); };

  function pantallaIngreso(msg) {
    document.body.className = '';
    document.body.innerHTML = `<main class="login">
      <div class="login-caja">
        <div class="login-marca"><img src="img/marca/corona.png" alt=""><h1>GANGA STORE</h1><p>Panel de administración</p></div>
        <form id="fIngreso" novalidate>
          <label class="campo"><span>Usuario</span><input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
          <label class="campo"><span>Contraseña</span><input name="p" type="password" autocomplete="current-password" required></label>
          <label class="check"><input type="checkbox" name="r"> <span>Mantener la sesión abierta en este dispositivo</span></label>
          <p class="error" id="eIngreso" role="alert">${esc(msg || '')}</p>
          <button class="btn btn-block" type="submit">Ingresar</button>
        </form>
        <p class="login-pie"><a href="./">Ir a la tienda</a></p>
      </div></main><div class="toast-zona" id="toasts" aria-live="polite"></div>`;
    $('#fIngreso [name=u]').focus();
    $('#fIngreso').onsubmit = async (e) => {
      e.preventDefault();
      const f = A.leerForm(e.target);
      const btn = $('#fIngreso button');
      const usuario = String(f.u || '').trim().toLowerCase();
      if (!usuario || !f.p) { $('#eIngreso').textContent = 'Completá usuario y contraseña.'; return; }
      btn.disabled = true; btn.textContent = 'Verificando…';
      const cta = A.data.accounts.find((a) => a.username.toLowerCase() === usuario);
      let ok = false;
      if (cta) ok = (await A.hashPass(f.p, cta.salt, cta.iter)) === cta.hash;
      if (!ok) {
        btn.disabled = false; btn.textContent = 'Ingresar';
        $('#eIngreso').textContent = 'Usuario o contraseña incorrectos. Si la cuenta o la contraseña se cambiaron hace menos de un minuto, esperá un momento y probá de nuevo.';
        return;
      }
      if (!cta.active) { btn.disabled = false; btn.textContent = 'Ingresar'; $('#eIngreso').textContent = 'Esta cuenta está desactivada. Pedile acceso al súper administrador.'; return; }
      const recordar = f.r === 'on';
      guardarSesion({ id: cta.id, t: Date.now() }, recordar);
      GS.visitas.excluirDispositivo(true);
      A.pass = f.p;
      // El acceso al guardado viene cifrado con la contraseña: nadie tiene que configurar nada
      if (cta.llave) {
        const tok = await A.descifrar(cta.llave, f.p);
        if (tok) GS.github.usarToken(tok, recordar);
      }
      btn.textContent = 'Entrando…';
      await A.recargarDesdeGitHub();
      A.yo = A.cuenta(cta.id) || cta;
      // si esta cuenta todavía no tenía el acceso cifrado y este dispositivo sí lo tiene, se lo agrega
      if (GS.github.configurado() && !A.yo.llave) { await A.darAcceso(A.yo, f.p); await A.guardar(); }
      montar();
      if (A.yo.mustChange) A.cambiarPassObligatorio();
      else if (A.esSuper() && !GS.github.configurado()) A.conectarGuardado();
    };
  }

  A.cambiarPassObligatorio = () => {
    const d = A.dialogo({
      titulo: 'Elegí tu contraseña',
      cuerpo: `<p>Es tu primer ingreso. Cambiá la contraseña inicial por una tuya antes de seguir.</p>
        <label class="campo"><span>Contraseña nueva</span><input type="password" id="pn1" autocomplete="new-password"><small>Al menos 10 caracteres.</small></label>
        <label class="campo"><span>Repetila</span><input type="password" id="pn2" autocomplete="new-password"></label>
        <p class="error-campo" id="pnErr" role="alert"></p>`,
      pie: '<button class="btn" type="button" id="pnOk">Guardar contraseña</button>',
    });
    $('[data-cerrar]', d).remove();
    d.addEventListener('cancel', (e) => e.preventDefault());
    $('#pnOk', d).onclick = async () => {
      const a = $('#pn1', d).value, b = $('#pn2', d).value;
      const err = A.validarPass(a) || (a !== b ? 'Las contraseñas no coinciden.' : null);
      if (err) { $('#pnErr', d).textContent = err; return; }
      $('#pnOk', d).disabled = true;
      const cta = A.cuenta(A.yo.id);
      Object.assign(cta, await A.nuevaPass(a), { mustChange: false });
      await A.darAcceso(cta, a);
      A.pass = a;
      A.yo = cta;
      await A.guardar();
      d.close();
      A.toast('Contraseña guardada.');
      rutear();
      if (A.esSuper() && !GS.github.configurado()) A.conectarGuardado();
    };
  };

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
      if (A.sucio && !(await A.confirmar({ titulo: 'Cerrar sesión', texto: A.estado === 'guardando' || A.estado === 'pendiente' ? 'Todavía se están guardando cambios. Esperá unos segundos para no perderlos.' : 'Hay cambios que no se pudieron subir a la tienda. Quedan en este dispositivo y se suben la próxima vez que entres.', ok: 'Cerrar sesión igual' }))) return;
      GS.github.olvidarToken();
      A.salir();
    };
    $('#vista').addEventListener('click', (e) => {
      if (e.target.closest('[data-conectar]')) { e.preventDefault(); A.conectarGuardado(); }
      if (e.target.closest('[data-reintentar]')) A.subirAhora();
    });
    $('#pubEstado').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.acc === 'conectar') A.conectarGuardado();
      if (b.dataset.acc === 'reintentar') A.subirAhora();
    });
    pintarEstadoPub();
    window.onhashchange = rutear;
    window.onbeforeunload = (e) => {
      if ((A.guardia && A.guardia()) || (A.sucio && GS.github.configurado())) { e.preventDefault(); e.returnValue = ''; }
    };
    if (A.sucio) programar(400);
    rutear();
  }
  function pintarEstadoPub() {
    const box = $('#pubEstado');
    if (!box) return;
    const e = A.sucio && !GS.github.configurado() ? 'sin-conexion' : A.estado;
    box.dataset.estado = e;
    if (e === 'sin-conexion') box.innerHTML = `<button class="btn btn-chico btn-peligro" type="button" data-acc="conectar" title="Los cambios quedan solo en este dispositivo">${icon('alert')} <span>Sin guardar</span></button>`;
    else if (e === 'error') box.innerHTML = `<button class="btn btn-chico btn-peligro" type="button" data-acc="reintentar" title="${esc(A.ultimoError)}">${icon('refresh')} <span>Reintentar</span></button>`;
    else if (e === 'guardando' || e === 'pendiente') box.innerHTML = `<span class="g-txt girando">${icon('refresh')} <span>Guardando…</span></span>`;
    else box.innerHTML = `<span class="g-txt ok" title="Todo está guardado en la tienda">${icon('check')} <span>Guardado</span></span>`;
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

  /* ---------- activar el guardado (una sola vez, el súper administrador) ---------- */
  A.publicar = () => (GS.github.configurado() ? A.subirAhora() : A.conectarGuardado());
  A.conectarGuardado = () => {
    if (!A.esSuper()) {
      A.dialogo({
        titulo: 'Tu cuenta todavía no puede guardar',
        cuerpo: `<p>Lo que cambiás queda solo en este dispositivo. Para que se guarde en la tienda, pedile al súper administrador que entre a <b>Cuentas</b> y te genere una contraseña nueva. Con esa contraseña tu cuenta guarda sola, sin configurar nada.</p>`,
        pie: '<button class="btn" type="button" data-cerrar>Entendido</button>',
      });
      return;
    }
    const c = GS.github.config();
    const d = A.dialogo({
      titulo: 'Activar el guardado',
      ancho: 'min(94vw, 600px)',
      cuerpo: `<p>La tienda guarda productos, fotos y cuentas en tu repositorio de GitHub. Para que el panel pueda escribir ahí necesita una llave de acceso (token). Se crea <b>una sola vez</b>: después, cada cambio se guarda solo y las demás cuentas no tienen que configurar nada.</p>
        <ol class="guia">
          <li><span>Abrí <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub, crear token</a> con tu cuenta <b>${esc(c.owner)}</b>.</span></li>
          <li><span>Token name: <span class="codigo">Panel Ganga Store</span>. Expiration: <b>No expiration</b> o un año.</span></li>
          <li><span>Repository access: <b>Only select repositories</b> y elegí <span class="codigo">${esc(c.repo)}</span>.</span></li>
          <li><span>Permissions → Repository permissions → <b>Contents</b>: <b>Read and write</b>.</span></li>
          <li><span>Tocá <b>Generate token</b>, copialo y pegalo acá abajo.</span></li>
        </ol>
        <label class="campo"><span>Token</span><input id="cgTok" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
        ${A.pass ? '' : '<label class="campo"><span>Tu contraseña del panel</span><input id="cgPass" type="password" autocomplete="current-password"><small>Para guardar el acceso cifrado con tu cuenta.</small></label>'}
        <p id="cgMsg" role="status"></p>`,
      pie: '<button class="btn btn-suave" type="button" data-cerrar>Más tarde</button><button class="btn" type="button" id="cgOk">Activar guardado</button>',
    });
    $('#cgOk', d).onclick = async () => {
      const tok = $('#cgTok', d).value.trim();
      const passEl = $('#cgPass', d);
      const pass = passEl ? passEl.value : A.pass;
      const msg = $('#cgMsg', d);
      if (!tok) { msg.innerHTML = '<span class="error-campo">Pegá el token.</span>'; return; }
      const cta = A.cuenta(A.yo.id);
      if (passEl && (await A.hashPass(pass, cta.salt, cta.iter)) !== cta.hash) { msg.innerHTML = '<span class="error-campo">La contraseña no es correcta.</span>'; return; }
      $('#cgOk', d).disabled = true;
      msg.textContent = 'Probando la conexión con GitHub…';
      const anterior = GS.github.config().token;
      GS.github.usarToken(tok, true);
      try {
        await GS.github.probar();
      } catch (e) {
        GS.github.usarToken(anterior, true);
        $('#cgOk', d).disabled = false;
        msg.innerHTML = `<span class="error-campo">${esc(e.status === 401 ? 'GitHub no aceptó ese token. Revisá que lo hayas copiado completo, desde github_pat_ hasta el final.' : e.message)}</span>`;
        return;
      }
      msg.textContent = 'Conectado. Guardando lo que tenías pendiente…';
      await A.recargarDesdeGitHub();
      A.yo = A.cuenta(A.yo.id) || A.yo;
      A.pass = pass;
      await A.darAcceso(A.yo, pass);
      await A.guardar();
      await A.subirAhora();
      d.close();
      const sinAcceso = A.data.accounts.filter((x) => x.active && !x.llave && x.id !== A.yo.id);
      A.toast(sinAcceso.length ? `Guardado activado. Para que ${sinAcceso.map((x) => x.username).join(', ')} también pueda guardar, generale una contraseña nueva en Cuentas.` : 'Guardado activado. Desde ahora cada cambio se guarda solo.');
      rutear();
    };
    setTimeout(() => $('#cgTok', d).focus(), 50);
  };

  /* ---------- arranque ---------- */
  async function iniciar() {
    document.documentElement.setAttribute('data-tema', 'minimal');
    try {
      await cargarDatos();
      if (GS.irADominioPropio(A.pub.settings)) return;
    } catch (e) {
      document.body.innerHTML = `<main class="login"><div class="login-caja"><div class="aviso peligro">${icon('alert')}<div><b>No se pudieron cargar los datos de la tienda.</b><span>${esc(e.message)}</span></div></div><button class="btn" onclick="location.reload()">Reintentar</button></div></main>`;
      return;
    }
    if (!window.crypto || !crypto.subtle) {
      pantallaIngreso('Este navegador no permite ingresar de forma segura. Abrí el panel desde la dirección https de la tienda.');
      return;
    }
    const s = leerSesion();
    const cta = s && A.cuenta(s.id);
    if (cta && cta.active) {
      await A.recargarDesdeGitHub();
      A.yo = A.cuenta(cta.id) || cta;
      montar();
      if (A.yo.mustChange) A.cambiarPassObligatorio();
    } else pantallaIngreso();
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
