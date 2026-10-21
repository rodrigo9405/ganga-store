/* Ganga Store — vista de clientes */
(function () {
  'use strict';
  const GS = window.GS;
  const { esc, $, $$, icon, precio } = GS;
  let data = null;
  let preview = false;
  const main = $('#main');

  /* ---------- arranque ---------- */
  async function iniciar() {
    $('#abrirMenu').innerHTML = icon('menu');
    $('#cerrarMenu').innerHTML = icon('close');
    $('#cabWhatsapp').innerHTML = icon('chat');
    try {
      if (/[?&]preview/.test(location.search)) {
        const b = await GS.idb.get('borrador');
        if (b && b.data) {
          data = b.data; preview = true;
          GS.imgCache = (await GS.idb.get('imgcache')) || {};
        }
      }
      if (!data) data = await GS.cargarPublicado();
      GS.normalizar(data);
    } catch (e) {
      main.innerHTML = `<div class="envoltura vacio"><h2>No pudimos cargar la tienda</h2><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Volver a intentar</button></div>`;
      return;
    }
    // Vista previa de un diseño de temporada desde el panel: ?preview=1&tema=navidad
    const temaForzado = new URLSearchParams(location.search).get('tema');
    if (temaForzado && GS.TEMAS[temaForzado]) { data.settings.themeMode = temaForzado; preview = true; }
    const tema = GS.temaActual(data.settings);
    GS.aplicarTema(tema);
    cabecera(tema);
    cajon();
    pie();
    if (preview) {
      document.body.classList.add('con-previa');
      const txt = temaForzado && GS.TEMAS[temaForzado] ? `Vista previa del diseño ${GS.TEMAS[temaForzado].nombre}.` : 'Estás viendo la tienda con los cambios sin publicar.';
      document.body.insertAdjacentHTML('beforeend', `<div class="previa" role="status">${esc(txt)} <a href="admin.html">Volver al panel</a></div>`);
    }
    window.addEventListener('hashchange', rutear);
    rutear();
    setInterval(tic, 1000);
    if (!preview) GS.visitas.registrar(data.settings.counterNamespace);
  }

  /* ---------- utilidades de interfaz ---------- */
  const imgTag = (src, alt, extra) => `<img src="${esc(GS.img(src))}" alt="${esc(alt || '')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='img/marca/sin-foto.svg'" ${extra || ''}>`;
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  const productos = () => GS.productosVisibles(data);
  const enCategoria = (cid) => productos().filter((p) => p.categoryId === cid);
  const promoUrl = (p) => `#/promo/${encodeURIComponent(p.id)}`;
  const prodUrl = (p, cid) => `#/producto/${encodeURIComponent(p.id)}${cid ? '/' + encodeURIComponent(cid) : ''}`;
  const catUrl = (c) => `#/categoria/${encodeURIComponent(c.slug)}`;
  const precioHTML = (p) => {
    const pr = GS.precioDe(data, p);
    return pr.promo
      ? `<p class="precio"><strong>${precio(pr.final)}</strong><s aria-label="Antes ${precio(pr.original)}">${precio(pr.original)}</s></p>`
      : `<p class="precio"><strong>${precio(pr.original)}</strong></p>`;
  };
  const textoRestante = (fin) => {
    const r = GS.restante(fin);
    if (r.d > 1) return `quedan ${r.d} días`;
    if (r.d === 1) return 'queda 1 día';
    if (r.h >= 1) return `quedan ${r.h} h ${r.m} min`;
    return `quedan ${r.m} min`;
  };

  /* ---------- cabecera, cajón y pie ---------- */
  function cabecera(tema) {
    const s = data.settings;
    const wa = $('#cabWhatsapp');
    if (s.whatsapp) { wa.href = GS.waLink(s.whatsapp, `Hola ${s.storeName}! Quería hacer una consulta.`); wa.target = '_blank'; wa.rel = 'noopener'; }
    const cinta = $('#cinta');
    const promo = GS.promosActivas(data)[0];
    let txt = tema.msg, href = '';
    if (!txt && promo) { txt = `${promo.title}: ${promo.discount}% off. ${textoRestante(GS.finDia(promo.end)).replace(/^q/, 'Q')}.`; href = promoUrl(promo); }
    else if (txt && promo) { href = promoUrl(promo); }
    if (txt) { cinta.textContent = txt; cinta.hidden = false; if (href) cinta.href = href; else cinta.removeAttribute('href'); }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#ffffff';
  }

  function cajon() {
    const cats = GS.categoriasOrdenadas(data);
    const promos = GS.promosActivas(data);
    const pdm = data.products.find((p) => p.id === data.settings.featuredProductId && p.visible !== false);
    $('#cajonCuerpo').innerHTML = `
      <ul class="cajon-cats">
        <li><a href="#/todo" data-ruta="#/todo">Ver todo <small>${productos().length}</small></a></li>
        ${cats.map((c) => `<li><a href="${catUrl(c)}" data-ruta="${catUrl(c)}">${esc(c.name)} <small>${enCategoria(c.id).length}</small></a></li>`).join('')}
      </ul>
      <ul class="cajon-links">
        ${promos.length ? `<li><a href="#/promociones" data-ruta="#/promociones">Promociones <small>${promos.length === 1 ? esc(promos[0].discount + '% off') : promos.length + ' activas'}</small></a></li>` : ''}
        ${pdm ? `<li><a href="${prodUrl(pdm)}">Producto del mes</a></li>` : ''}
        <li><a href="#/contacto" data-ruta="#/contacto">Contacto</a></li>
      </ul>`;
    const est = GS.estadoHorario(data.settings);
    $('#cajonPie').innerHTML = est ? `<span class="estado ${est.abierto ? 'abierto' : ''}">${esc(est.texto)}</span>` : '';
    const abrir = (si) => {
      $('#cajon').classList.toggle('abierto', si);
      $('#velo').classList.toggle('abierto', si);
      $('#cajon').setAttribute('aria-hidden', si ? 'false' : 'true');
      $('#abrirMenu').setAttribute('aria-expanded', si ? 'true' : 'false');
      document.body.style.overflow = si ? 'hidden' : '';
      if (si) setTimeout(() => { const a = $('#cajon a'); if (a) a.focus(); }, 50);
      else if (document.activeElement && $('#cajon').contains(document.activeElement)) $('#abrirMenu').focus();
    };
    $('#abrirMenu').onclick = () => abrir(true);
    $('#cerrarMenu').onclick = () => abrir(false);
    $('#velo').onclick = () => abrir(false);
    $('#cajon').addEventListener('click', (e) => { if (e.target.closest('a')) abrir(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#cajon').classList.contains('abierto')) abrir(false); });
    GS.cerrarCajon = () => abrir(false);
  }

  function pie() {
    const s = data.settings;
    const est = GS.estadoHorario(s);
    $('#pie').innerHTML = `
      <div class="envoltura">
        <div class="pie-marca">
          <img src="img/marca/corona.png" alt="" width="311" height="203">
          <span class="marca-nombre">GANGA STORE</span>
          <span class="regla" aria-hidden="true"><i></i></span>
          <span class="tagline">${esc(s.tagline || 'Luxury clothing')}</span>
        </div>
        <div class="pie-datos">
          ${est ? `<span class="estado ${est.abierto ? 'abierto' : ''}" style="justify-self:center">${esc(est.texto)}</span>` : ''}
          ${s.phone ? `<span>WhatsApp <a href="${esc(GS.waLink(s.whatsapp || s.phone))}" target="_blank" rel="noopener">${esc(s.phone)}</a></span>` : ''}
          ${s.address ? `<span>${esc(s.address)}</span>` : ''}
        </div>
        <div class="pie-legal">
          <span>© ${GS.arParts().y} ${esc(s.storeName || 'Ganga Store')}. Precios en pesos argentinos.</span>
          <a href="admin.html" rel="nofollow">Acceso para el equipo</a>
        </div>
      </div>`;
  }

  /* ---------- rutas ---------- */
  const RUTAS = [
    [/^#?\/?$/, inicio],
    [/^#\/todo$/, () => listado(null)],
    [/^#\/categoria\/([^/]+)$/, (m) => listado(decodeURIComponent(m[1]))],
    [/^#\/producto\/([^/]+)(?:\/([^/]+))?$/, (m) => detalle(decodeURIComponent(m[1]), m[2] && decodeURIComponent(m[2]))],
    [/^#\/promo\/([^/]+)$/, (m) => vistaPromo(decodeURIComponent(m[1]))],
    [/^#\/promociones$/, promociones],
    [/^#\/contacto$/, contactoPagina],
  ];
  function rutear() {
    const h = location.hash || '#/';
    if (GS.cerrarCajon) GS.cerrarCajon();
    document.body.classList.toggle('con-hero', /^#?\/?$|^#\/promo|^#\/promociones/.test(h));
    for (const [re, fn] of RUTAS) {
      const m = h.match(re);
      if (m) { fn(m); break; }
      if (re === RUTAS[RUTAS.length - 1][0]) noEncontrado();
    }
    $$('#cajon a[data-ruta]').forEach((a) => { if (a.dataset.ruta === h) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }
  function titulo(t) { document.title = t ? `${t} | Ganga Store` : 'Ganga Store | Luxury clothing'; }
  function noEncontrado() {
    titulo('Página no encontrada');
    main.innerHTML = `<div class="envoltura vacio"><h2>Esta página no existe</h2><p>Puede que el producto ya no esté disponible.</p><a class="btn" href="#/">Ir al inicio</a></div>`;
  }

  /* ---------- héroe ---------- */
  function cuentaHTML(fin) {
    return `<p class="cuenta-titulo">Termina el ${esc(GS.fechaLarga(GS.hoyKey(fin), { weekday: 'long' }))}</p>
      <div class="cuenta" data-fin="${fin.getTime()}" role="timer" aria-label="Tiempo restante de la promo">
        <div class="cuenta-u"><b data-u="d">0</b><small>días</small></div>
        <div class="cuenta-u"><b data-u="h">00</b><small>horas</small></div>
        <div class="cuenta-u"><b data-u="m">00</b><small>min</small></div>
        <div class="cuenta-u"><b data-u="s">00</b><small>seg</small></div>
      </div>`;
  }
  function heroPromo(p, idx) {
    const prods = (p.productIds || []).map((id) => data.products.find((x) => x.id === id && x.visible !== false)).filter(Boolean);
    const estilo = p.style === 'imagen' && p.image ? 'imagen' : p.style === 'claro' ? 'claro' : 'negro';
    const fotos = estilo === 'imagen' ? '' : `<div class="hero-fotos">${prods.slice(0, 3).map((x) => `<a href="${prodUrl(x)}" tabindex="-1" aria-hidden="true">${imgTag(GS.primeraImagen(x), '')}</a>`).join('')}</div>`;
    const H = idx === 0 ? 'h1' : 'h2';
    return `<section class="hero hero--${estilo}" ${estilo === 'imagen' ? `style="--hero-img:url('${esc(GS.img(p.image))}')"` : ''} aria-roledescription="promoción" aria-label="${esc(p.title)}">
      <div class="tema-hero" aria-hidden="true"></div>
      <div class="hero-in">
        <div class="hero-txt">
          <p class="hero-etiqueta">${GS.promosActivas(data).length > 1 ? 'Promoción' : 'Promo del mes'}</p>
          <p class="hero-num" aria-label="${p.discount}% de descuento"><span>${esc(p.discount)}</span><span class="pc">%</span><span class="off">off</span></p>
          <${H} class="hero-tit">${esc(p.title)}</${H}>
          ${p.subtitle ? `<p class="hero-desc">${esc(p.subtitle)}</p>` : ''}
          ${cuentaHTML(GS.finDia(p.end))}
          <a class="btn btn-oro" href="${promoUrl(p)}">Ver ${prods.length === 1 ? 'el producto' : `los ${prods.length} productos`}</a>
        </div>
        ${fotos}
      </div>
    </section>`;
  }
  function heroProducto(prod) {
    const pr = GS.precioDe(data, prod);
    return `<section class="hero hero--negro hero-producto" aria-label="Producto del mes">
      <div class="tema-hero" aria-hidden="true"></div>
      <div class="hero-in">
        <div class="hero-txt">
          <p class="hero-etiqueta">Producto del mes</p>
          <h1 class="hero-tit">${esc(prod.name)}</h1>
          ${data.settings.featuredNote ? `<p class="hero-desc">${esc(data.settings.featuredNote)}</p>` : ''}
          <p class="hero-desc" style="color:var(--hero-ink);font-size:22px">${pr.promo ? `<s style="opacity:.6;font-size:17px">${precio(pr.original)}</s> ` : ''}${precio(pr.final)}</p>
          <a class="btn btn-oro" href="${prodUrl(prod)}">Ver producto</a>
        </div>
        <div class="hero-fotos"><a href="${prodUrl(prod)}" tabindex="-1" aria-hidden="true">${imgTag(GS.primeraImagen(prod), '', 'loading="eager"')}</a></div>
      </div>
    </section>`;
  }
  function heroZona(promos, pdm) {
    let slides = promos.map(heroPromo);
    if (!slides.length && pdm) slides = [heroProducto(pdm)];
    if (!slides.length) {
      return `<section class="hero hero--claro"><div class="tema-hero" aria-hidden="true"></div><div class="hero-in"><div class="hero-txt">
        <p class="hero-etiqueta">Nueva temporada</p><h1 class="hero-tit">${esc(data.settings.storeName || 'Ganga Store')}</h1>
        <p class="hero-desc">Prendas de calidad, elegidas una por una.</p><a class="btn btn-oro" href="#/todo">Ver la colección</a></div></div></section>`;
    }
    return `<div class="hero-zona"><div class="hero-pista" id="heroPista">${slides.join('')}</div>
      ${slides.length > 1 ? `<div class="hero-puntos" role="tablist" aria-label="Promociones">${slides.map((_, i) => `<button type="button" role="tab" aria-label="Promoción ${i + 1} de ${slides.length}" aria-current="${i === 0}" data-i="${i}"></button>`).join('')}</div>` : ''}</div>`;
  }
  function activarHero() {
    const pista = $('#heroPista');
    GS.aplicarTema(GS.temaActual(data.settings));
    if (!pista) return;
    const puntos = $$('.hero-puntos button');
    if (!puntos.length) return;
    let i = 0, pausa = false;
    const ir = (n) => { i = (n + puntos.length) % puntos.length; pista.scrollTo({ left: pista.clientWidth * i, behavior: 'smooth' }); };
    puntos.forEach((b) => (b.onclick = () => { pausa = true; ir(+b.dataset.i); }));
    pista.addEventListener('scroll', () => {
      const n = Math.round(pista.scrollLeft / pista.clientWidth);
      puntos.forEach((b, j) => b.setAttribute('aria-current', String(j === n)));
      i = n;
    }, { passive: true });
    ['pointerdown', 'focusin', 'mouseenter'].forEach((ev) => pista.addEventListener(ev, () => { pausa = true; }));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setInterval(() => { if (!document.body.contains(pista)) return clearInterval(t); if (!pausa) ir(i + 1); }, 7000);
    }
  }

  /* ---------- tarjetas ---------- */
  function tarjeta(p) {
    const pr = GS.precioDe(data, p);
    const c0 = p.colors[0];
    return `<article class="card" data-pid="${esc(p.id)}">
      <a class="card-foto" href="${prodUrl(p, c0 && c0.id)}">${imgTag(GS.primeraImagen(p), p.name + (c0 ? ', color ' + c0.name : ''))}${pr.promo ? `<span class="badge">-${esc(pr.promo.discount)}%</span>` : ''}</a>
      ${p.colors.length > 1 ? `<div class="card-colores" role="group" aria-label="Colores disponibles">${p.colors.map((c, i) => `<button type="button" class="sw" style="--c:${esc(c.hex)}" aria-label="${esc(c.name)}" title="${esc(c.name)}" aria-pressed="${i === 0}" data-cid="${esc(c.id)}"></button>`).join('')}</div>` : ''}
      <a class="card-nombre" href="${prodUrl(p, c0 && c0.id)}">${esc(p.name)}</a>
      ${precioHTML(p)}
    </article>`;
  }
  function activarTarjetas(root) {
    $$('.card', root).forEach((card) => {
      const p = data.products.find((x) => x.id === card.dataset.pid);
      $$('.sw', card).forEach((b) => {
        b.onclick = () => {
          const c = p.colors.find((x) => x.id === b.dataset.cid);
          if (!c) return;
          $$('.sw', card).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
          const img = $('.card-foto img', card);
          if (c.images[0]) { img.src = GS.img(c.images[0]); img.alt = `${p.name}, color ${c.name}`; }
          $$('a', card).forEach((a) => (a.href = prodUrl(p, c.id)));
        };
      });
    });
  }

  /* ---------- inicio ---------- */
  function inicio() {
    titulo('');
    const promos = GS.promosActivas(data);
    const pdm = data.products.find((p) => p.id === data.settings.featuredProductId && p.visible !== false);
    const cats = GS.categoriasOrdenadas(data).filter((c) => enCategoria(c.id).length);
    const nuevos = [...productos()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 8);
    main.innerHTML = `
      ${heroZona(promos, pdm)}
      ${pdm && promos.length ? productoDelMes(pdm) : ''}
      ${cats.length ? `<section class="seccion"><div class="envoltura">
        <div class="seccion-cab"><h2 class="seccion-tit">Comprá por categoría</h2><a href="#/todo">Ver todo</a></div>
        <div class="cats">${cats.map((c) => { const ps = enCategoria(c.id); const img = c.image || GS.primeraImagen(ps[0]); return `<a class="cat" href="${catUrl(c)}"><div class="cat-foto">${imgTag(img, '')}</div><span class="cat-nombre">${esc(c.name)}<small>${ps.length} ${ps.length === 1 ? 'producto' : 'productos'}</small></span></a>`; }).join('')}</div>
      </div></section>` : ''}
      ${nuevos.length ? `<section class="seccion"><div class="envoltura">
        <div class="seccion-cab"><h2 class="seccion-tit">Lo último que entró</h2></div>
        <div class="grilla">${nuevos.map(tarjeta).join('')}</div>
      </div></section>` : ''}
      <section class="seccion" id="contacto"><div class="envoltura">${contactoHTML()}</div></section>`;
    activarHero();
    activarTarjetas(main);
    activarPdm();
    tic();
  }
  function productoDelMes(p) {
    const c0 = p.colors[0];
    return `<section class="seccion"><div class="envoltura"><div class="pdm" data-pid="${esc(p.id)}">
      <a class="pdm-foto" href="${prodUrl(p, c0 && c0.id)}">${imgTag(GS.primeraImagen(p), p.name)}</a>
      <div class="pdm-info">
        <p class="pdm-etq">${icon('star')} Producto del mes</p>
        <h2 class="pdm-nombre">${esc(p.name)}</h2>
        ${data.settings.featuredNote ? `<p class="pdm-nota">${esc(data.settings.featuredNote)}</p>` : ''}
        ${precioHTML(p).replace('class="precio"', 'class="precio det-precio"')}
        ${p.colors.length > 1 ? `<div class="det-colores"><p class="det-colores-txt">Color: <b>${esc(c0.name)}</b></p><div class="sws" role="group" aria-label="Colores">${p.colors.map((c, i) => `<button type="button" class="sw sw-grande" style="--c:${esc(c.hex)}" aria-label="${esc(c.name)}" aria-pressed="${i === 0}" data-cid="${esc(c.id)}"></button>`).join('')}</div></div>` : ''}
        <a class="btn" href="${prodUrl(p, c0 && c0.id)}">Ver producto</a>
      </div></div></div></section>`;
  }
  function activarPdm() {
    const box = $('.pdm');
    if (!box) return;
    const p = data.products.find((x) => x.id === box.dataset.pid);
    $$('.sw', box).forEach((b) => (b.onclick = () => {
      const c = p.colors.find((x) => x.id === b.dataset.cid);
      $$('.sw', box).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      $('.pdm-foto img', box).src = GS.img(c.images[0] || GS.primeraImagen(p));
      $('.det-colores-txt b', box).textContent = c.name;
      $$('a', box).forEach((a) => (a.href = prodUrl(p, c.id)));
    }));
  }

  /* ---------- listado ---------- */
  const ordenar = (lista, modo) => {
    const l = [...lista];
    if (modo === 'menor') l.sort((a, b) => GS.precioDe(data, a).final - GS.precioDe(data, b).final);
    else if (modo === 'mayor') l.sort((a, b) => GS.precioDe(data, b).final - GS.precioDe(data, a).final);
    else if (modo === 'promo') l.sort((a, b) => (GS.precioDe(data, b).promo ? 1 : 0) - (GS.precioDe(data, a).promo ? 1 : 0));
    else l.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return l;
  };
  function listado(slug) {
    const cat = slug ? (data.categories || []).find((c) => c.slug === slug) : null;
    if (slug && !cat) return noEncontrado();
    const base = cat ? enCategoria(cat.id) : productos();
    const nombre = cat ? cat.name : 'Toda la colección';
    titulo(nombre);
    const talles = [];
    base.forEach((p) => p.sizes.forEach((t) => { if (!talles.includes(t)) talles.push(t); }));
    const orden = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    talles.sort((a, b) => { const ia = orden.indexOf(a), ib = orden.indexOf(b); if (ia > -1 && ib > -1) return ia - ib; if (!isNaN(a) && !isNaN(b)) return a - b; return ia > -1 ? -1 : ib > -1 ? 1 : String(a).localeCompare(b); });
    const estado = { orden: 'nuevo', talles: new Set() };
    main.innerHTML = `<div class="envoltura">
      <nav class="migas" aria-label="Ubicación"><a href="#/">Inicio</a><span aria-hidden="true">/</span><span>${esc(nombre)}</span></nav>
      <div class="listado-cab"><h1>${esc(nombre)}</h1><p id="cuenta"></p></div>
      ${base.length ? `<div class="filtros">
        ${talles.length > 1 ? `<div class="chips" role="group" aria-label="Filtrar por talle">${talles.map((t) => `<button type="button" class="chip" aria-pressed="false" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : '<span></span>'}
        <label class="orden">Ordenar <select id="orden"><option value="nuevo">Lo más nuevo</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option><option value="promo">En promo primero</option></select></label>
      </div>` : ''}
      <div class="grilla" id="grilla"></div>
      <div id="sinResultados"></div>
    </div>`;
    const pintar = () => {
      let l = ordenar(base, estado.orden);
      if (estado.talles.size) l = l.filter((p) => p.sizes.some((t) => estado.talles.has(t)));
      $('#grilla').innerHTML = l.map(tarjeta).join('');
      $('#cuenta').textContent = `${l.length} ${l.length === 1 ? 'producto' : 'productos'}${estado.talles.size ? ' en talle ' + [...estado.talles].join(', ') : ''}`;
      $('#sinResultados').innerHTML = l.length ? '' : `<div class="vacio"><h2>${base.length ? 'No hay productos con esos talles' : 'Pronto vas a encontrar productos acá'}</h2>${base.length ? '<button class="btn btn-linea" id="limpiar">Quitar filtros</button>' : `<a class="btn btn-linea" href="#/todo">Ver toda la colección</a>`}</div>`;
      const lim = $('#limpiar');
      if (lim) lim.onclick = () => { estado.talles.clear(); $$('.chip[data-t]').forEach((c) => c.setAttribute('aria-pressed', 'false')); pintar(); };
      activarTarjetas($('#grilla'));
    };
    $$('.chip[data-t]').forEach((b) => (b.onclick = () => {
      const t = b.dataset.t;
      if (estado.talles.has(t)) estado.talles.delete(t); else estado.talles.add(t);
      b.setAttribute('aria-pressed', String(estado.talles.has(t)));
      pintar();
    }));
    const sel = $('#orden');
    if (sel) sel.onchange = () => { estado.orden = sel.value; pintar(); };
    pintar();
  }

  /* ---------- detalle ---------- */
  function detalle(id, colorId) {
    const p = data.products.find((x) => x.id === id && x.visible !== false);
    if (!p) return noEncontrado();
    titulo(p.name);
    const cat = GS.categoria(data, p.categoryId);
    let color = p.colors.find((c) => c.id === colorId) || p.colors[0] || { id: '', name: '', hex: '#ccc', images: [] };
    let talle = '';
    const pr = GS.precioDe(data, p);
    const relacionados = productos().filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 4);
    main.innerHTML = `<div class="envoltura">
      <nav class="migas" aria-label="Ubicación"><a href="#/">Inicio</a><span aria-hidden="true">/</span>${cat ? `<a href="${catUrl(cat)}">${esc(cat.name)}</a><span aria-hidden="true">/</span>` : ''}<span>${esc(p.name)}</span></nav>
      <div class="det">
        <div class="det-galeria">
          <div class="det-fotos" id="fotos" tabindex="0" aria-label="Fotos del producto"></div>
          <div class="det-miniaturas" id="minis"></div>
          ${p.colors.length ? `<div class="det-colores">
            <p class="det-colores-txt">Color: <b id="colorNombre">${esc(color.name)}</b></p>
            <div class="sws" role="group" aria-label="Elegí un color">${p.colors.map((c) => `<button type="button" class="sw sw-grande" style="--c:${esc(c.hex)}" aria-label="${esc(c.name)}" title="${esc(c.name)}" aria-pressed="${c.id === color.id}" data-cid="${esc(c.id)}"></button>`).join('')}</div>
          </div>` : ''}
        </div>
        <div class="det-info">
          ${cat ? `<a class="det-cat" href="${catUrl(cat)}">${esc(cat.name)}</a>` : ''}
          <h1 class="det-nombre">${esc(p.name)}</h1>
          ${precioHTML(p).replace('class="precio"', 'class="precio det-precio"')}
          ${pr.promo ? `<div class="det-promo"><strong>${esc(pr.promo.title)}: ${esc(pr.promo.discount)}% off</strong><span data-restante="${GS.finDia(pr.promo.end).getTime()}">${esc(textoRestante(GS.finDia(pr.promo.end)))}</span></div>` : ''}
          ${p.sizes.length ? `<fieldset class="det-talles"><legend>Talles disponibles</legend>
            <div class="chips">${p.sizes.map((t) => `<label class="chip"><input type="radio" name="talle" value="${esc(t)}">${esc(t)}</label>`).join('')}</div>
            <p class="det-aviso" id="avisoTalle" hidden>Elegí un talle para consultar.</p></fieldset>` : ''}
          <div class="det-acciones">
            ${data.settings.whatsapp ? `<a class="btn btn-block" id="consultar" href="#" target="_blank" rel="noopener">${icon('chat')} Consultar por WhatsApp</a>` : ''}
            <button class="btn btn-linea btn-block" id="compartir" type="button">${icon('share')} Compartir</button>
          </div>
          ${p.description ? `<div class="det-desc"><h2>Detalles</h2>${esc(p.description)}</div>` : ''}
        </div>
      </div>
      ${relacionados.length ? `<section class="seccion"><div class="seccion-cab"><h2 class="seccion-tit">También te puede gustar</h2>${cat ? `<a href="${catUrl(cat)}">Ver ${esc(cat.name.toLowerCase())}</a>` : ''}</div><div class="grilla">${relacionados.map(tarjeta).join('')}</div></section>` : ''}
    </div>`;

    const fotos = $('#fotos'), minis = $('#minis');
    const pintarFotos = () => {
      const imgs = color.images.length ? color.images : [GS.primeraImagen(p)];
      fotos.innerHTML = imgs.map((src, i) => imgTag(src, `${p.name}, color ${color.name}, foto ${i + 1} de ${imgs.length}`, i === 0 ? 'loading="eager"' : '')).join('');
      fotos.scrollLeft = 0;
      minis.innerHTML = imgs.length > 1 ? imgs.map((src, i) => `<button type="button" aria-label="Ver foto ${i + 1}" aria-current="${i === 0}" data-i="${i}">${imgTag(src, '')}</button>`).join('') : '';
      $$('button', minis).forEach((b) => (b.onclick = () => fotos.scrollTo({ left: fotos.clientWidth * +b.dataset.i, behavior: 'smooth' })));
    };
    fotos.addEventListener('scroll', () => {
      const n = Math.round(fotos.scrollLeft / fotos.clientWidth);
      $$('button', minis).forEach((b, j) => b.setAttribute('aria-current', String(j === n)));
    }, { passive: true });
    pintarFotos();
    $$('.det-colores .sw').forEach((b) => (b.onclick = () => {
      color = p.colors.find((c) => c.id === b.dataset.cid) || color;
      $$('.det-colores .sw').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      $('#colorNombre').textContent = color.name;
      pintarFotos();
      history.replaceState(null, '', prodUrl(p, color.id));
      armarConsulta();
    }));
    $$('input[name="talle"]').forEach((r) => (r.onchange = () => { talle = r.value; $('#avisoTalle').hidden = true; armarConsulta(); }));

    const consultar = $('#consultar');
    function armarConsulta() {
      if (!consultar) return;
      const precioTxt = precio(GS.precioDe(data, p).final);
      const lineas = [
        `Hola ${data.settings.storeName}! Me interesa este producto:`,
        `*${p.name}*`,
        color.name ? `Color: ${color.name}` : '',
        talle ? `Talle: ${talle}` : '',
        `Precio: ${precioTxt}`,
        '¿Está disponible?',
        location.href.split('?')[0],
      ].filter(Boolean);
      consultar.href = GS.waLink(data.settings.whatsapp, lineas.join('\n'));
    }
    armarConsulta();
    if (consultar) consultar.addEventListener('click', (e) => {
      if (p.sizes.length && !talle) {
        e.preventDefault();
        $('#avisoTalle').hidden = false;
        const primero = $('input[name="talle"]');
        if (primero) primero.focus();
      }
    });
    $('#compartir').onclick = async () => {
      const url = location.href.split('?')[0];
      try {
        if (navigator.share) await navigator.share({ title: p.name, text: `${p.name} en ${data.settings.storeName}`, url });
        else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
      } catch (e) { /* el usuario canceló */ }
    };
    activarTarjetas(main);
  }

  /* ---------- promos ---------- */
  function vistaPromo(id) {
    const p = (data.promotions || []).find((x) => x.id === id);
    if (!p || GS.promoEstado(p) !== 'activa') {
      titulo('Promo finalizada');
      main.innerHTML = `<div class="envoltura vacio"><h2>Esta promo ya no está vigente</h2><p>Mirá las promociones activas o recorré la colección.</p><a class="btn" href="#/">Ir al inicio</a></div>`;
      return;
    }
    titulo(p.title);
    const prods = (p.productIds || []).map((x) => data.products.find((y) => y.id === x && y.visible !== false)).filter(Boolean);
    main.innerHTML = `${heroPromo(Object.assign({}, p), 0).replace(/<a class="btn btn-oro"[^>]*>[^<]*<\/a>/, '')}
      <section class="seccion"><div class="envoltura">
        <div class="seccion-cab"><h2 class="seccion-tit">Productos en la promo</h2></div>
        <div class="grilla">${prods.map(tarjeta).join('')}</div>
      </div></section>`;
    GS.aplicarTema(GS.temaActual(data.settings));
    activarTarjetas(main);
    tic();
  }
  function promociones() {
    const promos = GS.promosActivas(data);
    if (promos.length === 1) { location.replace(promoUrl(promos[0])); return; }
    titulo('Promociones');
    main.innerHTML = promos.length ? promos.map(heroPromo).join('') : `<div class="envoltura vacio"><h2>No hay promociones activas</h2><p>Volvé pronto o escribinos para enterarte de las próximas.</p><a class="btn" href="#/todo">Ver la colección</a></div>`;
    GS.aplicarTema(GS.temaActual(data.settings));
    tic();
  }

  /* ---------- contacto ---------- */
  function contactoHTML() {
    const s = data.settings;
    const redes = GS.redes(s);
    const horario = GS.horarioTexto(s);
    const est = GS.estadoHorario(s);
    return `<div class="seccion-cab"><h2 class="seccion-tit">Contactanos</h2></div>
      <div class="contacto">
        <div class="contacto-lista">
          ${redes.map((r) => `<a class="contacto-fila" href="${esc(r.url)}" ${/^https?:/.test(r.url) ? 'target="_blank" rel="noopener"' : ''} data-red="${esc(r.id)}">
            <span class="ico">${icon(r.icon)}</span>
            <span><span class="t">${esc(r.label)}</span><span class="d">${esc(r.detalle)}</span></span>
            ${icon('right')}
          </a>`).join('')}
        </div>
        ${horario.length ? `<div class="horario">
          <h3>Horario de atención</h3>
          ${est ? `<span class="estado ${est.abierto ? 'abierto' : ''}">${esc(est.texto)}</span>` : ''}
          <dl>${horario.map((h) => `<dt>${esc(h.dias)}</dt><dd>${esc(h.horas)}</dd>`).join('')}</dl>
          <p class="zona">Hora de Buenos Aires</p>
        </div>` : ''}
      </div>`;
  }
  function contactoPagina() {
    titulo('Contacto');
    main.innerHTML = `<section class="seccion"><div class="envoltura">${contactoHTML()}</div></section>`;
  }

  /* ---------- reloj de las cuentas regresivas ---------- */
  function tic() {
    $$('.cuenta[data-fin]').forEach((el) => {
      const r = GS.restante(+el.dataset.fin);
      const set = (u, v) => { const b = el.querySelector(`[data-u="${u}"]`); if (b && b.textContent !== v) b.textContent = v; };
      set('d', String(r.d)); set('h', GS.pad(r.h)); set('m', GS.pad(r.m)); set('s', GS.pad(r.s));
    });
    $$('[data-restante]').forEach((el) => { el.textContent = textoRestante(+el.dataset.restante); });
  }

  iniciar();
})();
