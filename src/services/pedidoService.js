const mongoose = require("mongoose");
const PedidoRepository = require("../repository/pedidoRepository");
const ContenedorRepository = require("../repository/contenedorRepository");
const LoteRepository = require("../repository/loteRepository");

class PedidoService {
  constructor() {
    this.pedidoRepository = new PedidoRepository();
    this.contenedorRepository = new ContenedorRepository();
    this.loteRepository = new LoteRepository();
  }

  async getAllPedidos(options = {}) {
    try {
      const {
        limit = 200,
        offset = 0,
        sort = { createdAt: -1 },
      } = options;

      const result = await this.pedidoRepository.getPaginated({
        limit,
        offset,
        sort,
      });

      return {
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.hasMore,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPedidosResumen(options = {}) {
    try {
      const {
        limit = 200,
        offset = 0,
        sort = { createdAt: -1 },
      } = options;

      const paginated = await this.pedidoRepository.getPaginatedWithProductos({
        limit,
        offset,
        sort,
      });

      const pedidos = paginated.data || [];
      if (pedidos.length === 0) {
        return {
          success: true,
          data: [],
          pagination: {
            total: paginated.total,
            limit: paginated.limit,
            offset: paginated.offset,
            hasMore: paginated.hasMore,
          },
        };
      }

      const pedidoIds = pedidos.map((p) => p._id);

      const lotes = await this.loteRepository.find(
        { pedido: { $in: pedidoIds } },
        {
          populate: [
            { path: "contenedor" },
            { path: "producto" },
          ],
        }
      );

      const lotesPorPedido = new Map();
      pedidos.forEach((p) => lotesPorPedido.set(p._id.toString(), []));
      lotes.forEach((lote) => {
        const key = lote.pedido?.toString();
        if (lotesPorPedido.has(key)) {
          lotesPorPedido.get(key).push(lote);
        }
      });

      const contenedoresPorPedido = new Map();
      const totalesPorPedido = new Map();

      pedidos.forEach((pedido) => {
        const key = pedido._id.toString();
        const lotesPedido = lotesPorPedido.get(key) || [];

        // Agrupar contenedores con sus productos
        const contenedoresMap = new Map();
        lotesPedido.forEach((lote) => {
          const contId = lote.contenedor?._id?.toString() || "SIN_CONTENEDOR";
          if (!contenedoresMap.has(contId)) {
            contenedoresMap.set(contId, {
              contenedor: lote.contenedor || null,
              productos: [],
              recibido: true,
            });
          }
          const entry = contenedoresMap.get(contId);
          entry.productos.push({
            producto: lote.producto,
            cantidad: lote.cantidad,
            recibido: lote.recibido,
            fechaEstimadaDeLlegada: lote.fechaEstimadaDeLlegada,
          });
          if (!lote.recibido) {
            entry.recibido = false;
          }
        });

        const contenedores = Array.from(contenedoresMap.values()).map((c) => {
          const estado = c.recibido ? "RECIBIDO" : "EN_TRANSITO";
          return { ...c, estado };
        });

        contenedoresPorPedido.set(key, contenedores);

        // Totales
        const productosMap = new Map();
        let unidades = 0;
        lotesPedido.forEach((lote) => {
          const pid = lote.producto?._id?.toString();
          if (!pid) return;
          if (!productosMap.has(pid)) {
            productosMap.set(pid, {
              producto: lote.producto,
              cantidad: 0,
            });
          }
          productosMap.get(pid).cantidad += lote.cantidad || 0;
          unidades += lote.cantidad || 0;
        });
        totalesPorPedido.set(key, {
          productosTotales: Array.from(productosMap.values()),
          unidadesTotales: unidades,
        });
      });

      const data = pedidos.map((p) => {
        const key = p._id.toString();
        const contenedores = contenedoresPorPedido.get(key) || [];
        const totales = totalesPorPedido.get(key) || { productosTotales: [], unidadesTotales: 0 };
        return {
          pedido: p,
          contenedores,
          productosTotales: totales.productosTotales,
          unidadesTotales: totales.unidadesTotales,
        };
      });

      return {
        success: true,
        data,
        pagination: {
          total: paginated.total,
          limit: paginated.limit,
          offset: paginated.offset,
          hasMore: paginated.hasMore,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAllContenedores(options = {}) {
    try {
      const {
        limit = 200,
        offset = 0,
        sort = { createdAt: -1 },
      } = options;

      const result = await this.contenedorRepository.getPaginated({
        limit,
        offset,
        sort,
      });

      return {
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.hasMore,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createPedidoConLotes(payload = {}) {
    try {
      const {
        numeroPedido,
        observaciones = "",
        fechaEstimadaLlegada,
        productos = [],
        contenedor,
      } = payload;

      if (!numeroPedido) {
        return { success: false, error: "numeroPedido es requerido", statusCode: 400 };
      }

      if (!Array.isArray(productos) || productos.length === 0) {
        return { success: false, error: "Debe enviar al menos un producto", statusCode: 400 };
      }

      const existingPedido = await this.pedidoRepository.findByNumero(numeroPedido);
      if (existingPedido) {
        return { success: false, error: "numeroPedido ya existe", statusCode: 409 };
      }

      let contenedorDoc = null;
      let contenedorId = null;

      if (contenedor) {
        const { tipo, id, codigo, fechaEstimadaLlegada: fechaContenedor } = contenedor;

        if (tipo === "existente") {
          contenedorDoc = await this.contenedorRepository.findById(id);
          if (!contenedorDoc) {
            return { success: false, error: "Contenedor no encontrado", statusCode: 404 };
          }
          contenedorId = contenedorDoc._id;
        } else if (tipo === "nuevo") {
          if (!codigo) {
            return { success: false, error: "codigo de contenedor es requerido", statusCode: 400 };
          }

          const fechaParaContenedor = fechaContenedor || fechaEstimadaLlegada;
          if (!fechaParaContenedor) {
            return {
              success: false,
              error: "fechaEstimadaLlegada es requerida para el contenedor",
              statusCode: 400,
            };
          }

          contenedorDoc = await this.contenedorRepository.createWithSession(
            {
              codigo,
              fechaEstimadaLlegada: fechaParaContenedor,
            },
            undefined
          );
          contenedorId = contenedorDoc._id;
        }
      }

      const pedido = await this.pedidoRepository.createWithSession(
        {
          numeroPedido,
          observaciones,
          productos: productos.map((p) => ({ producto: p.productoId, cantidad: p.cantidad })),
        },
        undefined
      );

      const lotesData = productos.map((p) => ({
        pedido: pedido._id,
        producto: p.productoId,
        cantidad: p.cantidad,
        contenedor: contenedorId || null,
        fechaEstimadaDeLlegada: contenedorId ? null : fechaEstimadaLlegada,
        recibido: false,
      }));

      const lotes = await this.loteRepository.createManyWithSession(lotesData, undefined);

      return {
        success: true,
        data: {
          pedido,
          contenedor: contenedorDoc,
          lotes,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = PedidoService;
