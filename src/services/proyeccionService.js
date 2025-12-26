const ProductoRepository = require("../repository/productoRepository");
const LoteRepository = require("../repository/loteRepository");
const Proyeccion = require("../models/proyeccion.model");
const {
  buildVentasPorCodigo,
  buildStockPorCodigo,
  buildArribosPorProducto,
  simularProyeccion,
  buildDiasConStockPorCodigo,
  ensureProductos,
} = require("../Utiles/proyeccionHelper");
const ProductoService = require("./productoService");
const ProductoIgnorarService = require("./productoIgnorarService");

class ProyeccionService {
  constructor() {
    this.productoRepository = new ProductoRepository();
    this.loteRepository = new LoteRepository();
    this.productoService = new ProductoService();
    this.productoIgnorarService = new ProductoIgnorarService();
  }

  async obtenerLotesPendientes(productIds = []) {
    const lotes = await this.loteRepository.findPendientesByProducto(productIds);
    return lotes || [];
  }

  getFechaArriboFromLote(lote) {
    if (lote?.contenedor?.fechaEstimadaLlegada) {
      return new Date(lote.contenedor.fechaEstimadaLlegada);
    }
    if (lote?.fechaEstimadaDeLlegada) {
      return new Date(lote.fechaEstimadaDeLlegada);
    }
    return null;
  }

  async getProyeccionActiva() {
    return Proyeccion.findOne({ active: true }).sort({ createdAt: -1 }).lean();
  }

  async _desactivarProyeccionesPrevias() {
    await Proyeccion.updateMany({ active: true }, { $set: { active: false } });
  }

  async _guardarContextoNuevaProyeccion({
    ventasData,
    stockData,
    quiebreData,
    dateDiff,
    horizonte,
    fechaBase,
    fechaInicio,
    fechaFin,
    links,
  }) {
    await this._desactivarProyeccionesPrevias();
    const doc = await Proyeccion.create({
      active: true,
      ventasData: Array.isArray(ventasData) ? ventasData : [],
      stockData: Array.isArray(stockData) ? stockData : [],
      quiebreData: Array.isArray(quiebreData) ? quiebreData : [],
      dateDiff: Number(dateDiff) || 0,
      horizonte: Number(horizonte) || 90,
      fechaBase: fechaBase || null,
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      links: links || {},
      lastRecalculatedAt: new Date(),
    });
    return doc;
  }

  async _calcularProyeccionCompleta({
    ventasData,
    stockData,
    quiebreData,
    dateDiff,
    horizonte = 90,
    fechaBase = null,
    fechaInicio = null,
    fechaFin = null,
    proyeccionId = null,
  }) {
    const diasConStockPorCodigo = buildDiasConStockPorCodigo({
      quiebreData,
      fechaInicio,
      fechaFin,
      dateDiff,
    });
    const ventasMap = buildVentasPorCodigo(ventasData, dateDiff, diasConStockPorCodigo);
    const stockMap = buildStockPorCodigo(stockData);

    const productosAIgnorar = await this.productoIgnorarService.getAll();
    const codigosAIgnorar = productosAIgnorar.map((p) => p.codigo);
    const codigos = Array.from(new Set([...ventasMap.keys(), ...stockMap.keys()])).filter(
      (codigo) =>
        !codigosAIgnorar.some(
          (c) =>
            typeof c === "string" &&
            typeof codigo === "string" &&
            c.toLowerCase() === codigo.toLowerCase()
        )
    );

    const productos = await this.productoRepository.findByCodigos(codigos);
    const productoPorCodigo = new Map(productos.map((p) => [p.codigo, p]));

    await ensureProductos({
      stockData,
      productoPorCodigo,
    });

    const productosDespuesEnsure = Array.from(productoPorCodigo.values());

    const lotesPendientes = await this.obtenerLotesPendientes(
      productosDespuesEnsure.map((p) => p._id)
    );

    const arribosPorProducto = buildArribosPorProducto(
      lotesPendientes,
      this.getFechaArriboFromLote.bind(this),
      fechaBase
    );

    const resultados = [];

    for (const codigo of codigos) {
      const producto = productoPorCodigo.get(codigo);
      const ventasInfo = ventasMap.get(codigo) || {
        ventasDiarias: 0,
        cantidadPeriodo: 0,
        diasConStock: null,
      };

      const ventasProyectadas = Math.round(ventasInfo.ventasDiarias * horizonte);
      // Garantía: si hay ventas para el código, usamos EXACTAMENTE el mismo diasConStock
      // que se usó para calcular ventasDiarias en buildVentasPorCodigo (ventasInfo.diasConStock).
      let diasConStock = null;
      if (ventasMap.has(codigo)) {
        diasConStock = ventasInfo?.diasConStock;
      } else if (diasConStockPorCodigo && diasConStockPorCodigo instanceof Map) {
        diasConStock = diasConStockPorCodigo.has(codigo)
          ? diasConStockPorCodigo.get(codigo)
          : Number(dateDiff) || 0;
      } else {
        diasConStock = Number(dateDiff) || 0;
      }
      if (!Number.isFinite(Number(diasConStock))) diasConStock = Number(dateDiff) || 0;
      diasConStock = Math.max(0, Math.trunc(Number(diasConStock) || 0));

      const stockExcel = stockMap.get(codigo)?.stockInicial ?? null;

      const stockInicial = stockExcel != null ? stockExcel : 0;
      const stockInicialParaCalculo =
        stockExcel != null && Number.isFinite(stockExcel) ? Math.max(0, stockExcel) : 0;

      const arribos =
        producto && producto._id && arribosPorProducto.get(producto._id.toString())
          ? arribosPorProducto.get(producto._id.toString())
          : [];

      const simulacion = simularProyeccion({
        horizonte,
        stockInicial: stockInicialParaCalculo,
        ventasDiarias: ventasInfo.ventasDiarias,
        arribos,
        fechaBase,
      });

      const diasHastaAgotarStock = Number.isFinite(Number(simulacion?.diasHastaAgotarStock))
        ? Number(simulacion.diasHastaAgotarStock)
        : null;

      const payloadResultado = {
        codigo,
        productoId: producto?._id || null,
        nombre: producto?.nombre || stockMap.get(codigo)?.descripcion || "",
        stockInicial,
        ventasPeriodo: ventasInfo.cantidadPeriodo,
        ventasProyectadas,
        diasConStock,
        diasHastaAgotarStock,
        fechaAgotamientoStock: simulacion.fechaAgotamientoStock,
        cantidadCompraSugerida: simulacion.cantidadCompraSugerida,
        fechaCompraSugerida: simulacion.fechaCompraSugerida,
        stockProyectado: simulacion.stockProyectado,
        seAgota: simulacion.seAgota,
        agotamientoExcede365Dias: simulacion.agotamientoExcede365Dias,
        horizonteDias: horizonte,
        idProyeccion: proyeccionId || null,
      };

      if (producto?._id) {
        await this.productoRepository.updateProyeccionFields(producto._id, {
          idProyeccion: proyeccionId || null,
          stockActual: stockInicial,
          ventasPeriodo: ventasInfo.cantidadPeriodo,
          stockProyectado: simulacion.stockProyectado,
          ventasProyectadas,
          diasConStock,
          diasHastaAgotarStock,
          fechaAgotamientoStock: simulacion.fechaAgotamientoStock,
          cantidadCompraSugerida: simulacion.cantidadCompraSugerida,
          fechaCompraSugerida: simulacion.fechaCompraSugerida,
          seAgota: simulacion.seAgota,
          agotamientoExcede365Dias: simulacion.agotamientoExcede365Dias,
        });
      }

      resultados.push(payloadResultado);
    }

    return resultados;
  }

  async generarProyeccion({
    ventasData,
    stockData,
    quiebreData,
    dateDiff,
    horizonte = 90,
    fechaBase = null,
    fechaInicio = null,
    fechaFin = null,
    links = null,
  }) {
    try {
      const proyeccionDoc = await this._guardarContextoNuevaProyeccion({
        ventasData,
        stockData,
        quiebreData,
        dateDiff,
        horizonte,
        fechaBase,
        fechaInicio,
        fechaFin,
        links,
      });

      const resultados = await this._calcularProyeccionCompleta({
        ventasData,
        stockData,
        quiebreData,
        dateDiff,
        horizonte,
        fechaBase,
        fechaInicio,
        fechaFin,
        proyeccionId: proyeccionDoc?._id || null,
      });

      return {
        success: true,
        data: resultados,
        meta: {
          idProyeccion: proyeccionDoc?._id || null,
          horizonteDias: horizonte,
          totalProductos: resultados.length,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async recalcularDesdeUltimoContexto() {
    try {
      const proyeccion = await this.getProyeccionActiva();
      if (!proyeccion?._id) {
        return {
          success: false,
          error: "No existe una proyección activa para recalcular (subí ventas/stock primero)",
          statusCode: 409,
        };
      }
      if (!Array.isArray(proyeccion.ventasData) || !Array.isArray(proyeccion.stockData)) {
        return {
          success: false,
          error: "La proyección activa no tiene contexto (ventas/stock) para recalcular",
          statusCode: 409,
        };
      }
      if (!proyeccion.dateDiff || Number(proyeccion.dateDiff) <= 0) {
        return {
          success: false,
          error: "La proyección activa no tiene dateDiff válido para recalcular",
          statusCode: 409,
        };
      }

      const resultados = await this._calcularProyeccionCompleta({
        ventasData: proyeccion.ventasData || [],
        stockData: proyeccion.stockData || [],
        quiebreData: Array.isArray(proyeccion.quiebreData) ? proyeccion.quiebreData : [],
        dateDiff: proyeccion.dateDiff,
        horizonte: proyeccion.horizonte || 90,
        fechaBase: proyeccion.fechaBase || proyeccion.fechaFin || null,
        fechaInicio: proyeccion.fechaInicio || null,
        fechaFin: proyeccion.fechaFin || null,
        proyeccionId: proyeccion._id,
      });

      await Proyeccion.updateOne(
        { _id: proyeccion._id },
        { $set: { lastRecalculatedAt: new Date() } }
      );

      return {
        success: true,
        data: resultados,
        meta: {
          idProyeccion: proyeccion._id,
          horizonteDias: proyeccion.horizonte || 90,
          totalProductos: resultados.length,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ProyeccionService;