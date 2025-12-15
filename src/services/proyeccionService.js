const ProductoRepository = require("../repository/productoRepository");
const PedidoRepository = require("../repository/pedidoRepository");
const ContenedorRepository = require("../repository/contenedorRepository");
const {
  buildVentasPorCodigo,
  buildStockPorCodigo,
  buildArribosPorProducto,
  simularProyeccion,
  ensureProductos,
} = require("../Utiles/proyeccionHelper");
const ProductoService = require("./productoService");
const LoteService = require("./loteService");
const ProductoIgnorarService = require("./productoIgnorarService");

class ProyeccionService {
  constructor() {
    this.productoRepository = new ProductoRepository();
    this.pedidoRepository = new PedidoRepository();
    this.contenedorRepository = new ContenedorRepository();
    this.productoService = new ProductoService();
    this.loteService = new LoteService();
    this.productoIgnorarService = new ProductoIgnorarService();
  }

  async obtenerLotesPendientes(productIds = []) {
    const result = await this.loteService.findPendientesByProducto(productIds);
    if (!result.success) throw new Error(result.error);
    return result.data || [];
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

  async generarProyeccion({
    ventasData,
    stockData,
    dateDiff,
    horizonte = 90,
    fechaBase = null,
  }) {
    try {

      const ventasMap = buildVentasPorCodigo(ventasData, dateDiff);
      const stockMap = buildStockPorCodigo(stockData);
      
      const productosAIgnorar = await this.productoIgnorarService.getAll();
      const codigosAIgnorar = productosAIgnorar.map((p) => p.codigo);
      let codigos = Array.from(
        new Set([...ventasMap.keys(), ...stockMap.keys()])
      ).filter(
        (codigo) =>
          !codigosAIgnorar.some(
            (c) =>
              typeof c === "string" &&
              typeof codigo === "string" &&
              c.toLowerCase() === codigo.toLowerCase()
          )
      );


      const productos = await this.productoRepository.findByCodigos(codigos);
      const productoPorCodigo = new Map(
        productos.map((p) => [p.codigo, p])
      );

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
      let procesados = 0;

      for (const codigo of codigos) {
        const producto = productoPorCodigo.get(codigo);
        const ventasInfo = ventasMap.get(codigo) || {
          ventasDiarias: 0,
          cantidadPeriodo: 0,
        };

        const ventasProyectadas = Math.round(
          ventasInfo.ventasDiarias * horizonte
        );

        const stockExcel = stockMap.get(codigo)?.stockInicial ?? null;

        const stockInicial = stockExcel != null ? stockExcel : 0;
        const stockInicialParaCalculo =
          stockExcel != null && Number.isFinite(stockExcel)
            ? Math.max(0, stockExcel)
            : 0;

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

        const payloadResultado = {
          codigo,
          productoId: producto?._id || null,
          nombre: producto?.nombre || stockMap.get(codigo)?.descripcion || "",
          stockInicial,
          ventasPeriodo: ventasInfo.cantidadPeriodo,
          ventasProyectadas,
          diasHastaAgotarStock: simulacion.diasHastaAgotarStock,
          fechaAgotamientoStock: simulacion.fechaAgotamientoStock,
          cantidadCompraSugerida: simulacion.cantidadCompraSugerida,
          fechaCompraSugerida: simulacion.fechaCompraSugerida,
          stockProyectado: simulacion.stockProyectado,
          seAgota: simulacion.seAgota,
          horizonteDias: horizonte,
        };

        if (producto?._id) {  
            await this.productoRepository.updateProyeccionFields(
              producto._id,
              {
                stockActual: stockInicial,
                ventasPeriodo: ventasInfo.cantidadPeriodo,
                stockProyectado: simulacion.stockProyectado,
                ventasProyectadas,
                fechaAgotamientoStock: simulacion.fechaAgotamientoStock,
                cantidadCompraSugerida: simulacion.cantidadCompraSugerida,
                fechaCompraSugerida: simulacion.fechaCompraSugerida,
                seAgota: simulacion.seAgota,
              }
            );
        }

        resultados.push(payloadResultado);
        procesados += 1;
      }

      return {
        success: true,
        data: resultados,
        meta: {
          horizonteDias: horizonte,
          totalProductos: resultados.length,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ProyeccionService;