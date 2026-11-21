/* Ganga Store — cuentas del panel (solo súper administrador).
   Existen únicamente dos cuentas fijas: el súper administrador y un administrador.
   No se pueden crear ni eliminar cuentas desde ninguna de las dos. */
(function () {
  'use strict';
  const GS = window.GS, A = GS.A;
  const { esc, $, $$, icon } = GS;
  const ROLES = { superadmin: 'Súper administrador', admin: 'Administrador' };

  A.vistas.cuentas = () => {
    if (!A.esSuper()) return A.ir('#/panel');
    A.titulo('Cuentas');
    const d = A.data;
    const cs = [...d.accounts].sort((a, b) => (a.role === 'superadmin' ? -1 : b.role === 'superadmin' ? 1 : 0));
    const activa = !A.negocio || A.negocio.activo !== false;
    const desde = A.negocio && A.negocio.desde ? GS.fechaHora(A.negocio.desde) : '';
    A.vista().innerHTML = `
      <section class="bloque" id="negocio"><div class="bloque-cab"><h2>Estado de la tienda</h2>
        <p>Si hace falta (por ejemplo, por falta de pago), podés suspender la tienda temporalmente. No se borra nada: al reactivarla, todo vuelve a estar como estaba.</p></div>
        ${activa
          ? `<div class="aviso" style="background:#eef6f0;border-color:#b9d3c1">${icon('check')}<div><b>Activa.</b><span>Tus clientes ven la tienda y el administrador puede entrar al panel.</span></div></div>
             <button class="btn btn-peligro" type="button" id="btnSuspender">${icon('alert')} Suspender la tienda</button>`
          : `<div class="aviso peligro">${icon('alert')}<div><b>${desde ? 'Suspendida desde el ' + esc(desde) : 'Suspendida.'}</b><span>Tus clientes ven "Página en mantenimiento" y el administrador no puede entrar ni cambiar nada.</span></div></div>
             <button class="btn" type="button" id="btnReactivar">${icon('check')} Reactivar la tienda</button>`}
      </section>
      <section class="bloque"><div class="bloque-cab"><h2>Cuentas del panel</h2>
        <p>La tienda tiene solo estas dos cuentas. No se pueden crear ni eliminar: podés cambiar sus datos y contraseñas, y desactivar la del administrador.</p></div>
        <div class="lista">${cs.map((c) => {
          const soyYo = c.id === A.yo.id;
          return `<div class="item" data-id="${esc(c.id)}" style="--th:44px">
            <span class="avatar" style="width:44px;height:44px">${esc((c.name || c.username).charAt(0).toUpperCase())}</span>
            <div class="item-txt"><b>${esc(c.name)}${soyYo ? ' <small>(vos)</small>' : ''}</b><small>${esc(c.username)}</small>
              <div class="item-meta"><span class="etq ${c.role === 'superadmin' ? 'oro' : 'gris'}">${ROLES[c.role]}</span><span class="etq ${c.active ? 'ok' : 'mal'}">${c.active ? 'Activa' : 'Desactivada'}</span>${c.pin ? '<span class="etq gris">Con clave de 4 dígitos</span>' : ''}</div></div>
            <div class="item-acc">
              <button class="btn btn-suave" type="button" data-edit>${icon('edit')} Editar</button>
              ${soyYo ? `<a class="btn btn-suave" href="#/ajustes/cuenta">${icon('key')} Contraseña</a>` : `<button class="btn btn-suave" type="button" data-pass>${icon('key')} Contraseña</button><button class="btn btn-suave" type="button" data-act>${c.active ? 'Desactivar' : 'Activar'}</button>`}
            </div></div>`;
        }).join('')}</div>
      </section>
      <p class="ayuda" style="margin-top:12px">Los cambios se guardan al instante. Una cuenta desactivada no puede iniciar sesión hasta que la actives de nuevo.</p>`;

    const bs = $('#btnSuspender'), br = $('#btnReactivar');
    if (bs) bs.onclick = () => A.cambiarNegocio(false);
    if (br) br.onclick = () => A.cambiarNegocio(true);
    $$('.lista .item').forEach((it) => {
      const c = d.accounts.find((x) => x.id === it.dataset.id);
      $('[data-edit]', it).onclick = () => editar(c);
      const pass = $('[data-pass]', it);
      if (pass) pass.onclick = () => cambiarPass(c);
      const act = $('[data-act]', it);
      if (act) act.onclick = async () => {
        if (c.active && !(await A.confirmar({ titulo: 'Desactivar cuenta', texto: `${esc(c.name)} no va a poder ingresar al panel hasta que la actives de nuevo.`, ok: 'Desactivar' }))) return;
        c.active = !c.active;
        await A.guardar(); A.toast(c.active ? 'Cuenta activada' : 'Cuenta desactivada'); A.rutear();
      };
    });
  };

  function editar(c) {
    const dlg = A.dialogo({
      titulo: 'Editar cuenta',
      cuerpo: `<label class="campo"><span>Nombre</span><input id="cNombre" value="${esc(c.name)}" maxlength="50"></label>
        <div class="campo"><span>Correo</span><p class="codigo" style="padding:10px 12px">${esc(c.username)}</p><small>Con el que ingresa al panel. Si alguna vez hay que cambiarlo, se hace desde Supabase.</small></div>
        <p class="error-campo" id="cErr" role="alert"></p>`,
      pie: '<button class="btn btn-suave" type="button" data-cerrar>Cancelar</button><button class="btn" type="button" id="cOk">Guardar</button>',
    });
    $('#cOk', dlg).onclick = async () => {
      const nombre = $('#cNombre', dlg).value.trim();
      if (!nombre) { $('#cErr', dlg).textContent = 'Escribí el nombre.'; return; }
      c.name = nombre;
      if (c.id === A.yo.id) A.yo = c;
      await A.guardar();
      dlg.close();
      A.toast('Cuenta actualizada');
      A.rutear();
    };
  }

  /* Contraseña de la otra cuenta (la propia se cambia en Ajustes, con la contraseña actual) */
  function cambiarPass(c) {
    const dlg = A.dialogo({
      titulo: 'Cambiar contraseña',
      cuerpo: `<p>Nueva contraseña para <b>${esc(c.name)}</b> (${esc(c.username)}).</p>
        <label class="campo"><span>Contraseña</span><div class="pass-campo"><input id="pp" value="${esc(A.generarPass())}" autocomplete="off"><button class="btn btn-suave" type="button" id="ppGen">Generar</button></div><small>Podés escribir la que quieras, también la misma de antes. Al menos 10 caracteres.</small></label>
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
      try {
        await GS.db.cambiarContrasenaCuenta(c.id, v);
      } catch (e) {
        $('#ppOk', dlg).disabled = false;
        $('#ppErr', dlg).textContent = e.message;
        return;
      }
      dlg.close();
      A.toast(`Contraseña de ${c.name} actualizada`);
    };
  }
})();
