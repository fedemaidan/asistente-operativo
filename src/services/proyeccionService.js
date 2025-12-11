const ProductoRepository = require("../repository/productoRepository");
const PedidoRepository = require("../repository/pedidoRepository");
const ContenedorRepository = require("../repository/contenedorRepository");
const LoteRepository = require("../repository/loteRepository");
const {
  buildVentasPorCodigo,
  buildStockPorCodigo,
  buildArribosPorProducto,
  simularProyeccion,
  ensureProductos,
} = require("../Utiles/proyeccionHelper");
const ProductoService = require("./productoService");

const debugLog = (...args) => console.log("[ProyeccionService]", ...args);

class ProyeccionService {
  constructor() {
    this.productoRepository = new ProductoRepository();
    this.pedidoRepository = new PedidoRepository();
    this.contenedorRepository = new ContenedorRepository();
    this.loteRepository = new LoteRepository();
    this.productoService = new ProductoService();
  }

  async obtenerLotesPendientes(productIds = []) {
    return this.loteRepository.findPendientesByProducto(productIds);
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
  }) {
    try {
      debugLog("Iniciando generación de proyección", {
        ventasRegistros: ventasData?.length || 0,
        stockRegistros: stockData?.length || 0,
        dateDiff,
        horizonte,
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
      debugLog("Productos obtenidos", {
        encontrados: productos.length,
        sinProducto: codigos.length - productos.length,
      });

      const lotesPendientes = await this.obtenerLotesPendientes(
        productos.map((p) => p._id)
      );
      debugLog("Lotes pendientes", {
        total: lotesPendientes.length,
        muestra: lotesPendientes.slice(0, 3),
      });

      const arribosPorProducto = buildArribosPorProducto(
        lotesPendientes,
        this.getFechaArriboFromLote.bind(this)
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

        const arribos =
          producto && arribosPorProducto.get(producto._id.toString())
            ? arribosPorProducto.get(producto._id.toString())
            : [];

        await ensureProductos({
          stockData,
          productoPorCodigo,
        });

        const simulacion = simularProyeccion({
          horizonte,
          stockInicial,
          ventasDiarias: ventasInfo.ventasDiarias,
          arribos,
        });

        const payloadResultado = {
          codigo,
          productoId: producto?._id || null,
          nombre: producto?.nombre || stockMap.get(codigo)?.descripcion || "",
          stockInicial,
          ventasPeriodo: ventasInfo.cantidadPeriodo,
          ventasProyectadas,
          diasHastaAgotarStock: simulacion.diasHastaAgotarStock,
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
              diasHastaAgotarStock: simulacion.diasHastaAgotarStock,
              seAgota: simulacion.seAgota,
            }
          );
        }

        resultados.push(payloadResultado);
        procesados += 1;
        if (procesados <= 5 || procesados % 500 === 0) {
          debugLog("Producto procesado", {
            indice: procesados,
            codigo,
            stockInicial,
            ventasDiarias: ventasInfo.ventasDiarias,
            arribos: arribos.length,
            seAgota: simulacion.seAgota,
            diasHastaAgotarStock: simulacion.diasHastaAgotarStock,
            stockProyectado: simulacion.stockProyectado,
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
      return { success: false, error: error.message };
    }
  }
}

module.exports = ProyeccionService;