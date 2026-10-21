/* Ganga Store — panel principal: visitas y resumen */
(function () {
  'use strict';
  const GS = window.GS, A = GS.A;
  const { esc, $, $$, icon } = GS;

  const MODOS = [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']];
  const DESC = { dia: 'Visitas por día, últimos 14 días', semana: 'Visitas por semana, últimas 12 semanas', mes: 'Visitas por mes, últimos 12 meses', anio: 'Visitas por año' };
  let modo = 'dia';
  let tabla = false;

  A.vistas.panel = () => {
    A.titulo('Panel');
    const v = A.vista();
    const d = A.data;
    const p = GS.arParts();
    const hoy = GS.hoyKey();
    const tema = GS.temaActual(d.settings);
    const yo = A.cuenta(A.yo.id) || A.yo;
    const activas = GS.promosActivas(d);
    const ns = d.settings.counterNamespace;

    const pasos = [
      { ok: !yo.mustChange, t: 'Cambiar la contraseña inicial', href: '#/ajustes/cuenta' },
      { ok: GS.github.configurado(), t: 'Conectar GitHub para poder publicar', href: '#/ajustes/publicacion' },
      { ok: !!(d.settings.instagram || d.settings.facebook || d.settings.tiktok), t: 'Cargar Instagram y demás redes', href: '#/ajustes/tienda' },
      { ok: !!A.pub.updatedBy && A.pub.updatedBy !== 'Instalación inicial', t: 'Publicar la primera versión desde el panel', href: '' },
    ];
    const pendientes = pasos.filter((x) => !x.ok).length;

    v.innerHTML = `
      <div class="saludo"><h2>Hola, ${esc(yo.name || yo.username)}</h2>
        <p>${esc(GS.fechaLarga(hoy, { year: 'numeric' }))}, ${GS.pad(p.h)}:${GS.pad(p.min)} h en Buenos Aires</p></div>
      ${A.conflicto ? `<div class="aviso peligro">${icon('alert')}<div><b>Hay una versión publicada más nueva que tu borrador.</b><span>Alguien publicó cambios desde otro dispositivo. Si publicás tu borrador vas a reemplazarlos.</span><div class="acciones"><button class="btn btn-chico btn-suave" id="usarPublicada" type="button">Descartar mi borrador y usar la publicada</button></div></div></div>` : ''}
      ${A.sucio ? `<div class="aviso">${icon('cloud')}<div><b>Tenés cambios sin publicar.</b><span>Están guardados en este dispositivo. Tus clientes los van a ver cuando publiques.</span><div class="acciones"><button class="btn btn-chico" type="button" id="pubAhora">Publicar ahora</button><a class="btn btn-chico btn-suave" href="./?preview=1" target="_blank" rel="noopener">Ver vista previa</a></div></div></div>` : ''}
      ${A.esperandoPages ? `<div class="aviso">${icon('refresh')}<div><b>La tienda se está actualizando.</b><span>Suele tardar uno o dos minutos en mostrar lo último que publicaste.</span></div></div>` : ''}
      ${A.esSuper() && pendientes ? `<section class="bloque"><div class="bloque-cab"><h2>Primeros pasos</h2></div>
        <ol class="pasos">${pasos.map((x) => `<li class="${x.ok ? 'hecho' : ''}"><span>${esc(x.t)}</span>${!x.ok && x.href ? `<a href="${x.href}">Hacerlo</a>` : ''}${!x.ok && !x.href ? '<a href="#" data-publicar>Publicar</a>' : ''}</li>`).join('')}</ol></section>` : ''}

      <section class="bloque" aria-labelledby="tVisitas">
        <div class="bloque-cab"><h2 id="tVisitas">Visitas a la tienda</h2>
          <div class="segmentos" role="group" aria-label="Agrupar visitas por">${MODOS.map(([k, t]) => `<button type="button" data-m="${k}" aria-pressed="${k === modo}">${t}</button>`).join('')}</div>
        </div>
        <div class="fila-tiles" id="tiles">${['Hoy', 'Esta semana', 'Este mes', 'Este año'].map((t) => `<div class="tile"><span>${t}</span><b>–</b></div>`).join('')}</div>
        <h3 style="margin-top:22px" id="descSerie">${DESC[modo]}</h3>
        <div class="grafico" id="grafico"></div>
        <div class="grafico-pie"><span>Se cuenta una visita cada vez que alguien abre la tienda. Las tuyas desde este dispositivo no se cuentan.</span><button type="button" id="verTabla">${tabla ? 'Ver gráfico' : 'Ver como tabla'}</button></div>
      </section>

      <div class="fila-tiles" style="margin-top:16px">
        <a class="tile" href="#/productos" style="text-decoration:none;color:inherit"><span>Productos</span><b>${d.products.length}</b><small>${d.products.filter((x) => x.visible === false).length} ocultos</small></a>
        <a class="tile" href="#/categorias" style="text-decoration:none;color:inherit"><span>Categorías</span><b>${d.categories.length}</b><small>en el menú</small></a>
        <a class="tile" href="#/promociones" style="text-decoration:none;color:inherit"><span>Promos activas</span><b>${activas.length}</b><small>${activas[0] ? esc(activas[0].title) : 'ninguna hoy'}</small></a>
        <a class="tile" href="#/ajustes/diseno" style="text-decoration:none;color:inherit"><span>Diseño de hoy</span><b style="font-size:22px;margin-top:6px">${esc(GS.TEMAS[tema.id].nombre)}</b><small>${tema.auto ? (tema.hasta ? 'automático, hasta el ' + GS.fechaCorta(tema.hasta) : 'automático') : 'elegido a mano'}</small></a>
      </div>`;

    const usar = $('#usarPublicada');
    if (usar) usar.onclick = async () => { if (await A.confirmar({ titulo: 'Descartar borrador', texto: 'Vas a perder los cambios que no publicaste en este dispositivo.', ok: 'Descartar', peligro: true })) { await A.descartarBorrador(); A.rutear(); } };
    const pa = $('#pubAhora');
    if (pa) pa.onclick = () => A.publicar();
    $$('[data-publicar]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); A.publicar(); }));
    $$('.segmentos button').forEach((b) => (b.onclick = () => {
      modo = b.dataset.m;
      $$('.segmentos button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      $('#descSerie').textContent = DESC[modo];
      cargarSerie(ns);
    }));
    $('#verTabla').onclick = () => { tabla = !tabla; $('#verTabla').textContent = tabla ? 'Ver gráfico' : 'Ver como tabla'; cargarSerie(ns); };
    cargarResumen(ns);
    cargarSerie(ns);
  };

  async function cargarResumen(ns) {
    try {
      const r = await GS.visitas.resumen(ns);
      const t = $('#tiles');
      if (!t) return;
      const vals = [r.hoy, r.semana, r.mes, r.anio];
      $$('.tile b', t).forEach((b, i) => { b.textContent = GS.num(vals[i]); });
    } catch (e) { /* el gráfico muestra el error */ }
  }

  let ultimaSerie = null;
  async function cargarSerie(ns) {
    const box = $('#grafico');
    if (!box) return;
    box.classList.add('cargando-datos');
    try {
      const puntos = await GS.visitas.serie(ns, modo);
      ultimaSerie = puntos;
      if (!document.body.contains(box)) return;
      box.classList.remove('cargando-datos');
      if (tabla) dibujarTabla(box, puntos); else dibujarBarras(box, puntos);
    } catch (e) {
      box.classList.remove('cargando-datos');
      box.innerHTML = `<div class="error-datos"><p>${esc(e.message && /contador/.test(e.message) ? e.message : 'No se pudo conectar con el contador de visitas. Revisá tu conexión.')}</p><button class="btn btn-chico btn-suave" type="button" id="reintentar">${icon('refresh')} Reintentar</button></div>`;
      $('#reintentar').onclick = () => { GS.visitas.limpiarCache(); cargarSerie(ns); cargarResumen(ns); };
    }
  }

  function dibujarTabla(box, puntos) {
    box.innerHTML = `<table class="tabla-datos"><thead><tr><th scope="col">Período</th><th scope="col">Visitas</th></tr></thead>
      <tbody>${[...puntos].reverse().map((p) => `<tr><td>${esc(p.largo.charAt(0).toUpperCase() + p.largo.slice(1))}</td><td>${GS.num(p.valor)}</td></tr>`).join('')}</tbody></table>`;
  }

  const redondo = (max) => {
    if (max <= 4) return 4;
    const pot = Math.pow(10, Math.floor(Math.log10(max)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * pot >= max) return m * pot;
    return 10 * pot;
  };
  function dibujarBarras(box, puntos) {
    const W = Math.max(320, box.clientWidth || 640), H = 240;
    const izq = 38, der = 6, arr = 18, abj = 30;
    const ancho = W - izq - der, alto = H - arr - abj;
    const max = redondo(Math.max(...puntos.map((p) => p.valor), 0));
    const banda = ancho / puntos.length;
    const bw = Math.min(24, banda * 0.62);
    const y = (v) => arr + alto - (v / max) * alto;
    const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
    const cadaEtiqueta = banda < 34 ? Math.ceil(34 / banda) : 1;
    const idxMax = puntos.reduce((m, p, i) => (p.valor > puntos[m].valor ? i : m), 0);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(DESC[modo])}">`;
    s += '<g class="eje">';
    ticks.forEach((t) => { s += `<line class="grilla-l" x1="${izq}" x2="${W - der}" y1="${y(t)}" y2="${y(t)}"/><text x="${izq - 8}" y="${y(t) + 4}" text-anchor="end">${GS.compacto(t)}</text>`; });
    puntos.forEach((p, i) => {
      if ((puntos.length - 1 - i) % cadaEtiqueta) return;
      s += `<text x="${izq + banda * i + banda / 2}" y="${H - 10}" text-anchor="middle">${esc(p.corto)}</text>`;
    });
    s += `</g><line class="base-l" x1="${izq}" x2="${W - der}" y1="${y(0)}" y2="${y(0)}"/>`;
    puntos.forEach((p, i) => {
      const cx = izq + banda * i + banda / 2, x = cx - bw / 2, top = y(p.valor), h = Math.max(0, y(0) - top);
      const r = Math.min(4, h, bw / 2);
      const d = h > 0 ? `M${x} ${y(0)} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${y(0)} Z` : '';
      s += `<rect class="hit" x="${izq + banda * i}" y="${arr}" width="${banda}" height="${alto}" tabindex="0" data-i="${i}" aria-label="${esc(p.largo)}: ${p.valor} visitas"/>`;
      s += `<path class="barra ${p.actual ? 'actual' : ''}" d="${d}"/>`;
      if ((i === idxMax && p.valor > 0) || (p.actual && p.valor > 0)) s += `<text class="valor" x="${cx}" y="${top - 6}" text-anchor="middle">${GS.compacto(p.valor)}</text>`;
    });
    s += '</svg><div class="tooltip" hidden></div>';
    box.innerHTML = s;
    const tip = $('.tooltip', box);
    const svg = $('svg', box);
    const mostrar = (el) => {
      const p = puntos[+el.dataset.i];
      tip.innerHTML = `<b>${GS.num(p.valor)}</b><span>${p.valor === 1 ? 'visita' : 'visitas'}, ${esc(p.largo)}</span>`;
      const esc2 = svg.getBoundingClientRect().width / W;
      const cx = (izq + banda * +el.dataset.i + banda / 2) * esc2;
      tip.style.left = Math.min(Math.max(cx, 90), box.clientWidth - 90) + 'px';
      tip.style.top = y(p.valor) * esc2 + 'px';
      tip.hidden = false;
    };
    $$('.hit', box).forEach((el) => {
      el.addEventListener('pointerenter', () => mostrar(el));
      el.addEventListener('focus', () => mostrar(el));
      el.addEventListener('pointerleave', () => { tip.hidden = true; });
      el.addEventListener('blur', () => { tip.hidden = true; });
    });
  }
  let tRes;
  window.addEventListener('resize', () => {
    clearTimeout(tRes);
    tRes = setTimeout(() => { const b = $('#grafico'); if (b && ultimaSerie && !tabla) dibujarBarras(b, ultimaSerie); }, 150);
  });
})();
