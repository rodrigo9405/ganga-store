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
  A.validarPass = (p) => (p.length < 8 ? 'Usá al menos 8 caracteres.' : null);

  /* ---------- datos ---------- */
  const firma = (d) => JSON.stringify(Object.assign({}, d, { rev: '', updatedAt: '', updatedBy: '' }));
  async function cargarDatos() {
    let pub = await GS.cargarPublicado();
    // Recién publicado: GitHub Pages puede tardar en servir la versión nueva
    const reciente = await GS.idb.get('publicadoLocal');
    if (reciente && reciente.data) {
      if (reciente.data.rev === pub.rev || Date.now() - reciente.at > 15 * 60000) await GS.idb.del('publicadoLocal');
      else { pub = reciente.data; A.esperandoPages = true; }
    }
    A.pub = GS.normalizar(pub);
    GS.imgCache = (await GS.idb.get('imgcache')) || {};
    const b = await GS.idb.get('borrador');
    A.conflicto = false;
    if (b && b.data) {
      A.data = GS.normalizar(b.data);
      if (b.baseRev && b.baseRev !== A.pub.rev && firma(b.data) !== firma(A.pub)) A.conflicto = true;
    } else A.data = GS.clone(A.pub);
    A.sucio = firma(A.data) !== firma(A.pub);
  }
  /* Guarda el borrador después de cada cambio */
  A.guardar = async () => {
    A.sucio = firma(A.data) !== firma(A.pub);
    if (A.sucio) await GS.idb.set('borrador', { data: A.data, baseRev: A.pub.rev, at: Date.now() });
    else await GS.idb.del('borrador');
    pintarEstadoPub();
  };
  A.descartarBorrador = async () => {
    A.data = GS.clone(A.pub);
    A.conflicto = false;
    await GS.idb.del('borrador');
    A.sucio = false;
    pintarEstadoPub();
  };
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
      btn.disabled = false; btn.textContent = 'Ingresar';
      if (!ok) { $('#eIngreso').textContent = 'Usuario o contraseña incorrectos.'; return; }
      if (!cta.active) { $('#eIngreso').textContent = 'Esta cuenta está desactivada. Pedile acceso al súper administrador.'; return; }
      guardarSesion({ id: cta.id, t: Date.now() }, f.r === 'on');
      GS.visitas.excluirDispositivo(true);
      A.yo = cta;
      montar();
      if (cta.mustChange) A.cambiarPassObligatorio();
    };
  }

  A.cambiarPassObligatorio = () => {
    const d = A.dialogo({
      titulo: 'Elegí tu contraseña',
      cuerpo: `<p>Es tu primer ingreso. Cambiá la contraseña inicial por una tuya antes de seguir.</p>
        <label class="campo"><span>Contraseña nueva</span><input type="password" id="pn1" autocomplete="new-password"><small>Al menos 8 caracteres.</small></label>
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
      const cta = A.cuenta(A.yo.id);
      Object.assign(cta, await A.nuevaPass(a), { mustChange: false });
      A.yo = cta;
      await A.guardar();
      d.close();
      A.toast('Contraseña guardada. Publicá los cambios para que valga en todos los dispositivos.');
      rutear();
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
            <div class="pub-estado" id="pubEstado">
              <span class="punto">Cambios sin publicar</span>
              <button class="btn btn-publicar" id="btnPublicar" type="button">${icon('cloud')} Publicar</button>
            </div>
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
      if (A.sucio && !(await A.confirmar({ titulo: 'Cerrar sesión', texto: 'Tenés cambios sin publicar. Quedan guardados en este dispositivo y los vas a ver la próxima vez que entres.', ok: 'Cerrar sesión' }))) return;
      A.salir();
    };
    $('#btnPublicar').onclick = () => A.publicar();
    pintarEstadoPub();
    window.onhashchange = rutear;
    window.onbeforeunload = (e) => { if (A.guardia && A.guardia()) { e.preventDefault(); e.returnValue = ''; } };
    rutear();
  }
  function pintarEstadoPub() {
    const box = $('#pubEstado');
    if (!box) return;
    box.classList.toggle('sucio', A.sucio);
    const b = $('#btnPublicar');
    b.dataset.sucio = String(A.sucio);
    b.title = A.sucio ? 'Publicar los cambios en la tienda' : 'No hay cambios para publicar';
    const lt = $('#linkTienda');
    if (lt) lt.href = A.sucio ? './?preview=1' : './';
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

  /* ---------- publicar ---------- */
  const PASOS = [['conectar', 'Conectar con GitHub'], ['fotos', 'Subir fotos nuevas'], ['datos', 'Guardar productos, promos y ajustes'], ['commit', 'Publicar la versión nueva']];
  function resumenCambios() {
    const n = A.data, v = A.pub;
    const cmp = (lista) => {
      const a = new Map((v[lista] || []).map((x) => [x.id, JSON.stringify(x)]));
      const b = new Map((n[lista] || []).map((x) => [x.id, JSON.stringify(x)]));
      let nuevos = 0, editados = 0, borrados = 0;
      b.forEach((val, id) => { if (!a.has(id)) nuevos++; else if (a.get(id) !== val) editados++; });
      a.forEach((_, id) => { if (!b.has(id)) borrados++; });
      return { nuevos, editados, borrados };
    };
    const filas = [['products', 'Productos'], ['categories', 'Categorías'], ['promotions', 'Promociones'], ['accounts', 'Cuentas']].map(([k, t]) => {
      const c = cmp(k);
      const partes = [];
      if (c.nuevos) partes.push(`${c.nuevos} ${c.nuevos === 1 ? 'nuevo' : 'nuevos'}`);
      if (c.editados) partes.push(`${c.editados} ${c.editados === 1 ? 'editado' : 'editados'}`);
      if (c.borrados) partes.push(`${c.borrados} ${c.borrados === 1 ? 'eliminado' : 'eliminados'}`);
      return partes.length ? `<li><span>${t}</span><span>${partes.join(', ')}</span></li>` : '';
    }).join('');
    const ajustes = JSON.stringify(n.settings) !== JSON.stringify(v.settings) ? '<li><span>Ajustes de la tienda</span><span>modificados</span></li>' : '';
    const fotos = GS.github.contarFotosNuevas(n);
    return `<ul class="cambios">${filas}${ajustes}${fotos ? `<li><span>Fotos nuevas</span><span>${fotos}</span></li>` : ''}</ul>`;
  }
  A.publicar = async () => {
    if (!A.sucio) { A.toast('No hay cambios para publicar. La tienda ya muestra la última versión.'); return; }
    if (!GS.github.configurado()) {
      const d = A.dialogo({
        titulo: 'Conectá GitHub para publicar',
        cuerpo: `<p>Tus cambios están guardados en este dispositivo. Para que los vean tus clientes, el panel los sube al repositorio de GitHub donde vive la tienda.</p>
          <p>${A.esSuper() ? 'Configurá el acceso una sola vez en Ajustes, sección Publicación.' : 'Pedile al súper administrador un token de GitHub y cargalo en Ajustes, sección Publicación.'}</p>`,
        pie: `<button class="btn btn-suave" data-cerrar type="button">Más tarde</button><a class="btn" href="#/ajustes/publicacion" data-cerrar>Ir a Publicación</a>`,
      });
      return d;
    }
    const d = A.dialogo({
      titulo: 'Publicar cambios',
      cuerpo: `<p>Estos cambios van a quedar visibles para todos en la tienda:</p>${resumenCambios()}
        <ul class="progreso" id="progreso" hidden>${PASOS.map(([k, t]) => `<li data-p="${k}">${icon('check')} <span>${t}</span></li>`).join('')}</ul>
        <div id="pubMsg" role="status"></div>`,
      pie: `<a class="btn btn-suave" href="./?preview=1" target="_blank" rel="noopener" id="pubPrev">${icon('eye')} Vista previa</a><button class="btn" type="button" id="pubOk">${icon('cloud')} Publicar ahora</button>`,
    });
    $('#pubOk', d).onclick = async () => {
      const btn = $('#pubOk', d);
      btn.disabled = true;
      const msg = $('#pubMsg', d);
      try {
        const remota = await GS.github.revRemota();
        if (remota && remota !== A.pub.rev) {
          const seguir = await A.confirmar({ titulo: 'Hay una versión más nueva', texto: 'Otra persona publicó cambios después de que empezaste a editar. Si publicás ahora, tu versión reemplaza la suya. Si preferís, descartá tus cambios en Ajustes y empezá de nuevo desde la versión publicada.', ok: 'Publicar igual', peligro: true });
          if (!seguir) { btn.disabled = false; return; }
        }
        $('#progreso', d).hidden = false;
        const marcar = (paso, det) => {
          const idx = PASOS.findIndex((p) => p[0] === paso);
          $$('#progreso li', d).forEach((li, i) => {
            li.className = i < idx || paso === 'listo' ? 'ok' : i === idx ? 'activo' : '';
            if (i === idx && det) li.querySelector('span').textContent = `${PASOS[i][1]} (${det})`;
          });
        };
        const r = await GS.github.publicar(A.data, A.pub, A.yo.name || A.yo.username, marcar);
        Object.assign(GS.imgCache, r.cache);
        await GS.idb.set('imgcache', GS.imgCache);
        A.pub = GS.normalizar(GS.clone(r.data));
        A.data = GS.normalizar(GS.clone(r.data));
        A.yo = A.cuenta(A.yo.id) || A.yo;
        await GS.idb.set('publicadoLocal', { data: r.data, at: Date.now() });
        await GS.idb.del('borrador');
        A.sucio = false; A.conflicto = false;
        pintarEstadoPub();
        msg.innerHTML = `<div class="aviso">${icon('check')}<div><b>Publicado.</b><span id="pubOnline">GitHub Pages está actualizando la tienda. Suele tardar uno o dos minutos.</span></div></div>`;
        btn.remove();
        msg.scrollIntoView({ block: 'nearest' });
        $('#pubPrev', d).outerHTML = '<button class="btn" type="button" data-cerrar>Listo</button>';
        GS.github.esperarOnline(r.data.rev, (ok) => {
          const el = document.getElementById('pubOnline');
          if (el) el.textContent = ok ? 'La tienda ya muestra los cambios.' : 'GitHub todavía está procesando. Revisá la tienda en unos minutos.';
          if (ok) { GS.idb.del('publicadoLocal'); A.toast('La tienda ya muestra los cambios publicados.'); }
        });
        rutear();
      } catch (e) {
        btn.disabled = false;
        $$('#progreso li.activo', d).forEach((li) => (li.className = 'mal'));
        msg.innerHTML = `<div class="aviso peligro">${icon('alert')}<div><b>No se pudo publicar.</b><span>${esc(e.message)}</span><span>Tus cambios siguen guardados en este dispositivo.</span></div></div>`;
      }
    };
  };

  /* ---------- arranque ---------- */
  async function iniciar() {
    document.documentElement.setAttribute('data-tema', 'minimal');
    try { await cargarDatos(); } catch (e) {
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
      A.yo = cta;
      montar();
      if (cta.mustChange) A.cambiarPassObligatorio();
    } else pantallaIngreso();
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
