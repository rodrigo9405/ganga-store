/* Ganga Store — contador de visitas.
   Cada visita suma 1 al día de hoy (hora argentina) en la base de datos.
   El panel agrupa esos días por semana, mes y año. */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});

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
  V.registrar = () => {
    try {
      if (V.dispositivoExcluido() || /[?&]preview/.test(location.search)) return;
      if (sessionStorage.getItem('gs_visita')) return;
      sessionStorage.setItem('gs_visita', '1');
    } catch (e) { return; }
    if (GS.db && GS.db.registrarVisita) GS.db.registrarVisita();
  };

  /* Totales por día, semana, mes y año (se piden una vez por minuto como mucho) */
  let cache = null;
  async function totales() {
    if (cache && Date.now() - cache.t < 60000) return cache.mapa;
    const hoy = GS.hoyKey();
    const filas = await GS.db.visitasRango('2020-01-01', hoy);
    const mapa = new Map();
    const sumar = (k, n) => mapa.set(k, (mapa.get(k) || 0) + n);
    filas.forEach((f) => {
      const c = claves(String(f.dia).slice(0, 10));
      const n = Number(f.cantidad) || 0;
      sumar(c.d, n); sumar(c.w, n); sumar(c.m, n); sumar(c.y, n); sumar('total', n);
    });
    cache = { mapa, t: Date.now() };
    return mapa;
  }
  V.limpiarCache = () => { cache = null; };

  /* Serie para el gráfico del panel. modo: dia | semana | mes | anio */
  V.serie = async (modo) => {
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
    const mapa = await totales();
    puntos.forEach((p) => { p.valor = mapa.get(p.clave) || 0; });
    return puntos;
  };
  V.resumen = async () => {
    const c = claves(GS.hoyKey());
    const mapa = await totales();
    return { hoy: mapa.get(c.d) || 0, semana: mapa.get(c.w) || 0, mes: mapa.get(c.m) || 0, anio: mapa.get(c.y) || 0, total: mapa.get('total') || 0 };
  };
})();
