/* Ganga Store — cuentas de administradores (solo súper administrador) */
(function () {
  'use strict';
  const GS = window.GS, A = GS.A;
  const { esc, $, $$, icon } = GS;
  const ROLES = { superadmin: 'Súper administrador', admin: 'Administrador' };

  A.vistas.cuentas = () => {
    if (!A.esSuper()) return A.ir('#/panel');
    A.titulo('Cuentas');
    const d = A.data;
    const cs = d.accounts;
    const activas = cs.filter((c) => c.active).length;
    const supers = cs.filter((c) => c.role === 'superadmin' && c.active).length;
    A.vista().innerHTML = `
      <div class="fila-tiles">
        <div class="tile"><span>Cuentas</span><b>${cs.length}</b></div>
        <div class="tile"><span>Activas</span><b>${activas}</b><small>pueden ingresar</small></div>
        <div class="tile"><span>Desactivadas</span><b>${cs.length - activas}</b><small>sin acceso</small></div>
        <div class="tile"><span>Súper administradores</span><b>${supers}</b><small>activos</small></div>
      </div>
      <section class="bloque"><div class="bloque-cab"><h2>Equipo</h2><button class="btn" type="button" id="nueva">${icon('plus')} Agregar cuenta</button>
        <p>Los administradores cargan productos, categorías y promos y ven las visitas. Solo un súper administrador maneja las cuentas.</p></div>
        <div class="lista">${[...cs].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'superadmin' ? -1 : 1)).map((c) => {
          const soyYo = c.id === A.yo.id;
          return `<div class="item" data-id="${esc(c.id)}" style="--th:44px">
            <span class="avatar" style="width:44px;height:44px">${esc((c.name || c.username).charAt(0).toUpperCase())}</span>
            <div class="item-txt"><b>${esc(c.name)}${soyYo ? ' <small>(vos)</small>' : ''}</b><small>Usuario: ${esc(c.username)}, creada el ${esc(GS.fechaHora(c.createdAt).split(',')[0])}</small>
              <div class="item-meta"><span class="etq ${c.role === 'superadmin' ? 'oro' : 'gris'}">${ROLES[c.role]}</span><span class="etq ${c.active ? 'ok' : 'mal'}">${c.active ? 'Activa' : 'Desactivada'}</span>${c.mustChange ? '<span class="etq warn">Debe cambiar la contraseña</span>' : ''}${GS.github.configurado() && c.active && !c.llave ? '<span class="etq mal">No puede guardar: generale una contraseña nueva</span>' : ''}</div></div>
            <div class="item-acc">
              <button class="btn btn-suave" type="button" data-edit>${icon('edit')} Editar</button>
              <button class="btn btn-suave" type="button" data-pass>${icon('key')} Contraseña</button>
              ${soyYo ? '' : `<button class="btn btn-suave" type="button" data-act>${c.active ? 'Desactivar' : 'Activar'}</button><button class="btn btn-suave" type="button" data-del aria-label="Eliminar ${esc(c.name)}">${icon('trash')}</button>`}
            </div></div>`;
        }).join('')}</div>
      </section>
      <div style="margin-top:16px">${A.vistas.avisoGuardado ? A.vistas.avisoGuardado() : ''}</div>
      <p class="ayuda" style="margin-top:12px">Los cambios en las cuentas se guardan solos. Una cuenta o contraseña nueva puede tardar un minuto en funcionar en otros dispositivos.</p>`;

    $('#nueva').onclick = () => formulario(null);
    $$('.lista .item').forEach((it) => {
      const c = d.accounts.find((x) => x.id === it.dataset.id);
      $('[data-edit]', it).onclick = () => formulario(c);
      $('[data-pass]', it).onclick = () => cambiarPass(c);
      const act = $('[data-act]', it);
      if (act) act.onclick = async () => {
        if (c.active && c.role === 'superadmin' && supers <= 1) { A.toast('Tiene que quedar al menos un súper administrador activo.', true); return; }
        if (c.active && !(await A.confirmar({ titulo: 'Desactivar cuenta', texto: `${esc(c.name)} no va a poder ingresar al panel hasta que la actives de nuevo.`, ok: 'Desactivar' }))) return;
        c.active = !c.active;
        await A.guardar(); A.toast(c.active ? 'Cuenta activada' : 'Cuenta desactivada'); A.rutear();
      };
      const del = $('[data-del]', it);
      if (del) del.onclick = async () => {
        if (c.role === 'superadmin' && c.active && supers <= 1) { A.toast('Tiene que quedar al menos un súper administrador activo.', true); return; }
        if (!(await A.confirmar({ titulo: 'Eliminar cuenta', texto: `Vas a eliminar la cuenta de ${esc(c.name)} (${esc(c.username)}). Si solo querés quitarle el acceso por un tiempo, desactivala.`, ok: 'Eliminar', peligro: true }))) return;
        d.accounts = d.accounts.filter((x) => x.id !== c.id);
        await A.guardar(); A.toast('Cuenta eliminada'); A.rutear();
      };
    });
  };

  function formulario(c) {
    const nueva = !c;
    const d = A.data;
    const supers = d.accounts.filter((x) => x.role === 'superadmin' && x.active).length;
    const pass = nueva ? A.generarPass() : '';
    const dlg = A.dialogo({
      titulo: nueva ? 'Agregar cuenta' : 'Editar cuenta',
      cuerpo: `<label class="campo"><span>Nombre</span><input id="cNombre" value="${esc(c ? c.name : '')}" maxlength="50" placeholder="Ej: Lucía Fernández"></label>
        <label class="campo"><span>Usuario</span><input id="cUser" value="${esc(c ? c.username : '')}" maxlength="30" autocapitalize="none" spellcheck="false" placeholder="Ej: lucia"><small>Con el que ingresa. Solo letras, números, puntos y guiones.</small></label>
        <label class="campo"><span>Rol</span><select id="cRol">${Object.entries(ROLES).map(([k, t]) => `<option value="${k}" ${(c ? c.role : 'admin') === k ? 'selected' : ''}>${t}</option>`).join('')}</select><small>El súper administrador además maneja las cuentas.</small></label>
        ${nueva ? `<label class="campo"><span>Contraseña inicial</span><div class="pass-campo"><input id="cPass" value="${esc(pass)}" autocomplete="off"><button class="btn btn-suave" type="button" id="cGen">Generar</button></div><small>Pasásela a la persona. Le vamos a pedir que la cambie al primer ingreso.</small></label>` : ''}
        <p class="error-campo" id="cErr" role="alert"></p>`,
      pie: `<button class="btn btn-suave" type="button" data-cerrar>Cancelar</button><button class="btn" type="button" id="cOk">${nueva ? 'Crear cuenta' : 'Guardar'}</button>`,
    });
    const gen = $('#cGen', dlg);
    if (gen) gen.onclick = () => { $('#cPass', dlg).value = A.generarPass(); };
    $('#cOk', dlg).onclick = async () => {
      const nombre = $('#cNombre', dlg).value.trim();
      const user = $('#cUser', dlg).value.trim().toLowerCase();
      const rol = $('#cRol', dlg).value;
      let err = '';
      if (!nombre) err = 'Escribí el nombre.';
      else if (!/^[a-z0-9._-]{3,30}$/.test(user)) err = 'El usuario debe tener entre 3 y 30 caracteres: letras sin tilde, números, puntos o guiones.';
      else if (d.accounts.some((x) => x.username === user && (!c || x.id !== c.id))) err = 'Ese usuario ya existe.';
      else if (c && c.role === 'superadmin' && rol !== 'superadmin' && c.active && supers <= 1) err = 'Tiene que quedar al menos un súper administrador activo.';
      let p = '';
      if (!err && nueva) { p = $('#cPass', dlg).value; err = A.validarPass(p) || ''; }
      $('#cErr', dlg).textContent = err;
      if (err) return;
      $('#cOk', dlg).disabled = true;
      if (nueva) {
        const cta = Object.assign({ id: GS.uid('u'), username: user, name: nombre, role: rol, active: true, mustChange: true, createdAt: new Date().toISOString() }, await A.nuevaPass(p));
        await A.darAcceso(cta, p);
        d.accounts.push(cta);
      } else Object.assign(c, { name: nombre, username: user, role: rol });
      await A.guardar();
      dlg.close();
      if (c && c.id === A.yo.id) { A.yo = c; }
      if (nueva) mostrarDatos(nombre, user, p);
      else A.toast('Cuenta actualizada');
      if (c && c.id === A.yo.id && rol !== 'superadmin') location.reload(); else A.rutear();
    };
  }

  function cambiarPass(c) {
    const dlg = A.dialogo({
      titulo: 'Cambiar contraseña',
      cuerpo: `<p>Nueva contraseña para <b>${esc(c.name)}</b> (${esc(c.username)}).</p>
        <label class="campo"><span>Contraseña</span><div class="pass-campo"><input id="pp" value="${esc(A.generarPass())}" autocomplete="off"><button class="btn btn-suave" type="button" id="ppGen">Generar</button></div></label>
        ${c.id !== A.yo.id ? '<label class="check"><input type="checkbox" id="ppForzar" checked><span>Pedirle que la cambie al ingresar</span></label>' : ''}
        <p class="error-campo" id="ppErr" role="alert"></p>`,
      pie: '<button class="btn btn-suave" type="button" data-cerrar>Cancelar</button><button class="btn" type="button" id="ppOk">Guardar contraseña</button>',
    });
    $('#ppGen', dlg).onclick = () => { $('#pp', dlg).value = A.generarPass(); };
    $('#ppOk', dlg).onclick = async () => {
      const v = $('#pp', dlg).value;
      const err = A.validarPass(v);
      $('#ppErr', dlg).textContent = err || '';
      if (err) return;
      $('#ppOk', dlg).disabled = true;
      const forzar = $('#ppForzar', dlg);
      Object.assign(c, await A.nuevaPass(v), { mustChange: forzar ? forzar.checked : false });
      await A.darAcceso(c, v);
      if (c.id === A.yo.id) A.pass = v;
      await A.guardar();
      dlg.close();
      A.rutear();
      if (c.id !== A.yo.id) mostrarDatos(c.name, c.username, v);
      else A.toast('Contraseña actualizada');
    };
  }

  /* Muestra usuario y contraseña para pasárselos a la persona */
  function mostrarDatos(nombre, user, pass) {
    const d = A.dialogo({
      titulo: 'Datos para ingresar',
      cuerpo: `<p>Pasale estos datos a <b>${esc(nombre)}</b>. Al entrar le vamos a pedir que elija su propia contraseña.</p>
        <ul class="cambios"><li><span>Dirección</span><span class="codigo">${esc(location.origin + location.pathname)}</span></li><li><span>Usuario</span><span class="codigo">${esc(user)}</span></li><li><span>Contraseña</span><span class="codigo">${esc(pass)}</span></li></ul>
        <p class="ayuda">Puede tardar un minuto en funcionar en otros dispositivos.</p>`,
      pie: '<button class="btn btn-suave" type="button" id="mdCopiar">Copiar</button><button class="btn" type="button" data-cerrar>Listo</button>',
    });
    $('#mdCopiar', d).onclick = async () => {
      try { await navigator.clipboard.writeText(`Panel Ganga Store\n${location.origin + location.pathname}\nUsuario: ${user}\nContraseña: ${pass}`); A.toast('Copiado'); } catch (e) { A.toast('No se pudo copiar. Anotalos a mano.', true); }
    };
  }
})();
