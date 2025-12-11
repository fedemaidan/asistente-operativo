const { diasHastaFecha } = require("./Funciones/HandleDates");
const ProductoService = require("../services/productoService");

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const buildVentasPorCodigo = (ventasData = [], dateDiff) => {
  const ventas = new Map();
  ventasData.forEach((venta) => {
    const codigo = venta?.Codigo;
    if (!codigo) return;
    const cantidadPeriodo = toNumber(venta?.Cantidad);
    const ventasDiarias =
      dateDiff && dateDiff > 0 ? cantidadPeriodo / dateDiff : 0;
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

const buildArribosPorProducto = (lotesPendientes = [], getFechaArribo) => {
  const arribosPorProducto = new Map();

  lotesPendientes.forEach((lote) => {
    const fecha = getFechaArribo ? getFechaArribo(lote) : null;
    const dia = fecha ? diasHastaFecha(fecha) : null;
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
    const diasParaCero = Math.ceil(stock / ventasIntervalo);
    const diaAgotado = currentDay + diasParaCero;
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
}) => {
  let stock = stockInicial;
  let currentDay = 0;
  let diasHastaAgotarStock = null;
  let seAgota = false;

  const eventos = (arribos || [])
    .filter((a) => a.dia >= 0 && a.dia <= horizonte)
    .sort((a, b) => a.dia - b.dia);

  for (const evento of eventos) {
    const intervalo = evento.dia - currentDay;
    const result = consumirIntervalo(
      stock,
      currentDay,
      ventasDiarias,
      intervalo
    );
    stock = result.stock;
    currentDay = result.currentDay;
    if (result.agotado) {
      diasHastaAgotarStock = result.diasHastaAgotarStock;
      seAgota = true;
      break;
    }

    stock += evento.cantidad;
  }

  if (!seAgota && currentDay < horizonte) {
    const restante = horizonte - currentDay;
    const result = consumirIntervalo(
      stock,
      currentDay,
      ventasDiarias,
      restante
    );
    stock = result.stock;
    currentDay = result.currentDay;
    if (result.agotado) {
      diasHastaAgotarStock = result.diasHastaAgotarStock;
      seAgota = true;
    }
  }

  return {
    seAgota,
    diasHastaAgotarStock: seAgota ? Math.max(0, diasHastaAgotarStock) : null,
    stockProyectado: Math.round(stock),
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
      diasHastaAgotarStock: 0,
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
