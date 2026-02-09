const ProductoRepository = require("../repository/productoRepository");
const LoteRepository = require("../repository/loteRepository");
const Proyeccion = require("../models/proyeccion.model");
const {
  calcularFechaDesdeBase,
  buildVentasPorCodigo,
  buildStockPorCodigo,
  buildArribosPorProducto,
  buildArribosPorDia,
  buildDiasConStockPorCodigo,
  simularProyeccion,
  ensureProductos,
} = require("../Utiles/proyeccionHelper");
const {
  formatDateToDDMMYYYY,
} = require("../Utiles/Funciones/HandleDates");
const ProductoService = require("./productoService");
const ProductoIgnorarService = require("./productoIgnorarService");

class ProyeccionService {
  constructor() {
    this.productoRepository = new ProductoRepository();
    this.loteRepository = new LoteRepository();
    this.productoService = new ProductoService();
    this.productoIgnorarService = new ProductoIgnorarService();
  }

  _toIdString(value) {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value?.toString === "function") return value.toString();
    return null;
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

  _buildDetalleDiario({
    horizonte,
    stockInicial,
    ventasDiarias,
    arribos = [],
    fechaBase,
  }) {
    const dias = Math.max(0, Math.trunc(Number(horizonte) || 0));
    if (dias === 0) return [];

    const { arribosPorDia } = buildArribosPorDia(arribos);
    const detalle = [];
    let stock = Number.isFinite(Number(stockInicial)) ? Number(stockInicial) : 0;
    const baseFecha = fechaBase ? new Date(fechaBase) : null;
    const ventasDiariasNumber = Number.isFinite(Number(ventasDiarias))
      ? Number(ventasDiarias)
      : 0;

    for (let dia = 0; dia < dias; dia += 1) {
      const ingresosPedido = arribosPorDia.get(dia) || 0;
      stock += ingresosPedido;
      const stockAntesVentas = stock;
      if (ventasDiariasNumber > 0) {
        stock = Math.max(0, stock - ventasDiariasNumber);
      }

      const fechaDelDia = baseFecha ? calcularFechaDesdeBase(baseFecha, dia + 1) : null;
      const fechaLabel =
        fechaDelDia && Number.isFinite(fechaDelDia.getTime())
          ? formatDateToDDMMYYYY(fechaDelDia)
          : null;
      detalle.push({
        fecha: fechaDelDia,
        fechaLabel,
        dia,
        ingresosPedido,
        ventasDiarias: ventasDiariasNumber,
        stockInicial: stockAntesVentas,
        stockFinal: stock,
      });
    }

    return detalle;
  }

  calcularProductoProyeccion({
    producto,
    codigo,
    nombre,
    stockInicial,
    ventasInfo = {},
    diasConStock,
    arribos = [],
    fechaBase,
    horizonte,
    proyeccionId,
  }) {
    const stockInicialParaCalculo =
      stockInicial != null && Number.isFinite(Number(stockInicial))
        ? Math.max(0, Number(stockInicial))
        : 0;
    const ventasDiariasRaw = Number.isFinite(Number(ventasInfo?.ventasDiarias))
      ? Number(ventasInfo.ventasDiarias)
      : 0;
    const ventasDiarias =
      ventasDiariasRaw > 0 ? Math.ceil(ventasDiariasRaw) : 0;
    const ventasPeriodo = Number.isFinite(Number(ventasInfo?.cantidadPeriodo))
      ? Number(ventasInfo.cantidadPeriodo)
      : 0;
    const ventasProyectadas = Math.round(ventasDiarias * horizonte);

    const simulacion = simularProyeccion({
      horizonte,
      stockInicial: stockInicialParaCalculo,
      ventasDiarias,
      arribos,
      fechaBase,
    });

    const detalleDiario = this._buildDetalleDiario({
      horizonte,
      stockInicial: stockInicialParaCalculo,
      ventasDiarias,
      arribos,
      fechaBase,
    });

    const diasHastaAgotarStock = Number.isFinite(Number(simulacion?.diasHastaAgotarStock))
      ? Number(simulacion.diasHastaAgotarStock)
      : null;

    const payloadResultado = {
      codigo,
      productoId: producto?._id || null,
      nombre: nombre || "",
      stockInicial,
      ventasPeriodo,
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
      detalleDiario,
    };

    return { payloadResultado, detalleDiario, simulacion };
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
      const arribos =
        producto && producto._id && arribosPorProducto.get(producto._id.toString())
          ? arribosPorProducto.get(producto._id.toString())
          : [];

      const nombreFallback = producto?.nombre || stockMap.get(codigo)?.descripcion || "";
      const { payloadResultado, detalleDiario } = this.calcularProductoProyeccion({
        producto,
        codigo,
        nombre: nombreFallback,
        stockInicial,
        ventasInfo,
        diasConStock,
        arribos,
        fechaBase,
        horizonte,
        proyeccionId,
      });

      if (producto?._id) {
        await this.productoRepository.updateProyeccionFields(producto._id, {
          idProyeccion: payloadResultado.idProyeccion,
          stockActual: payloadResultado.stockInicial,
          ventasPeriodo: payloadResultado.ventasPeriodo,
          stockProyectado: payloadResultado.stockProyectado,
          ventasProyectadas: payloadResultado.ventasProyectadas,
          diasConStock: payloadResultado.diasConStock,
          diasHastaAgotarStock: payloadResultado.diasHastaAgotarStock,
          fechaAgotamientoStock: payloadResultado.fechaAgotamientoStock,
          cantidadCompraSugerida: payloadResultado.cantidadCompraSugerida,
          fechaCompraSugerida: payloadResultado.fechaCompraSugerida,
          seAgota: payloadResultado.seAgota,
          agotamientoExcede365Dias: payloadResultado.agotamientoExcede365Dias,
          proyeccionDetalle: detalleDiario,
        });
      }

      resultados.push(payloadResultado);
    }

    return resultados;
  }

  async recalcularProductosPorIds(productIds = []) {
    const ids = Array.from(
      new Set(
        (productIds || [])
          .map((id) => this._toIdString(id))
          .filter((id) => typeof id === "string" && id.trim().length > 0)
      )
    );
    if (ids.length === 0) {
      return { success: true, data: [], meta: { skipped: true } };
    }

    const proyeccion = await this.getProyeccionActiva();
    if (!proyeccion?._id) {
      return {
        success: false,
        error: "No existe una proyección activa para recalcular",
        statusCode: 409,
      };
    }
    if (
      !Array.isArray(proyeccion.ventasData) ||
      !Array.isArray(proyeccion.stockData)
    ) {
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

    const ventasData = proyeccion.ventasData || [];
    const stockData = proyeccion.stockData || [];
    const quiebreData = Array.isArray(proyeccion.quiebreData) ? proyeccion.quiebreData : [];
    const dateDiff = Number(proyeccion.dateDiff) || 0;
    const horizonte = Number(proyeccion.horizonte) || 90;
    const fechaBase = proyeccion.fechaBase || proyeccion.fechaFin || null;
    const diasConStockPorCodigo = buildDiasConStockPorCodigo({
      quiebreData,
      fechaInicio: proyeccion.fechaInicio,
      fechaFin: proyeccion.fechaFin,
      dateDiff,
    });
    const ventasMap = buildVentasPorCodigo(ventasData, dateDiff, diasConStockPorCodigo);
    const stockMap = buildStockPorCodigo(stockData);

    const productos = await this.productoRepository.find({ _id: { $in: ids } });
    if (!Array.isArray(productos) || productos.length === 0) {
      return { success: true, data: [], meta: { message: "No hay productos para recalcular" } };
    }

    const productosIgnorar = await this.productoIgnorarService.getAll();
    const codigosIgnorar = (productosIgnorar || [])
      .map((p) => (typeof p.codigo === "string" ? p.codigo.trim().toUpperCase() : null))
      .filter(Boolean);

    const lotesPendientes = await this.obtenerLotesPendientes(productos.map((p) => p._id));
    const arribosPorProducto = buildArribosPorProducto(
      lotesPendientes,
      this.getFechaArriboFromLote.bind(this),
      fechaBase
    );

    const resultados = [];

    for (const producto of productos) {
      const productoId = this._toIdString(producto._id);
      if (!productoId) continue;

      const codigoRaw = producto.codigo;
      const codigo = typeof codigoRaw === "string" ? codigoRaw.trim().toUpperCase() : "";
      if (!codigo) continue;

      if (codigosIgnorar.some((ignored) => ignored === codigo)) {
        continue;
      }

      const ventasInfo = ventasMap.get(codigo) || {
        ventasDiarias: 0,
        cantidadPeriodo: 0,
        diasConStock: null,
      };

      let diasConStock = null;
      if (ventasMap.has(codigo)) {
        diasConStock = ventasInfo.diasConStock;
      } else if (diasConStockPorCodigo instanceof Map) {
        diasConStock = diasConStockPorCodigo.get(codigo) ?? dateDiff;
      } else {
        diasConStock = dateDiff;
      }
      if (!Number.isFinite(Number(diasConStock))) diasConStock = dateDiff;
      diasConStock = Math.max(0, Math.trunc(Number(diasConStock) || 0));

      const stockInfo = stockMap.get(codigo) || {};
      const stockInicial =
        stockInfo.stockInicial != null ? stockInfo.stockInicial : 0;
      const arribos = arribosPorProducto.get(productoId) || [];
      const nombreFallback = producto?.nombre || stockInfo.descripcion || "";

      const { payloadResultado, detalleDiario } = this.calcularProductoProyeccion({
        producto,
        codigo,
        nombre: nombreFallback,
        stockInicial,
        ventasInfo,
        diasConStock,
        arribos,
        fechaBase,
        horizonte,
        proyeccionId: proyeccion._id,
      });

      if (producto?._id) {
        await this.productoRepository.updateProyeccionFields(producto._id, {
          idProyeccion: payloadResultado.idProyeccion,
          stockActual: payloadResultado.stockInicial,
          ventasPeriodo: payloadResultado.ventasPeriodo,
          stockProyectado: payloadResultado.stockProyectado,
          ventasProyectadas: payloadResultado.ventasProyectadas,
          diasConStock: payloadResultado.diasConStock,
          diasHastaAgotarStock: payloadResultado.diasHastaAgotarStock,
          fechaAgotamientoStock: payloadResultado.fechaAgotamientoStock,
          cantidadCompraSugerida: payloadResultado.cantidadCompraSugerida,
          fechaCompraSugerida: payloadResultado.fechaCompraSugerida,
          seAgota: payloadResultado.seAgota,
          agotamientoExcede365Dias: payloadResultado.agotamientoExcede365Dias,
          proyeccionDetalle: detalleDiario,
        });
      }

      resultados.push(payloadResultado);
    }

    return { success: true, data: resultados, meta: { recalculados: resultados.length } };
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