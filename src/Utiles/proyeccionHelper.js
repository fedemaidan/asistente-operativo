const ProductoService = require("../services/productoService");

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const calcularFechaDesdeBase = (baseDate, dias) => {
  if (!baseDate || dias == null) return null;
  const base = new Date(baseDate);
  base.setHours(12, 0, 0, 0);
  return new Date(base.getTime() + dias * MS_IN_DAY);
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeCodigo = (codigo) =>
  typeof codigo === "string" ? codigo.trim().toUpperCase() : String(codigo || "").trim().toUpperCase();

const normalizeDateToNoon = (dateLike) => {
  if (!dateLike) return null;
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
};

/**
 * Regla:
 * - Quiebre (stock llega a 0) abre un intervalo "sin stock" desde esa fecha (inclusive)
 * - Un ingreso con cantidad > 0 cierra el intervalo en su fecha (ese día ya cuenta como con stock)
 */
const buildDiasConStockPorCodigo = ({
  quiebreData = [],
  fechaInicio = null,
  fechaFin = null,
  dateDiff = 0,
} = {}) => {
  const inicio = normalizeDateToNoon(fechaInicio);
  const fin = normalizeDateToNoon(fechaFin);
  const diasPeriodo = Number(dateDiff) || 0;
  if (!inicio || !fin || diasPeriodo <= 0 || !Array.isArray(quiebreData) || quiebreData.length === 0) {
    return new Map();
  }

  const eventosPorCodigo = new Map(); // codigoLower -> [{ type, date, qty? }]

  for (const row of quiebreData) {
    const codigoKey = normalizeCodigo(row?.codigo || row?.Codigo);
    if (!codigoKey) continue;

    const fechaIngreso = normalizeDateToNoon(row?.fechaIngreso);
    const cantidadIngreso = toNumber(row?.cantidadIngreso);
    const fechaQuiebre = normalizeDateToNoon(row?.fechaQuiebre);

    if (!eventosPorCodigo.has(codigoKey)) eventosPorCodigo.set(codigoKey, []);
    const eventos = eventosPorCodigo.get(codigoKey);

    if (fechaQuiebre) {
      eventos.push({ type: "QUIEBRE", date: fechaQuiebre });
    }
    if (fechaIngreso && cantidadIngreso > 0) {
      eventos.push({ type: "INGRESO", date: fechaIngreso, cantidad: cantidadIngreso });
    }
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const dayIndex = (d) => Math.floor((normalizeDateToNoon(d).getTime() - inicio.getTime()) / MS_IN_DAY);

  const diasConStockPorCodigo = new Map();

  for (const [codigoKey, eventos] of eventosPorCodigo.entries()) {
    if (!Array.isArray(eventos) || eventos.length === 0) continue;

    // Importante: si QUIEBRE e INGRESO caen el mismo día, el orden debe ser:
    // QUIEBRE primero y luego INGRESO (para cerrar el intervalo en ese mismo día => 0 días sin stock).
    eventos.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      if (a.type === b.type) return 0;
      return a.type === "QUIEBRE" ? -1 : 1;
    });

    // Armar intervalos sin stock
    const intervalos = [];
    let openStart = null;

    for (const ev of eventos) {
      if (ev.type === "QUIEBRE" && !openStart) {
        openStart = ev.date;
        continue;
      }
      if (ev.type === "INGRESO" && openStart && ev.date.getTime() >= openStart.getTime()) {
        intervalos.push({ start: openStart, end: ev.date }); // end es exclusivo
        openStart = null;
      }
    }
    if (openStart) {
      intervalos.push({ start: openStart, end: fin }); // si queda abierto, lo cerramos en fin del período
    }

    let diasSinStock = 0;

    for (const it of intervalos) {
      const startDate = it.start.getTime() < inicio.getTime() ? inicio : it.start;
      const endDate = it.end.getTime() > fin.getTime() ? fin : it.end;
      if (endDate.getTime() <= startDate.getTime()) continue;

      const startIdx = clamp(dayIndex(startDate), 0, diasPeriodo);
      const endIdx = clamp(dayIndex(endDate), 0, diasPeriodo);
      if (endIdx > startIdx) diasSinStock += endIdx - startIdx;
    }

    const diasConStock = Math.max(0, diasPeriodo - diasSinStock);
    diasConStockPorCodigo.set(codigoKey, diasConStock);
  }

  return diasConStockPorCodigo;
};

const buildQuiebreMetadataPorCodigo = (quiebreData = []) => {
  const metadata = new Map();
  if (!Array.isArray(quiebreData) || quiebreData.length === 0) {
    return metadata;
  }

  for (const row of quiebreData) {
    const codigo = normalizeCodigo(row?.codigo || row?.Codigo);
    if (!codigo) continue;

    const fechaCero = normalizeDateToNoon(row?.fechaQuiebre);
    const fechaIngreso = normalizeDateToNoon(row?.fechaIngreso);
    if (!metadata.has(codigo)) {
      metadata.set(codigo, { fechaCero: null, fechaIngreso: null });
    }

    const current = metadata.get(codigo);
    if (fechaCero) {
      if (!current.fechaCero || fechaCero.getTime() < current.fechaCero.getTime()) {
        current.fechaCero = fechaCero;
      }
    }
    if (fechaIngreso) {
      if (!current.fechaIngreso || fechaIngreso.getTime() > current.fechaIngreso.getTime()) {
        current.fechaIngreso = fechaIngreso;
      }
    }
  }

  return metadata;
};

const buildVentasPorCodigo = (ventasData = [], dateDiff, diasConStockPorCodigo = null) => {
  const ventas = new Map();

  ventasData.forEach((venta) => {
    const codigo = normalizeCodigo(venta?.Codigo);
    if (!codigo) return;
    const cantidadPeriodo = toNumber(venta?.Cantidad);
    // Si no hay registro de quiebre para el código, asumimos stock todo el período (dateDiff).
    const diasConStock =
      diasConStockPorCodigo && diasConStockPorCodigo instanceof Map
        ? diasConStockPorCodigo.has(codigo)
          ? diasConStockPorCodigo.get(codigo)
          : Number(dateDiff) || 0
        : Number(dateDiff) || 0;
    const divisor = diasConStock != null ? Math.max(0, Number(diasConStock) || 0) : Number(dateDiff) || 0;
    const ventasDiarias = divisor > 0 ? cantidadPeriodo / divisor : 0;

    ventas.set(codigo, { ventasDiarias, cantidadPeriodo, diasConStock });
  });
  return ventas;
};

const buildStockPorCodigo = (stockData = []) => {
  const stock = new Map();
  stockData.forEach((item) => {
    const codigo = normalizeCodigo(item?.Codigo);
    if (!codigo) return;
    const cantidad = toNumber(item?.Cantidad);
    stock.set(codigo, {
      stockInicial: cantidad,
      descripcion: item?.Descripcion,
    });
  });
  return stock;
};

const buildArribosPorProducto = (
  lotesPendientes = [],
  getFechaArribo,
  fechaBase = null
) => {
  const arribosPorProducto = new Map();

  lotesPendientes.forEach((lote) => {
    const fecha = getFechaArribo ? getFechaArribo(lote) : null;
    let dia = null;
    if (fecha && fechaBase) {
      const diffMs = fecha.getTime() - fechaBase.getTime();
      const diffDias = Math.ceil(diffMs / MS_IN_DAY);
      // Si el arribo es previo a la fecha base, no tiene sentido en la simulación
      if (diffDias >= 0) {
        dia = diffDias;
      }
    }
    if (dia === null) return;

    const prodId = lote.producto?.toString();
    if (!prodId) return;

    if (!arribosPorProducto.has(prodId)) arribosPorProducto.set(prodId, []);
    arribosPorProducto.get(prodId).push({
      dia,
      cantidad: toNumber(lote.cantidad),
    });
  });

  arribosPorProducto.forEach((arribos) =>
    arribos.sort((a, b) => a.dia - b.dia)
  );

  return arribosPorProducto;
};

const buildArribosPorDia = (arribos = []) => {
  const eventosAll = (arribos || [])
    .filter((a) => Number.isFinite(a?.dia) && a.dia >= 0)
    .map((a) => ({ dia: Math.floor(a.dia), cantidad: toNumber(a.cantidad) }))
    .sort((a, b) => a.dia - b.dia);

  const arribosPorDia = new Map();
  for (const ev of eventosAll) {
    if (ev.cantidad <= 0) continue;
    arribosPorDia.set(ev.dia, (arribosPorDia.get(ev.dia) || 0) + ev.cantidad);
  }

  const lastArriboDay = eventosAll.length > 0 ? eventosAll[eventosAll.length - 1].dia : -1;

  return { eventosAll, arribosPorDia, lastArriboDay };
};

const simularProyeccion = ({
  horizonte = 90,
  stockInicial = 0,
  ventasDiarias = 0,
  arribos = [],
  fechaBase = null,
}) => {
  const { eventosAll, arribosPorDia } = buildArribosPorDia(arribos);
  const proximoEvento = eventosAll.length > 0 ? eventosAll[0] : null;
  const diasHorizonte = Math.max(0, Math.trunc(Number(horizonte) || 0));
  const ventasDiariasNorm = Number.isFinite(Number(ventasDiarias)) ? Number(ventasDiarias) : 0;
  const stockInicialNorm = Number.isFinite(Number(stockInicial)) ? Number(stockInicial) : 0;
  const UMBRAL_DIAS_SIN_COBERTURA = 30;
  const MAX_SIMULATION_DIAS = 365;

  // Simulación operacional dentro del horizonte para calcular stock proyectado.
  const stockFinalPorDia = [];
  let stockOperativo = Math.max(0, stockInicialNorm);
  for (let day = 0; day < diasHorizonte; day += 1) {
    stockOperativo += arribosPorDia.get(day) || 0;
    if (ventasDiariasNorm > 0) {
      stockOperativo = Math.max(0, stockOperativo - ventasDiariasNorm);
    }
    stockFinalPorDia.push(stockOperativo);
  }
  const stockAlHorizonte = stockFinalPorDia.length > 0 ? stockFinalPorDia[stockFinalPorDia.length - 1] : stockOperativo;

  // Faltante neto: demanda 90 días - (stock inicial + arribos dentro de 90 días).
  const demandaHorizonte = ventasDiariasNorm > 0 ? ventasDiariasNorm * diasHorizonte : 0;
  const arribosDentroHorizonte = eventosAll.reduce(
    (acc, ev) => (ev.dia >= 0 && ev.dia < diasHorizonte ? acc + ev.cantidad : acc),
    0
  );
  const ofertaTotalHorizonte = Math.max(0, stockInicialNorm) + arribosDentroHorizonte;
  const faltanteNeto = Math.max(0, Math.ceil(demandaHorizonte - ofertaTotalHorizonte));

  let diasHastaAgotarStock = null;
  let seAgota = false;
  let agotamientoExcede365Dias = false;
  let fechaAgotamientoStock = null;
  let fechaCompraSugerida = null;
  let stockExt = Math.max(0, stockInicialNorm);
  let nextArriboIdx = 0;

  for (let day = 0; day < MAX_SIMULATION_DIAS; day += 1) {
    stockExt += arribosPorDia.get(day) || 0;
    if (ventasDiariasNorm > 0) {
      stockExt = Math.max(0, stockExt - ventasDiariasNorm);
    }

    while (nextArriboIdx < eventosAll.length && eventosAll[nextArriboIdx].dia <= day) {
      nextArriboIdx += 1;
    }

    if (stockExt <= 0 && ventasDiariasNorm > 0) {
      const nextArribo = eventosAll[nextArriboIdx];
      const gap = nextArribo ? nextArribo.dia - day : Infinity;
      if (gap >= UMBRAL_DIAS_SIN_COBERTURA || nextArribo == null) {
        diasHastaAgotarStock = day + 1;
        seAgota = true;
        fechaAgotamientoStock = fechaBase
          ? calcularFechaDesdeBase(fechaBase, diasHastaAgotarStock)
          : null;
        break;
      }
    }
  }

  if (!seAgota) {
    agotamientoExcede365Dias = MAX_SIMULATION_DIAS > 0;
  }

  const cantidadCompraSugerida = faltanteNeto > 0 ? faltanteNeto : 0;
  if (cantidadCompraSugerida > 0 && diasHastaAgotarStock != null && fechaBase) {
    fechaCompraSugerida = calcularFechaDesdeBase(fechaBase, diasHastaAgotarStock);
  }

  return {
    seAgota,
    agotamientoExcede365Dias,
    diasHastaAgotarStock,
    fechaAgotamientoStock,
    fechaCompraSugerida,
    cantidadCompraSugerida,
    proximoArriboDias: proximoEvento ? proximoEvento.dia : null,
    proximoArriboCantidad: proximoEvento ? proximoEvento.cantidad : 0,
    proximoArriboFecha:
      proximoEvento && fechaBase
        ? calcularFechaDesdeBase(fechaBase, Math.max(0, proximoEvento.dia))
        : null,
    stockProyectado: Math.round(stockAlHorizonte),
  };
};

/**
 * Crea productos faltantes a partir de los datos de stock del excel.
 * Usa ProductoService y actualiza el mapa recibido para reutilizarlo.
 */
const ensureProductos = async ({
  stockData = [],
  productoPorCodigo = new Map(),
}) => {
  const productoService = new ProductoService();

  const codigosConocidos = new Set(Array.from(productoPorCodigo.keys()).map(normalizeCodigo));
  const productosParaCrear = [];

  stockData.forEach((item) => {
    const codigo = normalizeCodigo(item?.Codigo);
    if (!codigo || codigosConocidos.has(codigo)) return;

    codigosConocidos.add(codigo);
    const cantidad = toNumber(item?.Cantidad);
    productosParaCrear.push({
      codigo,
      nombre: item?.Descripcion || codigo,
      stockActual: cantidad,
      ventasPeriodo: 0,
      ventasProyectadas: 0,
      diasHastaAgotarStock: 0,
      diasConStock: 0,
      fechaAgotamientoStock: null,
      cantidadCompraSugerida: 0,
      fechaCompraSugerida: null,
      proximoArriboFecha: null,
      proximoArriboCantidad: 0,
      seAgota: false,
      stockProyectado: cantidad,
    });
  });

  if (productosParaCrear.length === 0) return productoPorCodigo;

  // Upsert por codigo (con unique index) para evitar duplicados
  const upsertResult = await productoService.upsertManyByCodigo(productosParaCrear);
  if (!upsertResult?.success) return productoPorCodigo;

  // Releer los productos insertados para actualizar el mapa
  const codigosCreados = productosParaCrear.map((p) => p.codigo);
  const fetch = await productoService.findByCodigos(codigosCreados);
  if (fetch?.success && Array.isArray(fetch.data)) {
    fetch.data.forEach((p) => {
      if (p?.codigo) productoPorCodigo.set(p.codigo, p);
    });
  }

  return productoPorCodigo;
};

module.exports = {
  calcularFechaDesdeBase,
  buildVentasPorCodigo,
  buildStockPorCodigo,
  buildArribosPorProducto,
  buildArribosPorDia,
  buildDiasConStockPorCodigo,
  simularProyeccion,
  ensureProductos,
  buildQuiebreMetadataPorCodigo,
};
