/* Ganga Store — ajustes: tienda, horarios, diseño, publicación, copia de seguridad y cuenta */
(function () {
  'use strict';
  const GS = window.GS, A = GS.A;
  const { esc, $, $$, icon } = GS;
  const COLOR_TEMA = { minimal: '#a8843a', navidad: '#9e1b22', anonuevo: '#e6c56f', sanvalentin: '#96202f', carnaval: '#b32a5d', pascuas: '#7a5c9e', patrio: '#75aadb', padre: '#1f3354', amigo: '#1f6c65', ninez: '#ffd166', primavera: '#5c8a3a', madre: '#e7a3ad', halloween: '#e8761b' };
  const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

  A.vistas.ajustes = (args) => {
    A.titulo('Ajustes');
    const d = A.data, s = d.settings;
    const gh = GS.github.config();
    const hoy = GS.hoyKey();
    const anio = +hoy.slice(0, 4);
    const temaHoy = GS.temaEnFecha(hoy);
    const cal = GS.calendarioTemas(anio);
    const modo = s.themeMode || 'auto';
    const yo = A.cuenta(A.yo.id) || A.yo;

    A.vista().innerHTML = `
      <section class="bloque" id="tienda"><div class="bloque-cab"><h2>Datos de la tienda y redes</h2><p>Lo que completes acá aparece en la sección Contactanos. Lo que dejes vacío no se muestra.</p></div>
        <form class="form" id="fTienda" novalidate>
          <div class="form-grid dos">
            <label class="campo"><span>Nombre de la tienda</span><input name="storeName" value="${esc(s.storeName)}" maxlength="40"></label>
            <label class="campo"><span>Frase de la marca</span><input name="tagline" value="${esc(s.tagline)}" maxlength="40"></label>
            <label class="campo"><span>WhatsApp</span><input name="whatsapp" value="${esc(s.whatsapp)}" inputmode="tel" placeholder="5491130866677"><small>Con código de país y el 9: 54 9 11 3086 6677 se escribe 5491130866677.</small></label>
            <label class="campo"><span>Teléfono visible</span><input name="phone" value="${esc(s.phone)}" inputmode="tel" placeholder="11 3086 6677"><small>Como querés que se lea en la tienda.</small></label>
            <label class="campo"><span>Instagram</span><input name="instagram" value="${esc(s.instagram)}" autocapitalize="none" placeholder="@gangastore o el enlace"></label>
            <label class="campo"><span>Facebook</span><input name="facebook" value="${esc(s.facebook)}" autocapitalize="none" placeholder="Nombre de la página o enlace"></label>
            <label class="campo"><span>TikTok</span><input name="tiktok" value="${esc(s.tiktok)}" autocapitalize="none" placeholder="@usuario o enlace"></label>
            <label class="campo"><span>Email</span><input name="email" type="email" value="${esc(s.email)}" autocapitalize="none" placeholder="hola@tutienda.com"></label>
            <label class="campo"><span>Dirección del local</span><input name="address" value="${esc(s.address)}" placeholder="Calle 123, CABA"></label>
            <label class="campo"><span>Dominio propio</span><input name="domain" value="${esc(s.domain || '')}" autocapitalize="none" spellcheck="false" placeholder="www.gangastore.com"><small>Cuando lo tengas andando, quien entre por la dirección técnica del hosting pasa a este dominio.</small></label>
            <label class="campo"><span>Enlace de Google Maps</span><input name="mapsUrl" value="${esc(s.mapsUrl)}" type="url" placeholder="https://maps.app.goo.gl/…"><small>Opcional. Si lo dejás vacío, se busca la dirección.</small></label>
          </div>
          <div><button class="btn" type="submit">${icon('check')} Guardar datos</button></div>
        </form>
      </section>

      <section class="bloque" id="horarios"><div class="bloque-cab"><h2>Horario de atención</h2><p>En hora de Buenos Aires. La tienda muestra si estás abierto o cerrado en este momento.</p></div>
        <div id="filasHorario"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-suave" type="button" id="hAgregar">${icon('plus')} Agregar franja</button><button class="btn" type="button" id="hGuardar">${icon('check')} Guardar horario</button></div>
      </section>

      <section class="bloque" id="diseno"><div class="bloque-cab"><h2>Diseño de temporada</h2><p>La tienda cambia sola de diseño en las fechas especiales de Argentina. El panel siempre se ve igual.</p></div>
        <div class="form">
          <label class="check"><input type="radio" name="modoTema" value="auto" ${modo === 'auto' ? 'checked' : ''}><span>Automático según el calendario<small>Hoy corresponde: ${esc(GS.TEMAS[temaHoy.id].nombre)}${temaHoy.hasta ? ', hasta el ' + GS.fechaCorta(temaHoy.hasta) : ''}.</small></span></label>
          <label class="check"><input type="radio" name="modoTema" value="minimal" ${modo === 'minimal' ? 'checked' : ''}><span>Siempre minimalista<small>Blanco, negro y dorado todo el año.</small></span></label>
          <label class="check"><input type="radio" name="modoTema" value="forzar" ${modo !== 'auto' && modo !== 'minimal' ? 'checked' : ''}><span>Usar un diseño fijo<small>Útil para una campaña puntual, como Hot Sale o Black Friday.</small></span></label>
          <label class="campo" style="max-width:320px;margin-left:30px"><span class="sr">Diseño fijo</span><select id="temaFijo">${Object.entries(GS.TEMAS).filter(([k]) => k !== 'minimal').map(([k, t]) => `<option value="${k}" ${modo === k ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select></label>
          <div><button class="btn" type="button" id="temaGuardar">${icon('check')} Guardar diseño</button></div>
          <h3 style="margin-top:8px">Calendario ${anio}</h3>
          <ul class="temas-lista">${cal.map((e) => {
            const esHoy = hoy >= e.desde && hoy <= e.hasta;
            return `<li class="${esHoy ? 'hoy' : ''}"><span class="muestra-tema" style="--c:${COLOR_TEMA[e.id]}"></span><span>${esc(GS.TEMAS[e.id].nombre)}${esHoy ? ' (hoy)' : ''}<small>${GS.fechaCorta(e.desde)} al ${GS.fechaCorta(e.hasta)}${e.id === 'patrio' ? ', ' + esc(e.msg.split('.')[0]) : ''}</small></span><a href="./?preview=1&tema=${e.id}" target="_blank" rel="noopener">Ver</a></li>`;
          }).join('')}</ul>
        </div>
      </section>

      <section class="bloque" id="publicacion"><div class="bloque-cab"><h2>Guardado automático</h2><p>Productos, fotos, cuentas y ajustes se guardan solos en tu repositorio de GitHub cada vez que hacés un cambio, y la tienda se actualiza en uno o dos minutos.</p></div>
        ${GS.github.configurado()
          ? `<div class="aviso" style="background:#eef6f0;border-color:#b9d3c1">${icon('check')}<div><b>Activo en este dispositivo.</b><span>Se guarda en <span class="codigo">${esc(gh.owner)}/${esc(gh.repo)}</span>.${A.ultimoGuardado ? ' Último guardado: ' + esc(GS.fechaHora(new Date(A.ultimoGuardado).toISOString())) + '.' : ''}</span></div></div>`
          : A.vistas.avisoGuardado()}
        ${A.esSuper() ? `<div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn ${GS.github.configurado() ? 'btn-suave' : ''}" type="button" data-conectar>${icon('key')} ${GS.github.configurado() ? 'Cambiar el token' : 'Activar el guardado'}</button>
          </div>
          <details style="margin-top:14px"><summary style="cursor:pointer;font-size:15px">Opciones avanzadas</summary>
            <form class="form" id="fGh" novalidate autocomplete="off" style="margin-top:12px">
              <div class="form-grid tres">
                <label class="campo"><span>Usuario de GitHub</span><input name="owner" value="${esc(gh.owner)}" autocapitalize="none" spellcheck="false"></label>
                <label class="campo"><span>Repositorio</span><input name="repo" value="${esc(gh.repo)}" autocapitalize="none" spellcheck="false"></label>
                <label class="campo"><span>Rama</span><input name="branch" value="${esc(gh.branch)}" autocapitalize="none" spellcheck="false"></label>
              </div>
              <div><button class="btn btn-suave" type="submit">Guardar opciones</button></div>
            </form></details>` : ''}
        ${GS.github.urlTienda(s) ? `<p class="ayuda" style="margin-top:12px">Dirección pública de la tienda: <a href="${esc(GS.github.urlTienda(s))}" target="_blank" rel="noopener">${esc(GS.github.urlTienda(s))}</a></p>` : ''}
      </section>

      <section class="bloque" id="visitas"><div class="bloque-cab"><h2>Contador de visitas</h2></div>
        <div class="form">
          <label class="check"><input type="checkbox" id="noContar" ${GS.visitas.dispositivoExcluido() ? 'checked' : ''}><span>No contar mis visitas desde este dispositivo<small>Así tus propias entradas a la tienda no inflan los números.</small></span></label>
          ${A.esSuper() ? `<p class="ayuda">Las visitas se cuentan con el servicio gratuito Abacus, con el identificador <span class="codigo">${esc(s.counterNamespace)}</span>. Si lo cambiás, el contador vuelve a cero.</p>` : ''}
        </div>
      </section>

      <section class="bloque" id="copia"><div class="bloque-cab"><h2>Copia de seguridad</h2><p>Descargá todos los productos, categorías, promos y ajustes en un archivo. Sirve para guardar una copia o pasar los datos a otro dispositivo.</p></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-suave" type="button" id="exportar">${icon('download')} Descargar copia</button>
          <label class="btn btn-suave" style="cursor:pointer">${icon('upload')} Cargar copia<input type="file" accept="application/json,.json" id="importar" hidden></label>
        </div>
        <p class="ayuda" style="margin-top:10px">Al cargar una copia se reemplazan productos, categorías, promos y ajustes. Las cuentas no se tocan.</p>
      </section>

      <section class="bloque" id="cuenta"><div class="bloque-cab"><h2>Mi cuenta</h2><p>${esc(yo.name)}, usuario ${esc(yo.username)}.</p></div>
        <form class="form" id="fPass" novalidate style="max-width:420px">
          <label class="campo"><span>Contraseña actual</span><input type="password" name="a" autocomplete="current-password"></label>
          <label class="campo"><span>Contraseña nueva</span><input type="password" name="n" autocomplete="new-password"><small>Al menos 10 caracteres.</small></label>
          <label class="campo"><span>Repetí la nueva</span><input type="password" name="r" autocomplete="new-password"></label>
          <p class="error-campo" id="passErr" role="alert"></p>
          <div><button class="btn" type="submit">Cambiar contraseña</button></div>
        </form>
      </section>

      ${A.sucio && !GS.github.configurado() ? `<section class="bloque" id="borrador"><div class="bloque-cab"><h2>Cambios que no llegaron a la tienda</h2><p>Si te equivocaste, podés borrarlos de este dispositivo y volver a lo que está guardado en la tienda.</p></div>
        <button class="btn btn-peligro" type="button" id="descartar">Borrar los cambios de este dispositivo</button></section>` : ''}`;

    if (args[0]) { const sec = document.getElementById(args[0]); if (sec) setTimeout(() => sec.scrollIntoView({ block: 'start' }), 30); }

    // tienda
    $('#fTienda').onsubmit = async (e) => {
      e.preventDefault();
      const f = A.leerForm(e.target);
      Object.keys(f).forEach((k) => { s[k] = String(f[k]).trim(); });
      s.whatsapp = GS.limpiarNumero(s.whatsapp);
      if (s.whatsapp && s.whatsapp.length < 10) { A.toast('El número de WhatsApp parece incompleto. Incluí el 54 y el 9.', true); return; }
      e.target.whatsapp.value = s.whatsapp;
      await A.guardar();
      A.toast('Datos guardados');
    };

    // horarios
    let filas = GS.clone(s.hours || []);
    const pintarHorario = () => {
      $('#filasHorario').innerHTML = filas.length ? filas.map((h, i) => `<div class="horario-fila" data-i="${i}">
        <div class="dias" role="group" aria-label="Días">${ORDEN_DIAS.map((dd) => `<button type="button" class="chip" aria-pressed="${h.days.includes(dd)}" data-d="${dd}" title="${GS.DIAS[dd]}" aria-label="${GS.DIAS[dd]}">${DIAS_CORTOS[dd]}</button>`).join('')}</div>
        <div class="horas"><label>De <input type="time" value="${esc(h.open)}" data-k="open"></label><label>a <input type="time" value="${esc(h.close)}" data-k="close"></label><button class="btn btn-icono" type="button" data-q aria-label="Quitar franja">${icon('trash')}</button></div>
      </div>`).join('') : '<p class="ayuda">Sin horario cargado. La tienda no muestra si estás abierto.</p>';
      $$('#filasHorario .horario-fila').forEach((el) => {
        const h = filas[+el.dataset.i];
        $$('[data-d]', el).forEach((b) => (b.onclick = () => {
          const dd = +b.dataset.d;
          h.days = h.days.includes(dd) ? h.days.filter((x) => x !== dd) : [...h.days, dd].sort();
          b.setAttribute('aria-pressed', String(h.days.includes(dd)));
        }));
        $$('[data-k]', el).forEach((inp) => (inp.onchange = () => { h[inp.dataset.k] = inp.value; }));
        $('[data-q]', el).onclick = () => { filas.splice(+el.dataset.i, 1); pintarHorario(); };
      });
    };
    pintarHorario();
    $('#hAgregar').onclick = () => { filas.push({ days: [6], open: '10:00', close: '14:00' }); pintarHorario(); };
    $('#hGuardar').onclick = async () => {
      const malas = filas.filter((h) => !h.days.length || !h.open || !h.close || h.close <= h.open);
      if (malas.length) { A.toast('Revisá el horario: cada franja necesita al menos un día y la hora de cierre después de la de apertura.', true); return; }
      s.hours = filas;
      await A.guardar();
      A.toast('Horario guardado');
    };

    // diseño
    $('#temaFijo').onchange = () => { $('input[name=modoTema][value=forzar]').checked = true; };
    $('#temaGuardar').onclick = async () => {
      const m = $('input[name=modoTema]:checked').value;
      s.themeMode = m === 'forzar' ? $('#temaFijo').value : m;
      await A.guardar();
      A.toast(m === 'auto' ? 'La tienda va a cambiar de diseño sola en cada fecha especial' : m === 'minimal' ? 'La tienda queda siempre minimalista' : `Diseño fijo: ${GS.TEMAS[s.themeMode].nombre}`);
    };

    // guardado (opciones avanzadas)
    const fgh = $('#fGh');
    if (fgh) fgh.onsubmit = (e) => {
      e.preventDefault();
      const f = A.leerForm(e.target);
      GS.github.guardarConfig({ owner: f.owner, repo: f.repo, branch: f.branch });
      A.toast('Opciones guardadas');
    };

    // visitas
    $('#noContar').onchange = (e) => { GS.visitas.excluirDispositivo(e.target.checked); A.toast(e.target.checked ? 'Tus visitas desde este dispositivo no se cuentan' : 'Tus visitas se cuentan como las de cualquier cliente'); };

    // copia
    $('#exportar').onclick = () => {
      const copia = GS.clone(A.data);
      delete copia.accounts;
      A.descargar(`ganga-store-copia-${GS.hoyKey()}.json`, JSON.stringify({ tipo: 'ganga-store-copia', creada: new Date().toISOString(), datos: copia }, null, 1));
    };
    $('#importar').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        const datos = j.datos || j;
        if (!Array.isArray(datos.products) || !Array.isArray(datos.categories)) throw new Error('El archivo no es una copia de Ganga Store.');
        if (!(await A.confirmar({ titulo: 'Cargar copia', texto: `Se reemplazan los productos (${datos.products.length}), categorías (${datos.categories.length}), promos y ajustes de la tienda.`, ok: 'Cargar copia', peligro: true }))) return;
        const cuentas = A.data.accounts;
        A.data = GS.normalizar(Object.assign({}, A.pub, datos, { accounts: cuentas, rev: A.pub.rev }));
        await A.guardar();
        A.toast('Copia cargada');
        A.rutear();
      } catch (err) { A.toast(err.message.startsWith('El archivo') ? err.message : 'No se pudo leer el archivo. Elegí una copia descargada desde este panel.', true); }
      e.target.value = '';
    };

    // contraseña
    $('#fPass').onsubmit = async (e) => {
      e.preventDefault();
      const f = A.leerForm(e.target);
      const cta = A.cuenta(A.yo.id);
      let err = '';
      if ((await A.hashPass(f.a || '', cta.salt, cta.iter)) !== cta.hash) err = 'La contraseña actual no es correcta.';
      else err = A.validarPass(f.n || '') || (f.n !== f.r ? 'Las contraseñas nuevas no coinciden.' : '');
      $('#passErr').textContent = err;
      if (err) return;
      Object.assign(cta, await A.nuevaPass(f.n), { mustChange: false });
      await A.darAcceso(cta, f.n);
      A.pass = f.n;
      A.yo = cta;
      await A.guardar();
      e.target.reset();
      A.toast('Contraseña cambiada');
    };

    const desc = $('#descartar');
    if (desc) desc.onclick = async () => {
      if (!(await A.confirmar({ titulo: 'Descartar cambios', texto: 'Se borran de este dispositivo los cambios que no llegaron a la tienda, incluidas las fotos nuevas. No se puede deshacer.', ok: 'Descartar', peligro: true }))) return;
      await A.descartarBorrador();
      A.yo = A.cuenta(A.yo.id) || A.yo;
      A.toast('Listo: ves lo mismo que está guardado en la tienda');
      A.rutear();
    };
  };
})();
