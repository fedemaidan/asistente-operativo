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

const debugLog = (...args) => console.log("[ProyeccionService]", ...args);

class ProyeccionService {
  constructor() {
    this.productoRepository = new ProductoRepository();
    this.pedidoRepository = new PedidoRepository();
    this.contenedorRepository = new ContenedorRepository();
    this.productoService = new ProductoService();
    this.loteService = new LoteService();
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
      debugLog("Iniciando generación de proyección", {
        ventasRegistros: ventasData?.length || 0,
        stockRegistros: stockData?.length || 0,
        dateDiff,
        horizonte,
        fechaBase,
      });

      const ventasMap = buildVentasPorCodigo(ventasData, dateDiff);
      const stockMap = buildStockPorCodigo(stockData);
      debugLog("Mapeos creados", {
        ventasCodigos: ventasMap.size,
        stockCodigos: stockMap.size,
        muestraVentas: Array.from(ventasMap.entries()).slice(0, 3),
        muestraStock: Array.from(stockMap.entries()).slice(0, 3),
      });

      const codigos = Array.from(
        new Set([...ventasMap.keys(), ...stockMap.keys()])
      );
      debugLog("Total códigos a procesar", codigos.length);

      const productos = await this.productoRepository.findByCodigos(codigos);
      const productoPorCodigo = new Map(
        productos.map((p) => [p.codigo, p])
      );
      debugLog("Productos obtenidos (antes de ensureProductos)", {
        encontrados: productos.length,
        sinProducto: codigos.length - productos.length,
      });

      await ensureProductos({
        stockData,
        productoPorCodigo,
      });

      const productosDespuesEnsure = Array.from(productoPorCodigo.values());
      debugLog("Productos luego de ensureProductos", {
        total: productosDespuesEnsure.length,
      });

      const lotesPendientes = await this.obtenerLotesPendientes(
        productosDespuesEnsure.map((p) => p._id)
      );
      debugLog("Lotes pendientes", {
        total: lotesPendientes.length,
        muestra: lotesPendientes.slice(0, 3),
      });

      const arribosPorProducto = buildArribosPorProducto(
        lotesPendientes,
        this.getFechaArriboFromLote.bind(this),
        fechaBase
      );
      debugLog("Arribos agrupados", {
        productosConArribos: arribosPorProducto.size,
      });

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

        if (
          ventasInfo.cantidadPeriodo > 0 &&
          ventasInfo.ventasDiarias === 0 &&
          procesados < 20
        ) {
          debugLog("Anomalía: ventasPeriodo > 0 pero ventasDiarias = 0", {
            codigo,
            ventasInfo,
            horizonte,
          });
        }

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
          try {
            const updated = await this.productoRepository.updateProyeccionFields(
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

            if (!updated) {
              debugLog("updateProyeccionFields no devolvió documento", {
                codigo,
                productoId: producto._id,
              });
            } else if (procesados <= 10) {
              debugLog("updateProyeccionFields OK", {
                codigo,
                productoId: producto._id,
                ventasPeriodoActualizado: updated.ventasPeriodo,
                ventasProyectadasActualizado: updated.ventasProyectadas,
                stockProyectadoActualizado: updated.stockProyectado,
              });
            }
          } catch (e) {
            debugLog("Error al actualizar producto en proyección", {
              codigo,
              productoId: producto._id,
              error: e.message,
            });
          }
        }

        resultados.push(payloadResultado);
        procesados += 1;
        if (procesados <= 10 || procesados % 500 === 0) {
          debugLog("Producto procesado (preview)", {
            indice: procesados,
            codigo,
            stockInicial,
            ventasPeriodo: ventasInfo.cantidadPeriodo,
            ventasDiarias: ventasInfo.ventasDiarias,
            ventasProyectadas,
            arribos: arribos.length,
            seAgota: simulacion.seAgota,
            diasHastaAgotarStock: simulacion.diasHastaAgotarStock,
            stockProyectado: simulacion.stockProyectado,
            fechaAgotamientoStock: simulacion.fechaAgotamientoStock,
            cantidadCompraSugerida: simulacion.cantidadCompraSugerida,
            fechaCompraSugerida: simulacion.fechaCompraSugerida,
          });
        }
      }

      debugLog("Proyección finalizada", {
        totalResultados: resultados.length,
        horizonteDias: horizonte,
      });

      return {
        success: true,
        data: resultados,
        meta: {
          horizonteDias: horizonte,
          totalProductos: resultados.length,
        },
      };
    } catch (error) {
      debugLog("Error inesperado en generarProyeccion", {
        message: error.message,
        stack: error.stack,
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = ProyeccionService;