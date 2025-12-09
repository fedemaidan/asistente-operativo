const ProductoRepository = require("../repository/productoRepository");
const PedidoRepository = require("../repository/pedidoRepository");
const ContenedorRepository = require("../repository/contenedorRepository");
const LoteRepository = require("../repository/loteRepository");
const {
  buildDemandaPorCodigo,
  buildStockPorCodigo,
  buildArribosPorProducto,
  simularProyeccion,
} = require("../Utiles/proyeccionHelper");

class ProyeccionService {
  constructor() {
    this.productoRepository = new ProductoRepository();
    this.pedidoRepository = new PedidoRepository();
    this.contenedorRepository = new ContenedorRepository();
    this.loteRepository = new LoteRepository();
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
      const demandaMap = buildDemandaPorCodigo(ventasData, dateDiff);
      const stockMap = buildStockPorCodigo(stockData);
      const codigos = Array.from(
        new Set([...demandaMap.keys(), ...stockMap.keys()])
      );

      const productos = await this.productoRepository.findByCodigos(codigos);
      const productoPorCodigo = new Map(
        productos.map((p) => [p.codigo, p])
      );

      const lotesPendientes = await this.obtenerLotesPendientes(
        productos.map((p) => p._id)
      );

      const arribosPorProducto = buildArribosPorProducto(
        lotesPendientes,
        this.getFechaArriboFromLote.bind(this)
      );

      const resultados = [];

      for (const codigo of codigos) {
        const producto = productoPorCodigo.get(codigo);
        const demandaInfo = demandaMap.get(codigo) || {
          demandaDiaria: 0,
          cantidadPeriodo: 0,
        };

        const ventasProyectadas = Math.round(
          demandaInfo.demandaDiaria * horizonte
        );

        const stockExcel = stockMap.get(codigo)?.stockInicial ?? null;
        const stockInicial =
          stockExcel != null
            ? stockExcel
            : producto?.stockActual != null
            ? producto.stockActual
            : 0;

        const arribos =
          producto && arribosPorProducto.get(producto._id.toString())
            ? arribosPorProducto.get(producto._id.toString())
            : [];

        const simulacion = simularProyeccion({
          horizonte,
          stockInicial,
          demandaDiaria: demandaInfo.demandaDiaria,
          arribos,
        });

        const payloadResultado = {
          codigo,
          productoId: producto?._id || null,
          nombre: producto?.nombre || stockMap.get(codigo)?.descripcion || "",
          stockInicial,
          ventasPeriodo: demandaInfo.cantidadPeriodo,
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
              stockProyectado: simulacion.stockProyectado,
              ventasProyectadas,
              diasHastaAgotarStock: simulacion.diasHastaAgotarStock,
              seAgota: simulacion.seAgota,
            }
          );
        }

        resultados.push(payloadResultado);
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