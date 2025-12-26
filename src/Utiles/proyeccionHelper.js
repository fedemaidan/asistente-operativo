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

const simularProyeccion = ({
  horizonte = 90,
  stockInicial = 0,
  ventasDiarias = 0,
  arribos = [],
  fechaBase = null,
}) => {
  if (stockInicial <= 0) {
    const fechaAgot = fechaBase ? calcularFechaDesdeBase(fechaBase, 0) : new Date();
    return {
      seAgota: true,
      diasHastaAgotarStock: 0,
      fechaAgotamientoStock: fechaAgot,
      fechaCompraSugerida: fechaBase ? calcularFechaDesdeBase(fechaBase, 0) : new Date(),
      cantidadCompraSugerida: ventasDiarias > 0 ? Math.round(ventasDiarias * 100) : 0,
      proximoArriboDias: null,
      proximoArriboCantidad: 0,
      proximoArriboFecha: null,
      stockProyectado: 0,
    };
  }

  // Normalizamos y ordenamos arribos (día >= 0), y los agrupamos por día para simular día-a-día.
  const eventosAll = (arribos || [])
    .filter((a) => Number.isFinite(a?.dia) && a.dia >= 0)
    .map((a) => ({ dia: Math.floor(a.dia), cantidad: toNumber(a.cantidad) }))
    .sort((a, b) => a.dia - b.dia);

  const proximoEvento = eventosAll.length > 0 ? eventosAll[0] : null;

  const arribosPorDia = new Map(); // day -> totalCantidad
  for (const ev of eventosAll) {
    if (ev.cantidad <= 0) continue;
    arribosPorDia.set(ev.dia, (arribosPorDia.get(ev.dia) || 0) + ev.cantidad);
  }

  const lastArriboDay = eventosAll.length > 0 ? eventosAll[eventosAll.length - 1].dia : -1;

  /**
   * Simula stock día por día.
   * Regla de orden (consistente con la simulación anterior):
   * - Al inicio del día: se suma el arribo del día (si hay).
   * - Al final del día: se descuenta ventasDiarias (si ventasDiarias > 0).
   */
  const simularHastaDia = (endDayExclusive, initialStock) => {
    let stock = initialStock;
    const dias = Math.max(0, Math.floor(endDayExclusive));
    for (let day = 0; day < dias; day += 1) {
      stock += arribosPorDia.get(day) || 0;
      if (ventasDiarias > 0) {
        stock = Math.max(0, stock - ventasDiarias);
      }
    }
    return stock;
  };

  // Stock al horizonte: se consumen ventas SOLO hasta horizonte, sumando arribos en esos días.
  const stockAlHorizonte = simularHastaDia(horizonte, stockInicial);

  // sumamos TODOS los arribos posteriores al horizonte (sin consumir ventas después).
  let sumaArribosPostHorizonte = 0;
  for (const ev of eventosAll) {
    if (ev.dia >= horizonte) sumaArribosPostHorizonte += ev.cantidad;
  }
  const stockH = stockAlHorizonte + sumaArribosPostHorizonte;

  // Simulación completa para fecha de agotamiento (sin límite de horizonte)
  let diasHastaAgotarStock = null;
  let seAgota = false;
  let agotamientoExcede365Dias = false;

  if (ventasDiarias > 0) {
    const MAX_DIAS_SIMULACION = 365;
    // Simulamos día por día hasta agotar, aplicando arribos de cualquier día (>= 0).
    let stock = stockInicial;
    let day = 0;

    // Simulamos explícitamente hasta el último día con arribo.
    const endArribos = Math.max(0, lastArriboDay + 1);
    const endSim = Math.min(endArribos, MAX_DIAS_SIMULACION);
    for (; day < endSim; day += 1) {
      stock += arribosPorDia.get(day) || 0;
      stock = stock - ventasDiarias;
      if (stock <= 0) {
        seAgota = true;
        diasHastaAgotarStock = day + 1; // cantidad de días transcurridos hasta llegar a 0
        stock = 0;
        break;
      }
    }

    if (!seAgota && day >= MAX_DIAS_SIMULACION) {
      agotamientoExcede365Dias = true;
    }

    // Si no se agotó todavía y ya no hay más arribos, el resto es lineal: se agota en ceil(stock/ventasDiarias) días.
    if (!seAgota && stock > 0 && day < MAX_DIAS_SIMULACION) {
      const diasExtra = Math.ceil(stock / ventasDiarias);
      const diaAgotamiento = day + diasExtra;
      if (diaAgotamiento <= MAX_DIAS_SIMULACION) {
        seAgota = true;
        diasHastaAgotarStock = diaAgotamiento;
      } else {
        agotamientoExcede365Dias = true;
      }
    }
  }

  const diasAgot = seAgota ? Math.max(0, diasHastaAgotarStock) : null;
  const fechaAgot =
    seAgota && fechaBase ? calcularFechaDesdeBase(fechaBase, diasAgot) : seAgota ? new Date() : null;

  return {
    seAgota,
    agotamientoExcede365Dias,
    diasHastaAgotarStock: diasAgot,
    fechaAgotamientoStock: fechaAgot,
    fechaCompraSugerida:
      seAgota && fechaBase ? calcularFechaDesdeBase(fechaBase, Math.max(0, diasAgot - 90)) : null,
    cantidadCompraSugerida: seAgota && ventasDiarias > 0 ? Math.round(ventasDiarias * 90) : 0,
    proximoArriboDias: proximoEvento ? proximoEvento.dia : null,
    proximoArriboCantidad: proximoEvento ? proximoEvento.cantidad : 0,
    proximoArriboFecha:
      proximoEvento && fechaBase
        ? calcularFechaDesdeBase(fechaBase, Math.max(0, proximoEvento.dia))
        : null,
    stockProyectado: Math.round(stockH),
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
  buildVentasPorCodigo,
  buildStockPorCodigo,
  buildArribosPorProducto,
  buildDiasConStockPorCodigo,
  simularProyeccion,
  ensureProductos,
};
