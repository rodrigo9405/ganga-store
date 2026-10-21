/* Ganga Store — contador de visitas.
   Como la tienda no tiene servidor ni base de datos, las visitas se cuentan con Abacus
   (abacus.jasoncameron.dev), un contador público y gratuito. Cada visita suma 1 al día,
   la semana, el mes y el año en curso (hora argentina). */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});
  const API = 'https://abacus.jasoncameron.dev';

  function isoSemana(key) {
    const dt = GS.keyToUTC(key);
    const dia = (dt.getUTCDay() + 6) % 7; // lunes = 0
    dt.setUTCDate(dt.getUTCDate() - dia + 3); // jueves de esa semana
    const anio = dt.getUTCFullYear();
    const primerJueves = new Date(Date.UTC(anio, 0, 4));
    const sem = 1 + Math.round(((dt - primerJueves) / 86400000 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7);
    return { anio, sem };
  }
  const lunesDe = (key) => GS.sumarDias(key, -((GS.keyToUTC(key).getUTCDay() + 6) % 7));
  const claves = (key) => {
    const [y, m, d] = key.split('-');
    const w = isoSemana(key);
    return { d: `d-${y}${m}${d}`, w: `w-${w.anio}-${GS.pad(w.sem)}`, m: `m-${y}${m}`, y: `y-${y}` };
  };

  const V = (GS.visitas = {});
  V.claves = claves;
  V.dispositivoExcluido = () => GS.ls.get('gs_no_contar', false) === true;
  V.excluirDispositivo = (si) => (si ? GS.ls.set('gs_no_contar', true) : GS.ls.del('gs_no_contar'));

  /* Suma una visita por sesión del navegador. No cuenta vistas previas ni dispositivos del equipo. */
  V.registrar = (ns) => {
    try {
      if (!ns || V.dispositivoExcluido() || /[?&]preview/.test(location.search)) return;
      if (sessionStorage.getItem('gs_visita')) return;
      sessionStorage.setItem('gs_visita', '1');
    } catch (e) { return; }
    const c = claves(GS.hoyKey());
    [c.d, c.w, c.m, c.y, 'total'].forEach((k) => {
      fetch(`${API}/hit/${encodeURIComponent(ns)}/${k}`, { mode: 'cors', keepalive: true }).catch(() => {});
    });
  };

  const cache = new Map();
  async function leer(ns, k) {
    const ck = ns + '/' + k;
    const c = cache.get(ck);
    if (c && Date.now() - c.t < 60000) return c.v;
    const r = await fetch(`${API}/get/${encodeURIComponent(ns)}/${k}`, { mode: 'cors' });
    let v;
    if (r.status === 404) v = 0;
    else if (r.status === 429) throw new Error('El contador recibió demasiadas consultas seguidas. Esperá unos segundos y probá de nuevo.');
    else if (!r.ok) throw new Error('El contador de visitas no respondió (' + r.status + ').');
    else v = Number((await r.json()).value) || 0;
    cache.set(ck, { v, t: Date.now() });
    return v;
  }
  async function leerVarios(ns, keys) {
    const out = new Array(keys.length);
    let i = 0;
    const worker = async () => { while (i < keys.length) { const j = i++; out[j] = await leer(ns, keys[j]); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return out;
  }

  /* Serie para el gráfico del panel. modo: dia | semana | mes | anio */
  V.serie = async (ns, modo) => {
    const hoy = GS.hoyKey();
    const puntos = [];
    if (modo === 'dia') {
      for (let i = 13; i >= 0; i--) {
        const k = GS.sumarDias(hoy, -i);
        puntos.push({ clave: claves(k).d, corto: `${GS.diaSemana(k)} ${+k.slice(8)}`, largo: GS.fechaLarga(k), actual: i === 0 });
      }
    } else if (modo === 'semana') {
      const lun = lunesDe(hoy);
      for (let i = 11; i >= 0; i--) {
        const ini = GS.sumarDias(lun, -7 * i), fin = GS.sumarDias(ini, 6);
        const mi = +ini.slice(5, 7), mf = +fin.slice(5, 7);
        const corto = mi === mf ? `${+ini.slice(8)}–${+fin.slice(8)} ${GS.mesCorto(mf)}` : `${+ini.slice(8)} ${GS.mesCorto(mi)}–${+fin.slice(8)} ${GS.mesCorto(mf)}`;
        puntos.push({ clave: claves(ini).w, corto, largo: `Semana del ${GS.fechaLarga(ini, { weekday: undefined })} al ${GS.fechaLarga(fin, { weekday: undefined })}`, actual: i === 0 });
      }
    } else if (modo === 'mes') {
      let [y, m] = hoy.split('-').map(Number);
      const lista = [];
      for (let i = 0; i < 12; i++) { lista.unshift({ y, m }); m--; if (!m) { m = 12; y--; } }
      lista.forEach(({ y: yy, m: mm }, i) => puntos.push({ clave: `m-${yy}${GS.pad(mm)}`, corto: `${GS.mesCorto(mm)}${mm === 1 || i === 0 ? ' ' + String(yy).slice(2) : ''}`, largo: `${GS.mesLargo(mm)} de ${yy}`, actual: i === 11 }));
    } else {
      const y = +hoy.slice(0, 4);
      for (let i = 4; i >= 0; i--) puntos.push({ clave: `y-${y - i}`, corto: String(y - i), largo: `Año ${y - i}`, actual: i === 0 });
    }
    const valores = await leerVarios(ns, puntos.map((p) => p.clave));
    puntos.forEach((p, i) => { p.valor = valores[i]; });
    return puntos;
  };
  V.resumen = async (ns) => {
    const c = claves(GS.hoyKey());
    const [hoy, semana, mes, anio, total] = await leerVarios(ns, [c.d, c.w, c.m, c.y, 'total']);
    return { hoy, semana, mes, anio, total };
  };
  V.limpiarCache = () => cache.clear();
})();
