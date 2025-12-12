const { diasHastaFecha } = require("./Funciones/HandleDates");
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

const buildVentasPorCodigo = (ventasData = [], dateDiff) => {
  const ventas = new Map();

  console.log("[ProyeccionHelper] buildVentasPorCodigo -> resumen", {
    filasVentas: ventasData?.length || 0,
    dateDiff,
  });

  let debugCount = 0;

  ventasData.forEach((venta) => {
    const codigo = venta?.Codigo;
    if (!codigo) return;
    const cantidadPeriodo = toNumber(venta?.Cantidad);
    const ventasDiarias =
      dateDiff && dateDiff > 0 ? cantidadPeriodo / dateDiff : 0;

    if (debugCount < 10) {
      console.log("[ProyeccionHelper] fila venta", {
        codigo,
        cantidadPeriodo,
        dateDiff,
        ventasDiarias,
      });
      debugCount += 1;
    }

    ventas.set(codigo, { ventasDiarias, cantidadPeriodo });
  });
  return ventas;
};

const buildStockPorCodigo = (stockData = []) => {
  const stock = new Map();
  stockData.forEach((item) => {
    const codigo = item?.Codigo;
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
    } else if (fecha) {
      // Fallback legacy: calculamos desde hoy
      dia = diasHastaFecha(fecha);
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

const consumirIntervalo = (stock, currentDay, ventasDiarias, diasIntervalo) => {
  if (diasIntervalo <= 0 || ventasDiarias <= 0) {
    return { stock, currentDay, agotado: false, diasHastaAgotarStock: null };
  }

  const ventasIntervalo = ventasDiarias * diasIntervalo;
  const stockDespues = stock - ventasIntervalo;

  if (stockDespues < 0) {
    const diasParaCero = Math.ceil(stock / ventasDiarias);
    const diaAgotado = currentDay + Math.min(diasParaCero, diasIntervalo);
    return {
      stock: 0,
      currentDay: diaAgotado,
      agotado: true,
      diasHastaAgotarStock: diaAgotado,
    };
  }

  return {
    stock: stockDespues,
    currentDay: currentDay + diasIntervalo,
    agotado: false,
    diasHastaAgotarStock: null,
  };
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
      fechaCompraSugerida: fechaBase ? calcularFechaDesdeBase(fechaBase, -100) : null,
      cantidadCompraSugerida: ventasDiarias > 0 ? Math.round(ventasDiarias * 100) : 0,
      proximoArriboDias: null,
      proximoArriboCantidad: 0,
      proximoArriboFecha: null,
      stockProyectado: 0,
    };
  }

  const eventosAll = (arribos || [])
    .filter((a) => a.dia >= 0)
    .sort((a, b) => a.dia - b.dia);

  const eventosHorizon = eventosAll.filter((a) => a.dia <= horizonte);
  const proximoEvento = eventosAll.length > 0 ? eventosAll[0] : null;

  // Simulación para stock proyectado a horizonte (solo eventos hasta horizonte)
  let stockH = stockInicial;
  let dayH = 0;
  for (const ev of eventosHorizon) {
    const intervalo = ev.dia - dayH;
    const r = consumirIntervalo(stockH, dayH, ventasDiarias, intervalo);
    stockH = r.stock;
    dayH = r.currentDay;
    if (r.agotado) break;
    stockH += ev.cantidad;
  }
  if (dayH < horizonte) {
    const rem = horizonte - dayH;
    const r = consumirIntervalo(stockH, dayH, ventasDiarias, rem);
    stockH = r.stock;
    dayH = r.currentDay;
  }

  // Simulación completa para fecha de agotamiento (sin límite de horizonte)
  let stock = stockInicial;
  let currentDay = 0;
  let diasHastaAgotarStock = null;
  let seAgota = false;

  for (const evento of eventosAll) {
    const intervalo = evento.dia - currentDay;
    const result = consumirIntervalo(stock, currentDay, ventasDiarias, intervalo);
    stock = result.stock;
    currentDay = result.currentDay;
    if (result.agotado) {
      diasHastaAgotarStock = result.diasHastaAgotarStock;
      seAgota = true;
      break;
    }
    stock += evento.cantidad;
  }

  if (!seAgota && ventasDiarias > 0 && stock > 0) {
    // consumir hasta agotar (aunque sea después del horizonte)
    const diasExtra = Math.ceil(stock / ventasDiarias);
    diasHastaAgotarStock = currentDay + diasExtra;
    seAgota = true;
    stock = 0;
  }

  const diasAgot = seAgota ? Math.max(0, diasHastaAgotarStock) : null;
  const fechaAgot =
    seAgota && fechaBase ? calcularFechaDesdeBase(fechaBase, diasAgot) : seAgota ? new Date() : null;

  return {
    seAgota,
    diasHastaAgotarStock: diasAgot,
    fechaAgotamientoStock: fechaAgot,
    fechaCompraSugerida:
      seAgota && fechaBase ? calcularFechaDesdeBase(fechaBase, Math.max(0, diasAgot - 100)) : null,
    cantidadCompraSugerida: seAgota && ventasDiarias > 0 ? Math.round(ventasDiarias * 100) : 0,
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

  const codigosConocidos = new Set(productoPorCodigo.keys());
  const productosParaCrear = [];

  stockData.forEach((item) => {
    const codigo = item?.Codigo;
    if (!codigo || codigosConocidos.has(codigo)) return;

    codigosConocidos.add(codigo);
    const cantidad = toNumber(item?.Cantidad);
    productosParaCrear.push({
      codigo,
      nombre: item?.Descripcion || codigo,
      stockActual: cantidad,
      ventasPeriodo: 0,
      ventasProyectadas: 0,
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

  const result = await productoService.createManyProductos(productosParaCrear);
  if (result?.success && Array.isArray(result.data)) {
    result.data.forEach((p) => {
      if (p?.codigo) productoPorCodigo.set(p.codigo, p);
    });
  }

  return productoPorCodigo;
};

module.exports = {
  buildVentasPorCodigo,
  buildStockPorCodigo,
  buildArribosPorProducto,
  simularProyeccion,
  ensureProductos,
};
