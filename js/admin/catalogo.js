/* Ganga Store — productos y categorías */
(function () {
  'use strict';
  const GS = window.GS, A = GS.A;
  const { esc, $, $$, icon } = GS;

  const LETRAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const NUMEROS = ['36', '38', '40', '42', '44', '46', '48', '50'];
  const COLORES = [['Negro', '#151515'], ['Blanco', '#f4f3ef'], ['Gris', '#a9a9a6'], ['Azul marino', '#1f2a44'], ['Celeste', '#8fb3d9'], ['Beige', '#d8c7a6'], ['Camel', '#b08654'], ['Marrón', '#5c3d2e'], ['Verde', '#1e4d3a'], ['Oliva', '#6b6b3a'], ['Bordó', '#6d1f2a'], ['Rojo', '#b3202a'], ['Rosa', '#e7a3ad'], ['Amarillo', '#e9c46a']];

  /* ================= PRODUCTOS ================= */
  let filtro = { q: '', cat: '' };
  A.vistas.productos = (args) => {
    if (args[0]) return editor(args[0]);
    A.titulo('Productos');
    const d = A.data;
    const cats = GS.categoriasOrdenadas(d);
    A.vista().innerHTML = `
      <div class="barra-herr">
        <label class="buscar campo"><span class="sr">Buscar</span>${icon('search')}<input type="search" id="fq" placeholder="Buscar por nombre" value="${esc(filtro.q)}"></label>
        <label class="campo"><span class="sr">Categoría</span><select id="fc"><option value="">Todas las categorías</option>${cats.map((c) => `<option value="${esc(c.id)}" ${filtro.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <a class="btn" href="#/productos/nuevo">${icon('plus')} Agregar producto</a>
      </div>
      <div class="lista" id="lista"></div>`;
    const pintar = () => {
      const q = GS.slugify(filtro.q);
      const lista = d.products.filter((p) => (!filtro.cat || p.categoryId === filtro.cat) && (!q || GS.slugify(p.name).includes(q)))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      if (!d.products.length) {
        $('#lista').innerHTML = `<div class="lista-vacia"><h3>Todavía no cargaste productos</h3><p>Agregá el primero con sus fotos, talles y colores.</p><a class="btn" href="#/productos/nuevo">${icon('plus')} Agregar producto</a></div>`;
        return;
      }
      if (!lista.length) { $('#lista').innerHTML = '<div class="lista-vacia"><h3>Sin resultados</h3><p>Probá con otro nombre o categoría.</p></div>'; return; }
      $('#lista').innerHTML = lista.map((p) => {
        const cat = GS.categoria(d, p.categoryId);
        const pr = GS.precioDe(d, p);
        const sinFotos = !p.colors.some((c) => c.images.length);
        return `<div class="item" data-id="${esc(p.id)}">
          <div class="item-foto">${A.img(GS.primeraImagen(p), '')}</div>
          <div class="item-txt"><b>${esc(p.name)}</b><small>${esc(cat ? cat.name : 'Sin categoría')}, ${pr.promo ? `<s>${GS.precio(pr.original)}</s> ${GS.precio(pr.final)}` : GS.precio(p.price)}</small>
            <div class="item-meta">${p.colors.map((c) => `<span class="punto-color" style="--c:${esc(c.hex)}" title="${esc(c.name)}"></span>`).join('')}
              ${d.settings.featuredProductId === p.id ? `<span class="etq oro">${icon('star')} Producto del mes</span>` : ''}
              ${pr.promo ? `<span class="etq ok">-${pr.promo.discount}% ${esc(pr.promo.title)}</span>` : ''}
              ${p.visible === false ? '<span class="etq gris">Oculto</span>' : ''}
              ${sinFotos ? '<span class="etq warn">Sin fotos</span>' : ''}
              ${p.sizes.length ? `<span class="etq gris">${esc(p.sizes.join(' '))}</span>` : ''}</div></div>
          <div class="item-acc">
            <a class="btn btn-suave" href="#/productos/${encodeURIComponent(p.id)}">${icon('edit')} Editar</a>
            <button class="btn btn-suave" type="button" data-vis>${p.visible === false ? icon('eye') + ' Mostrar' : icon('eyeOff') + ' Ocultar'}</button>
            <button class="btn btn-suave" type="button" data-del aria-label="Eliminar ${esc(p.name)}">${icon('trash')}</button>
          </div></div>`;
      }).join('');
      $$('#lista .item').forEach((it) => {
        const p = d.products.find((x) => x.id === it.dataset.id);
        $('[data-vis]', it).onclick = async () => { p.visible = p.visible === false; await A.guardar(); A.toast(p.visible ? `"${p.name}" vuelve a verse en la tienda` : `"${p.name}" quedó oculto`); pintar(); };
        $('[data-del]', it).onclick = async () => {
          if (!(await A.confirmar({ titulo: 'Eliminar producto', texto: `Vas a eliminar "${esc(p.name)}" con todas sus fotos. También se quita de las promociones.`, ok: 'Eliminar', peligro: true }))) return;
          d.products = d.products.filter((x) => x.id !== p.id);
          d.promotions.forEach((pr) => { pr.productIds = (pr.productIds || []).filter((id) => id !== p.id); });
          if (d.settings.featuredProductId === p.id) d.settings.featuredProductId = '';
          await A.guardar();
          A.toast('Producto eliminado');
          pintar();
        };
      });
    };
    $('#fq').oninput = (e) => { filtro.q = e.target.value; pintar(); };
    $('#fc').onchange = (e) => { filtro.cat = e.target.value; pintar(); };
    pintar();
  };

  function editor(id) {
    const d = A.data;
    const nuevo = id === 'nuevo';
    const orig = nuevo ? null : d.products.find((p) => p.id === id);
    if (!nuevo && !orig) { A.vista().innerHTML = '<div class="lista-vacia"><h3>Ese producto ya no existe</h3><a class="btn" href="#/productos">Volver a productos</a></div>'; return; }
    if (!d.categories.length) {
      A.titulo('Agregar producto');
      A.vista().innerHTML = `<div class="lista-vacia bloque"><h3>Primero creá una categoría</h3><p>Cada producto va dentro de una categoría, por ejemplo Remeras o Pantalones.</p><a class="btn" href="#/categorias">Crear categoría</a></div>`;
      return;
    }
    const p = orig ? GS.clone(orig) : { id: GS.uid('p'), name: '', categoryId: filtro.cat || '', price: '', description: '', sizes: [], colors: [{ id: GS.uid('c'), name: 'Negro', hex: '#151515', images: [] }], visible: true };
    const inicial = JSON.stringify(p);
    let destacado = d.settings.featuredProductId === p.id;
    const inicialDest = destacado;
    A.titulo(nuevo ? 'Agregar producto' : 'Editar producto');
    A.guardia = () => JSON.stringify(p) !== inicial || destacado !== inicialDest;

    A.vista().innerHTML = `<form class="form" id="fp" novalidate>
      <section class="bloque"><div class="bloque-cab"><h2>Datos básicos</h2></div>
        <div class="form">
          <label class="campo"><span>Nombre</span><input name="name" value="${esc(p.name)}" required maxlength="80" placeholder="Ej: Remera oversize de algodón"></label>
          <div class="form-grid dos">
            <label class="campo"><span>Categoría</span><select name="categoryId" required><option value="">Elegí una categoría</option>${GS.categoriasOrdenadas(d).map((c) => `<option value="${esc(c.id)}" ${c.id === p.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <label class="campo"><span>Precio</span><div class="prefijo"><span>$</span><input name="price" type="number" inputmode="numeric" min="0" step="1" value="${esc(p.price)}" required placeholder="35000"></div><small>En pesos argentinos, sin puntos. Si el producto está en una promo, el descuento se aplica solo.</small></label>
          </div>
          <label class="campo"><span>Descripción</span><textarea name="description" maxlength="1200" placeholder="Tela, calce, detalles de confección, cuidados…">${esc(p.description)}</textarea></label>
          <p class="error-campo" id="errBasicos" role="alert"></p>
        </div>
      </section>

      <section class="bloque"><div class="bloque-cab"><h2>Talles</h2><p>Tocá los talles que tenés disponibles.</p></div>
        <div class="form">
          <div><p class="etiqueta" style="margin-bottom:8px">Letras</p><div class="talles-presets" data-grupo="letras"></div></div>
          <div><p class="etiqueta" style="margin-bottom:8px">Números</p><div class="talles-presets" data-grupo="numeros"></div></div>
          <div><p class="etiqueta">Otros talles</p><div class="talles-presets" id="tallesOtros" style="margin-top:8px"></div>
            <div class="talle-extra"><input class="input" id="talleNuevo" placeholder="Ej: Único, 28, 4XL" maxlength="10"><button class="btn btn-suave" type="button" id="talleAgregar">Agregar</button></div></div>
        </div>
      </section>

      <section class="bloque"><div class="bloque-cab"><h2>Colores y fotos</h2><p>Cada color tiene sus propias fotos. En la tienda, al tocar el círculo de un color se muestran sus fotos. La primera foto es la portada.</p></div>
        <div id="colores"></div>
        <button class="btn btn-linea" type="button" id="colorAgregar" style="margin-top:14px">${icon('plus')} Agregar color</button>
        <p class="error-campo" id="errColores" role="alert" style="margin-top:8px"></p>
      </section>

      <section class="bloque"><div class="bloque-cab"><h2>Opciones</h2></div>
        <div class="form">
          <label class="check"><input type="checkbox" name="visible" ${p.visible !== false ? 'checked' : ''}><span>Mostrar en la tienda<small>Si lo destildás, el producto queda guardado pero tus clientes no lo ven.</small></span></label>
          <label class="check"><input type="checkbox" name="destacado" ${destacado ? 'checked' : ''}><span>Producto del mes<small>Aparece destacado en el inicio. Solo puede haber uno: si elegís este, reemplaza al anterior.</small></span></label>
        </div>
      </section>

      <div class="form-pie">
        <a class="btn btn-suave" href="#/productos">Cancelar</a>
        <button class="btn" type="submit">${icon('check')} ${nuevo ? 'Guardar producto' : 'Guardar cambios'}</button>
      </div>
    </form>`;

    const form = $('#fp');
    form.addEventListener('input', (e) => {
      const n = e.target.name;
      if (n === 'name' || n === 'description') p[n] = e.target.value;
      if (n === 'price') p.price = e.target.value === '' ? '' : Number(e.target.value);
      if (n === 'categoryId') p.categoryId = e.target.value;
      if (n === 'visible') p.visible = e.target.checked;
      if (n === 'destacado') destacado = e.target.checked;
      if (e.target.hasAttribute('aria-invalid')) {
        e.target.removeAttribute('aria-invalid');
        if (!$$('[aria-invalid]', form).length) $('#errBasicos').textContent = '';
      }
    });
    form.addEventListener('change', (e) => { if (e.target.name === 'categoryId') p.categoryId = e.target.value; });

    // talles
    const pintarTalles = () => {
      const chip = (t) => `<button type="button" class="chip" aria-pressed="${p.sizes.includes(t)}" data-t="${esc(t)}">${esc(t)}</button>`;
      $('[data-grupo=letras]').innerHTML = LETRAS.map(chip).join('');
      $('[data-grupo=numeros]').innerHTML = NUMEROS.map(chip).join('');
      const otros = p.sizes.filter((t) => !LETRAS.includes(t) && !NUMEROS.includes(t));
      $('#tallesOtros').innerHTML = otros.length ? otros.map(chip).join('') : '<span class="ayuda">Ninguno</span>';
      $$('.chip[data-t]', form).forEach((b) => (b.onclick = () => {
        const t = b.dataset.t;
        if (p.sizes.includes(t)) p.sizes = p.sizes.filter((x) => x !== t);
        else {
          p.sizes.push(t);
          const orden = [...LETRAS, ...NUMEROS];
          p.sizes.sort((a, c) => { const ia = orden.indexOf(a), ic = orden.indexOf(c); return (ia < 0 ? 999 : ia) - (ic < 0 ? 999 : ic); });
        }
        pintarTalles();
      }));
    };
    pintarTalles();
    const agregarTalle = () => {
      const v = $('#talleNuevo').value.trim().toUpperCase();
      if (v && !p.sizes.includes(v)) p.sizes.push(v);
      $('#talleNuevo').value = '';
      pintarTalles();
    };
    $('#talleAgregar').onclick = agregarTalle;
    $('#talleNuevo').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTalle(); } };

    // colores
    const pintarColores = () => {
      $('#colores').innerHTML = p.colors.map((c, ci) => `<div class="color-bloque" data-ci="${ci}">
        <div class="color-cab">
          <input type="color" value="${esc(c.hex)}" aria-label="Tono del color" data-hex>
          <label class="campo"><span>Nombre del color</span><input value="${esc(c.name)}" data-nombre maxlength="30" placeholder="Ej: Azul marino"></label>
          <button class="btn btn-icono" type="button" data-quitar aria-label="Quitar este color" title="Quitar color" ${p.colors.length < 2 ? 'disabled' : ''}>${icon('trash')}</button>
        </div>
        <div class="presets-color" aria-label="Colores frecuentes">${COLORES.map(([n, h]) => `<button type="button" style="--c:${h}" title="${n}" aria-label="Usar ${n}" data-preset="${h}" data-pn="${n}"></button>`).join('')}</div>
        <div class="fotos-grid">
          ${c.images.map((src, i) => `<div class="foto-mini">${A.img(src, `Foto ${i + 1}`)}${i === 0 ? '<span class="portada">Portada</span>' : ''}
            <div class="acc"><button type="button" data-mover="-1" data-i="${i}" aria-label="Mover a la izquierda" ${i === 0 ? 'disabled' : ''}>${icon('left')}</button><button type="button" data-borrar="${i}" aria-label="Quitar foto">${icon('trash')}</button><button type="button" data-mover="1" data-i="${i}" aria-label="Mover a la derecha" ${i === c.images.length - 1 ? 'disabled' : ''}>${icon('right')}</button></div></div>`).join('')}
          <label class="foto-subir">${icon('upload')}<span>Agregar fotos</span><input type="file" accept="image/*" multiple data-subir></label>
        </div>
      </div>`).join('');
      $$('.color-bloque').forEach((bl) => {
        const c = p.colors[+bl.dataset.ci];
        $('[data-hex]', bl).oninput = (e) => { c.hex = e.target.value; };
        $('[data-nombre]', bl).oninput = (e) => { c.name = e.target.value; };
        $('[data-quitar]', bl).onclick = async () => {
          if (c.images.length && !(await A.confirmar({ titulo: 'Quitar color', texto: `Se quitan también las ${c.images.length} fotos de "${esc(c.name)}".`, ok: 'Quitar', peligro: true }))) return;
          p.colors.splice(+bl.dataset.ci, 1); pintarColores();
        };
        $$('[data-preset]', bl).forEach((b) => (b.onclick = () => {
          const anterior = COLORES.find(([n]) => n === c.name);
          c.hex = b.dataset.preset;
          if (!c.name || anterior) c.name = b.dataset.pn;
          pintarColores();
        }));
        $$('[data-borrar]', bl).forEach((b) => (b.onclick = () => { c.images.splice(+b.dataset.borrar, 1); pintarColores(); }));
        $$('[data-mover]', bl).forEach((b) => (b.onclick = () => {
          const i = +b.dataset.i, j = i + +b.dataset.mover;
          [c.images[i], c.images[j]] = [c.images[j], c.images[i]];
          pintarColores();
        }));
        $('[data-subir]', bl).onchange = async (e) => {
          const files = [...e.target.files];
          if (!files.length) return;
          const zona = $('.foto-subir', bl);
          zona.classList.add('subiendo');
          zona.querySelector('span').textContent = 'Procesando…';
          for (const f of files) {
            try { c.images.push(await A.comprimir(f)); } catch (err) { A.toast(err.message, true); }
          }
          pintarColores();
        };
      });
    };
    pintarColores();
    $('#colorAgregar').onclick = () => {
      p.colors.push({ id: GS.uid('c'), name: '', hex: '#a9a9a6', images: [] });
      pintarColores();
      const ult = $$('.color-bloque').pop();
      if (ult) { ult.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('[data-nombre]', ult).focus(); }
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const errs = [];
      $$('[aria-invalid]', form).forEach((x) => x.removeAttribute('aria-invalid'));
      if (!String(p.name).trim()) { errs.push('Escribí el nombre del producto.'); form.elements.namedItem('name').setAttribute('aria-invalid', 'true'); }
      if (!p.categoryId) { errs.push('Elegí una categoría.'); form.elements.namedItem('categoryId').setAttribute('aria-invalid', 'true'); }
      if (!(Number(p.price) > 0)) { errs.push('Poné un precio mayor a cero.'); form.elements.namedItem('price').setAttribute('aria-invalid', 'true'); }
      $('#errBasicos').textContent = errs.join(' ');
      let errC = '';
      if (!p.colors.length) errC = 'Agregá al menos un color.';
      else if (p.colors.some((c) => !String(c.name).trim())) errC = 'Poné un nombre a cada color.';
      $('#errColores').textContent = errC;
      if (errs.length || errC) { (errs.length ? $('#errBasicos') : $('#errColores')).closest('.bloque').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      p.name = p.name.trim();
      p.price = Math.round(Number(p.price));
      p.colors.forEach((c) => { c.name = c.name.trim(); });
      if (nuevo) { p.createdAt = new Date().toISOString(); d.products.push(p); }
      else Object.assign(orig, p);
      if (destacado) d.settings.featuredProductId = p.id;
      else if (d.settings.featuredProductId === p.id) d.settings.featuredProductId = '';
      await A.guardar();
      A.guardia = null;
      A.toast(nuevo ? 'Producto agregado' : 'Cambios guardados');
      A.ir('#/productos');
    };
  }

  /* ================= CATEGORÍAS ================= */
  A.vistas.categorias = () => {
    A.titulo('Categorías');
    const d = A.data;
    A.vista().innerHTML = `
      <section class="bloque"><div class="bloque-cab"><h2>Nueva categoría</h2><p>Las categorías aparecen en el menú de las tres rayitas de la tienda.</p></div>
        <form class="talle-extra" id="fNueva" style="max-width:520px" novalidate><input class="input" name="n" placeholder="Ej: Camisas" maxlength="40" aria-label="Nombre de la categoría"><button class="btn" type="submit">${icon('plus')} Agregar</button></form>
        <p class="error-campo" id="errCat" role="alert" style="margin-top:8px"></p>
      </section>
      <section class="bloque"><div class="bloque-cab"><h2>Orden del menú</h2><p>Usá las flechas para cambiar el orden en que se ven.</p></div>
        <div class="lista" id="cats"></div></section>`;
    const pintar = () => {
      const cats = GS.categoriasOrdenadas(d);
      cats.forEach((c, i) => { c.order = i; });
      $('#cats').innerHTML = cats.length ? cats.map((c, i) => {
        const n = d.products.filter((p) => p.categoryId === c.id).length;
        const muestra = c.image || GS.primeraImagen(d.products.find((p) => p.categoryId === c.id) || {});
        return `<div class="item" data-id="${esc(c.id)}">
          <div class="item-foto">${A.img(muestra, '')}</div>
          <div class="item-txt"><b>${esc(c.name)}</b><small>${n} ${n === 1 ? 'producto' : 'productos'}, dirección /${esc(c.slug)}</small></div>
          <div class="item-acc">
            <button class="btn btn-suave" type="button" data-sube aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
            <button class="btn btn-suave" type="button" data-baja aria-label="Bajar" ${i === cats.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
            <button class="btn btn-suave" type="button" data-edit>${icon('edit')} Editar</button>
            <button class="btn btn-suave" type="button" data-del aria-label="Eliminar ${esc(c.name)}">${icon('trash')}</button>
          </div></div>`;
      }).join('') : '<div class="lista-vacia"><h3>No hay categorías</h3><p>Creá la primera arriba, por ejemplo Remeras.</p></div>';
      $$('#cats .item').forEach((it) => {
        const c = d.categories.find((x) => x.id === it.dataset.id);
        const mover = async (delta) => {
          const lista = GS.categoriasOrdenadas(d);
          const i = lista.indexOf(c), j = i + delta;
          [lista[i].order, lista[j].order] = [lista[j].order, lista[i].order];
          await A.guardar(); pintar();
          const btn = $(`#cats .item[data-id="${CSS.escape(c.id)}"] [data-${delta < 0 ? 'sube' : 'baja'}]`);
          if (btn && !btn.disabled) btn.focus();
        };
        $('[data-sube]', it).onclick = () => mover(-1);
        $('[data-baja]', it).onclick = () => mover(1);
        $('[data-edit]', it).onclick = () => editarCategoria(c, pintar);
        $('[data-del]', it).onclick = async () => {
          const n = d.products.filter((p) => p.categoryId === c.id).length;
          if (n) {
            A.dialogo({ titulo: 'No se puede eliminar todavía', cuerpo: `<p>"${esc(c.name)}" tiene ${n} ${n === 1 ? 'producto' : 'productos'}. Pasalos a otra categoría o eliminalos primero.</p>`, pie: `<a class="btn" href="#/productos" data-cerrar>Ver productos</a>` });
            filtro.cat = c.id;
            return;
          }
          if (!(await A.confirmar({ titulo: 'Eliminar categoría', texto: `Vas a eliminar "${esc(c.name)}".`, ok: 'Eliminar', peligro: true }))) return;
          d.categories = d.categories.filter((x) => x.id !== c.id);
          await A.guardar(); A.toast('Categoría eliminada'); pintar();
        };
      });
    };
    $('#fNueva').onsubmit = async (e) => {
      e.preventDefault();
      const n = e.target.n.value.trim();
      const err = validarNombre(n, null);
      $('#errCat').textContent = err || '';
      if (err) return;
      d.categories.push({ id: GS.uid('cat'), name: n, slug: slugUnico(n, null), order: d.categories.length, image: '' });
      e.target.reset();
      await A.guardar();
      A.toast(`Categoría "${n}" creada`);
      pintar();
    };
    pintar();
  };
  function validarNombre(n, id) {
    if (!n) return 'Escribí un nombre.';
    if (A.data.categories.some((c) => c.id !== id && GS.slugify(c.name) === GS.slugify(n))) return 'Ya existe una categoría con ese nombre.';
    return null;
  }
  function slugUnico(n, id) {
    let base = GS.slugify(n) || 'categoria', s = base, i = 2;
    while (A.data.categories.some((c) => c.id !== id && c.slug === s)) s = `${base}-${i++}`;
    return s;
  }
  function editarCategoria(c, alGuardar) {
    let imagen = c.image || '';
    const d = A.dialogo({
      titulo: 'Editar categoría',
      cuerpo: `<label class="campo"><span>Nombre</span><input id="cn" value="${esc(c.name)}" maxlength="40"></label>
        <div class="campo"><span>Foto de portada</span><small>Opcional. Si no subís una, se usa la foto del primer producto.</small>
          <div class="fotos-grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))" id="cImg"></div></div>
        <p class="error-campo" id="cErr" role="alert"></p>`,
      pie: '<button class="btn btn-suave" type="button" data-cerrar>Cancelar</button><button class="btn" type="button" id="cOk">Guardar</button>',
    });
    const pintarImg = () => {
      $('#cImg', d).innerHTML = (imagen ? `<div class="foto-mini">${A.img(imagen, '')}<div class="acc"><button type="button" id="cQuitar" aria-label="Quitar foto">${icon('trash')}</button></div></div>` : '')
        + `<label class="foto-subir">${icon('upload')}<span>${imagen ? 'Cambiar' : 'Subir foto'}</span><input type="file" accept="image/*" id="cFile"></label>`;
      const q = $('#cQuitar', d); if (q) q.onclick = () => { imagen = ''; pintarImg(); };
      $('#cFile', d).onchange = async (e) => { try { imagen = await A.comprimir(e.target.files[0], 1000); pintarImg(); } catch (err) { A.toast(err.message, true); } };
    };
    pintarImg();
    $('#cOk', d).onclick = async () => {
      const n = $('#cn', d).value.trim();
      const err = validarNombre(n, c.id);
      if (err) { $('#cErr', d).textContent = err; return; }
      if (n !== c.name) { c.name = n; c.slug = slugUnico(n, c.id); }
      c.image = imagen;
      await A.guardar();
      d.close();
      A.toast('Categoría actualizada');
      alGuardar();
    };
  }
})();
