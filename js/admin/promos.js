/* Ganga Store — promociones y producto del mes */
(function () {
  'use strict';
  const GS = window.GS, A = GS.A;
  const { esc, $, $$, icon } = GS;

  const ESTADOS = { activa: ['Activa', 'ok'], programada: ['Programada', 'warn'], finalizada: ['Finalizada', 'gris'], pausada: ['Pausada', 'gris'] };
  const rango = (p) => {
    const f = (k) => GS.fechaLarga(k, { weekday: undefined, month: 'short' }).replace('.', '');
    return `${f(p.start)} al ${f(p.end)}${p.end.slice(0, 4) !== GS.hoyKey().slice(0, 4) ? ' de ' + p.end.slice(0, 4) : ''}`;
  };

  A.vistas.promociones = (args) => {
    if (args[0]) return editor(args[0]);
    A.titulo('Promociones');
    const d = A.data;
    const orden = { activa: 0, programada: 1, pausada: 2, finalizada: 3 };
    const promos = [...d.promotions].sort((a, b) => (orden[GS.promoEstado(a)] - orden[GS.promoEstado(b)]) || a.start.localeCompare(b.start));
    const visibles = d.products.filter((p) => p.visible !== false);
    const pdm = d.products.find((p) => p.id === d.settings.featuredProductId);
    A.vista().innerHTML = `
      <section class="bloque"><div class="bloque-cab"><h2>Promociones</h2><a class="btn" href="#/promociones/nueva">${icon('plus')} Crear promoción</a>
        <p>La promo activa aparece grande al entrar a la tienda, con cuenta regresiva. Si hay varias, se muestran en un carrusel.</p></div>
        <div class="lista" id="promos">${promos.length ? promos.map((p) => {
          const est = GS.promoEstado(p);
          const [et, cl] = ESTADOS[est];
          const n = (p.productIds || []).length;
          return `<div class="item" data-id="${esc(p.id)}" style="--th:72px">
            <div class="item-foto" style="width:72px;aspect-ratio:1;display:grid;place-items:center;background:${p.style === 'claro' ? 'var(--paper)' : '#000'};outline:1px solid var(--gold);outline-offset:-4px;color:var(--gold);font-family:var(--serif);font-size:26px">${esc(p.discount)}%</div>
            <div class="item-txt"><b>${esc(p.title)}</b><small>${rango(p)}, ${n} ${n === 1 ? 'producto' : 'productos'}</small>
              <div class="item-meta"><span class="etq ${cl}">${et}</span>${est === 'activa' ? `<span class="etq gris">termina en ${GS.restante(GS.finDia(p.end)).d} días</span>` : ''}</div></div>
            <div class="item-acc">
              <a class="btn btn-suave" href="#/promociones/${encodeURIComponent(p.id)}">${icon('edit')} Editar</a>
              <button class="btn btn-suave" type="button" data-pausa>${p.active ? 'Pausar' : 'Reactivar'}</button>
              <button class="btn btn-suave" type="button" data-del aria-label="Eliminar ${esc(p.title)}">${icon('trash')}</button>
            </div></div>`;
        }).join('') : `<div class="lista-vacia"><h3>No hay promociones</h3><p>Creá la promo del mes: elegí productos, el descuento y hasta cuándo dura.</p><a class="btn" href="#/promociones/nueva">${icon('plus')} Crear promoción</a></div>`}</div>
      </section>

      <section class="bloque"><div class="bloque-cab"><h2>Producto del mes</h2><p>Se destaca en el inicio de la tienda. Si no hay ninguna promo activa, ocupa el lugar principal.</p></div>
        <div class="form">
          <label class="campo"><span>Producto</span><select id="pdmSel"><option value="">Ninguno</option>${visibles.map((p) => `<option value="${esc(p.id)}" ${pdm && pdm.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <label class="campo"><span>Texto destacado</span><textarea id="pdmNota" maxlength="220" style="min-height:80px" placeholder="Por qué lo recomendás este mes">${esc(d.settings.featuredNote || '')}</textarea></label>
          <div><button class="btn" type="button" id="pdmOk">${icon('check')} Guardar producto del mes</button></div>
        </div>
      </section>`;
    $$('#promos .item').forEach((it) => {
      const p = d.promotions.find((x) => x.id === it.dataset.id);
      $('[data-pausa]', it).onclick = async () => { p.active = !p.active; await A.guardar(); A.toast(p.active ? 'Promo reactivada' : 'Promo pausada: no se muestra en la tienda'); A.rutear(); };
      $('[data-del]', it).onclick = async () => {
        if (!(await A.confirmar({ titulo: 'Eliminar promoción', texto: `Vas a eliminar "${esc(p.title)}". Los productos vuelven a su precio normal.`, ok: 'Eliminar', peligro: true }))) return;
        d.promotions = d.promotions.filter((x) => x.id !== p.id);
        await A.guardar(); A.toast('Promoción eliminada'); A.rutear();
      };
    });
    $('#pdmOk').onclick = async () => {
      d.settings.featuredProductId = $('#pdmSel').value;
      d.settings.featuredNote = $('#pdmNota').value.trim();
      await A.guardar();
      A.toast('Producto del mes guardado');
    };
  };

  function previaHTML(p, d) {
    const prods = (p.productIds || []).map((id) => d.products.find((x) => x.id === id)).filter(Boolean);
    const estilo = p.style === 'imagen' && p.image ? 'imagen' : p.style === 'claro' ? 'claro' : 'negro';
    const fin = p.end ? GS.finDia(p.end) : null;
    const r = fin ? GS.restante(fin) : { d: 0, h: 0, m: 0, s: 0 };
    return `<section class="hero hero--${estilo}" ${estilo === 'imagen' ? `style="--hero-img:url('${esc(GS.img(p.image))}')"` : ''}>
      <div class="hero-in"><div class="hero-txt">
        <p class="hero-etiqueta">Promo del mes</p>
        <p class="hero-num"><span>${esc(p.discount || 0)}</span><span class="pc">%</span><span class="off">off</span></p>
        <p class="hero-tit">${esc(p.title || 'Título de la promo')}</p>
        ${p.subtitle ? `<p class="hero-desc">${esc(p.subtitle)}</p>` : ''}
        ${fin ? `<p class="cuenta-titulo">Termina el ${esc(GS.fechaLarga(p.end))}</p><div class="cuenta">${[[r.d, 'días'], [GS.pad(r.h), 'horas'], [GS.pad(r.m), 'min'], [GS.pad(r.s), 'seg']].map(([v, t]) => `<div class="cuenta-u"><b>${v}</b><small>${t}</small></div>`).join('')}</div>` : ''}
        <span class="btn btn-oro">Ver ${prods.length === 1 ? 'el producto' : `los ${prods.length} productos`}</span>
      </div>
      ${estilo !== 'imagen' && prods.length ? `<div class="hero-fotos">${prods.slice(0, 3).map((x) => `<a>${A.img(GS.primeraImagen(x), '')}</a>`).join('')}</div>` : ''}
      </div></section>`;
  }

  function editor(id) {
    const d = A.data;
    const nueva = id === 'nueva';
    const orig = nueva ? null : d.promotions.find((p) => p.id === id);
    if (!nueva && !orig) { A.vista().innerHTML = '<div class="lista-vacia"><h3>Esa promoción ya no existe</h3><a class="btn" href="#/promociones">Volver</a></div>'; return; }
    const hoy = GS.hoyKey();
    const [y, m] = hoy.split('-').map(Number);
    const finMes = GS.sumarDias(GS.key(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1), -1);
    const p = orig ? GS.clone(orig) : { id: GS.uid('promo'), title: `Promo de ${GS.mesLargo(m)}`, subtitle: '', discount: 20, start: hoy, end: finMes, style: 'negro', productIds: [], image: '', active: true };
    const inicial = JSON.stringify(p);
    A.guardia = () => JSON.stringify(p) !== inicial;
    A.titulo(nueva ? 'Crear promoción' : 'Editar promoción');
    const cats = GS.categoriasOrdenadas(d);
    const sinCat = d.products.filter((x) => !GS.categoria(d, x.categoryId));
    const grupos = cats.map((c) => ({ c, ps: d.products.filter((x) => x.categoryId === c.id) })).filter((g) => g.ps.length);
    if (sinCat.length) grupos.push({ c: { id: '', name: 'Sin categoría' }, ps: sinCat });

    A.vista().innerHTML = `<form class="form" id="fpr" novalidate>
      <div class="form-grid" style="align-items:start">
      <section class="bloque"><div class="bloque-cab"><h2>La promo</h2></div>
        <div class="form">
          <label class="campo"><span>Título</span><input name="title" value="${esc(p.title)}" maxlength="60" required></label>
          <label class="campo"><span>Descripción corta</span><input name="subtitle" value="${esc(p.subtitle)}" maxlength="140" placeholder="Ej: Remeras y buzos seleccionados hasta fin de mes"></label>
          <div class="form-grid tres">
            <label class="campo"><span>Descuento</span><div class="prefijo"><input name="discount" type="number" min="1" max="90" step="1" inputmode="numeric" value="${esc(p.discount)}" required style="border-right:0"><span style="border-left:0;border-right:1px solid var(--line-2)">%</span></div></label>
            <label class="campo"><span>Empieza</span><input name="start" type="date" value="${esc(p.start)}" required></label>
            <label class="campo"><span>Termina</span><input name="end" type="date" value="${esc(p.end)}" required><small>Hasta las 23:59 de ese día, hora argentina.</small></label>
          </div>
          <fieldset class="campo"><legend class="etiqueta" style="margin-bottom:8px">Estilo del cartel</legend>
            <div class="opciones-estilo">
              ${[['negro', 'Negro y dorado'], ['claro', 'Blanco con marco'], ['imagen', 'Con foto de fondo']].map(([k, t]) => `<label class="opcion"><input type="radio" name="style" value="${k}" ${p.style === k ? 'checked' : ''}><span class="muestra ${k}">${esc(p.discount)}%</span>${t}</label>`).join('')}
            </div></fieldset>
          <div class="campo" id="zonaImagen" ${p.style === 'imagen' ? '' : 'hidden'}><span>Foto de fondo</span><small>Horizontal, idealmente de 1600 × 900 px o más.</small><div class="fotos-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))" id="promoImg"></div></div>
          <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><span>Promo habilitada<small>Si la destildás queda pausada y no se muestra, aunque esté dentro de las fechas.</small></span></label>
          <p class="error-campo" id="errPromo" role="alert"></p>
        </div>
      </section>

      <section class="bloque"><div class="bloque-cab"><h2>Productos incluidos</h2><p id="selCuenta"></p></div>
        <label class="buscar campo" style="position:relative;margin-bottom:10px"><span class="sr">Buscar producto</span><input type="search" id="selQ" placeholder="Buscar producto"></label>
        <div class="selector" id="selector">${grupos.map((g) => `<div class="selector-grupo" data-cat="${esc(g.c.id)}">
          <label class="check"><input type="checkbox" data-todos> <span>${esc(g.c.name)} <small style="font-weight:400;color:var(--ink-3)">toda la categoría</small></span></label>
          ${g.ps.map((x) => `<label class="check prod" data-n="${esc(GS.slugify(x.name))}"><input type="checkbox" value="${esc(x.id)}" ${p.productIds.includes(x.id) ? 'checked' : ''}>${A.img(GS.primeraImagen(x), '')}<span>${esc(x.name)} <small>${GS.precio(x.price)}${p.discount ? ' → ' + GS.precio(Math.round(x.price * (1 - p.discount / 100))) : ''}</small></span></label>`).join('')}
        </div>`).join('') || '<div class="lista-vacia"><p>Primero cargá productos.</p></div>'}</div>
      </section>

      <section class="bloque"><div class="bloque-cab"><h2>Así se ve en la tienda</h2></div><div class="previa-hero" id="previa"></div></section>
      </div>
      <div class="form-pie">
        <a class="btn btn-suave" href="#/promociones">Cancelar</a>
        <button class="btn" type="submit">${icon('check')} ${nueva ? 'Crear promoción' : 'Guardar cambios'}</button>
      </div>
    </form>`;

    const form = $('#fpr');
    const previa = () => {
      $('#previa').innerHTML = previaHTML(p, d);
      const n = p.productIds.length;
      $('#selCuenta').textContent = n ? `${n} ${n === 1 ? 'producto elegido' : 'productos elegidos'}` : 'Elegí al menos un producto.';
      $$('.opcion .muestra', form).forEach((el) => { el.textContent = `${p.discount || 0}%`; });
      $$('.selector-grupo', form).forEach((g) => {
        const cajas = $$('.prod input', g);
        const todos = $('[data-todos]', g);
        const marcadas = cajas.filter((c) => c.checked).length;
        todos.checked = marcadas === cajas.length && cajas.length > 0;
        todos.indeterminate = marcadas > 0 && marcadas < cajas.length;
      });
    };
    const pintarImg = () => {
      $('#promoImg').innerHTML = (p.image ? `<div class="foto-mini" style="aspect-ratio:16/9">${A.img(p.image, '')}<div class="acc"><button type="button" id="piQuitar" aria-label="Quitar foto">${icon('trash')}</button></div></div>` : '')
        + `<label class="foto-subir" style="aspect-ratio:16/9">${icon('upload')}<span>${p.image ? 'Cambiar foto' : 'Subir foto'}</span><input type="file" accept="image/*" id="piFile"></label>`;
      const q = $('#piQuitar'); if (q) q.onclick = () => { p.image = ''; pintarImg(); previa(); };
      $('#piFile').onchange = async (e) => { try { p.image = await A.comprimir(e.target.files[0], 1800, 0.82); pintarImg(); previa(); } catch (err) { A.toast(err.message, true); } };
    };
    pintarImg();
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (['title', 'subtitle', 'start', 'end'].includes(t.name)) p[t.name] = t.value;
      if (t.name === 'discount') p.discount = t.value === '' ? '' : Math.round(Number(t.value));
      if (t.name === 'style') { p.style = t.value; $('#zonaImagen').hidden = p.style !== 'imagen'; }
      if (t.name === 'active') p.active = t.checked;
      if (t.matches('.prod input')) {
        if (t.checked && !p.productIds.includes(t.value)) p.productIds.push(t.value);
        if (!t.checked) p.productIds = p.productIds.filter((x) => x !== t.value);
      }
      if (t.matches('[data-todos]')) {
        $$('.prod input', t.closest('.selector-grupo')).forEach((c) => {
          c.checked = t.checked;
          if (t.checked && !p.productIds.includes(c.value)) p.productIds.push(c.value);
          if (!t.checked) p.productIds = p.productIds.filter((x) => x !== c.value);
        });
      }
      if (t.id === 'selQ') {
        const q = GS.slugify(t.value);
        $$('.prod', form).forEach((l) => { l.hidden = q && !l.dataset.n.includes(q); });
        return;
      }
      previa();
    });
    form.addEventListener('change', (e) => {
      if (e.target.type === 'date') { p[e.target.name] = e.target.value; previa(); }
    });
    previa();

    form.onsubmit = async (e) => {
      e.preventDefault();
      p.start = form.elements.namedItem('start').value; p.end = form.elements.namedItem('end').value;
      let err = '';
      if (!String(p.title).trim()) err = 'Escribí un título.';
      else if (!(p.discount >= 1 && p.discount <= 90)) err = 'El descuento tiene que estar entre 1 % y 90 %.';
      else if (!p.start || !p.end) err = 'Completá las fechas de inicio y fin.';
      else if (p.end < p.start) err = 'La fecha de fin tiene que ser igual o posterior a la de inicio.';
      else if (!p.productIds.length) err = 'Elegí al menos un producto para la promo.';
      else if (p.style === 'imagen' && !p.image) err = 'Subí la foto de fondo o elegí otro estilo.';
      $('#errPromo').textContent = err;
      if (err) { $('#errPromo').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      p.title = p.title.trim(); p.subtitle = String(p.subtitle || '').trim();
      if (p.style !== 'imagen') p.image = '';
      if (nueva) d.promotions.push(p); else Object.assign(orig, p);
      await A.guardar();
      A.guardia = null;
      const est = GS.promoEstado(p);
      A.toast(est === 'activa' ? 'Promoción guardada. Publicá para que se vea en la tienda.' : est === 'programada' ? `Promoción programada: empieza el ${GS.fechaCorta(p.start)}.` : 'Promoción guardada.');
      A.ir('#/promociones');
    };
  }
})();
