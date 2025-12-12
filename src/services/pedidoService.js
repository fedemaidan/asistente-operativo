const PedidoRepository = require("../repository/pedidoRepository");
const ContenedorRepository = require("../repository/contenedorRepository");
const LoteService = require("./loteService");

class PedidoService {
  constructor() {
    this.pedidoRepository = new PedidoRepository();
    this.contenedorRepository = new ContenedorRepository();
    this.loteService = new LoteService();
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

      const lotesResult = await this.loteService.findLotes(
        { pedido: { $in: pedidoIds } },
        {
          populate: [{ path: "contenedor" }, { path: "producto" }],
        }
      );
      if (!lotesResult.success) {
        return { success: false, error: lotesResult.error };
      }
      const lotes = lotesResult.data || [];

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
            recibido: lote.estado === "ENTREGADO",
            fechaEstimadaDeLlegada: lote.fechaEstimadaDeLlegada,
          });
          if (lote.estado !== "ENTREGADO") {
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

  async setEstadoPedido(pedidoId, estado) {
    try {
      if (!pedidoId) {
        return { success: false, error: "pedidoId es requerido", statusCode: 400 };
      }
      if (!estado || !["PENDIENTE", "ENTREGADO", "CANCELADO"].includes(estado)) {
        return { success: false, error: "estado inválido", statusCode: 400 };
      }

      const pedido = await this.pedidoRepository.findById(pedidoId);
      if (!pedido) {
        return { success: false, error: "Pedido no encontrado", statusCode: 404 };
      }

      const lotesResult = await this.loteService.setEstadoPorPedido(pedidoId, estado);
      if (!lotesResult.success) {
        return { success: false, error: lotesResult.error, statusCode: lotesResult.statusCode || 500 };
      }

      const totalResult = await this.loteService.countLotesPorPedido(pedidoId);
      const pendResult = await this.loteService.countPendientesPorPedido(pedidoId);
      if (!totalResult.success || !pendResult.success) {
        return {
          success: false,
          error: (totalResult.error || pendResult.error) || "Error al derivar estado",
          statusCode: (totalResult.statusCode || pendResult.statusCode) || 500,
        };
      }

      const total = totalResult.data || 0;
      const pendientes = pendResult.data || 0;
      const estadoDerivado = total > 0 && pendientes === 0 ? "ENTREGADO" : "PENDIENTE";

      // Cache opcional en el pedido (si se quiere persistir)
      const updatedPedido = await this.pedidoRepository.updateById(
        pedidoId,
        { estado: estadoDerivado },
        { new: true }
      );

      return {
        success: true,
        data: {
          ...(updatedPedido?.toObject ? updatedPedido.toObject() : updatedPedido),
          estado: estadoDerivado,
        },
        meta: {
          lotesCambiados: lotesResult.meta?.changedCount || 0,
          estadoDerivado,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async asociarContenedorExistente(pedidoId, contenedorId) {
    try {
      if (!pedidoId || !contenedorId) {
        return {
          success: false,
          error: "pedidoId y contenedorId son requeridos",
          statusCode: 400,
        };
      }

      const pedido = await this.pedidoRepository.findById(pedidoId);
      if (!pedido) {
        return {
          success: false,
          error: "Pedido no encontrado",
          statusCode: 404,
        };
      }

      const contenedor = await this.contenedorRepository.findById(contenedorId);
      if (!contenedor) {
        return {
          success: false,
          error: "Contenedor no encontrado",
          statusCode: 404,
        };
      }

      if (!pedido.productos || pedido.productos.length === 0) {
        return {
          success: false,
          error: "El pedido no tiene productos para asociar",
          statusCode: 400,
        };
      }

      const lotesData = pedido.productos.map((p) => ({
        pedido: pedido._id,
        producto: p.producto,
        cantidad: p.cantidad,
        contenedor: contenedor._id,
        fechaEstimadaDeLlegada: null,
        estado: "PENDIENTE",
      }));

      const lotesResult = await this.loteService.createManyLotes(lotesData);
      if (!lotesResult.success) {
        return { success: false, error: lotesResult.error, statusCode: lotesResult.statusCode || 500 };
      }
      const lotes = lotesResult.data || [];

      return {
        success: true,
        data: {
          pedido,
          contenedor,
          lotes,
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

      const contenedores = result.data || [];

      // Derivar estado desde lotes (si no hay lotes => PENDIENTE)
      const enriched = await Promise.all(
        contenedores.map(async (c) => {
          const contId = c?._id;
          if (!contId) return { ...c.toObject?.() ? c.toObject() : c, estado: "PENDIENTE" };

          const totalRes = await this.loteService.countLotesPorContenedor(contId);
          const pendRes = await this.loteService.countPendientesPorContenedor(contId);
          const total = totalRes.success ? totalRes.data || 0 : 0;
          const pendientes = pendRes.success ? pendRes.data || 0 : 0;
          const estado = total > 0 && pendientes === 0 ? "ENTREGADO" : "PENDIENTE";

          return {
            ...(c.toObject?.() ? c.toObject() : c),
            estado,
            lotesTotal: total,
            lotesPendientes: pendientes,
          };
        })
      );

      return {
        success: true,
        data: enriched,
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
        return { success: false, error: "El numero de pedido ya existe", statusCode: 409 };
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

          contenedorDoc = await this.contenedorRepository.create({
            codigo,
            fechaEstimadaLlegada: fechaParaContenedor,
          });
          contenedorId = contenedorDoc._id;
        }
      }

      const pedido = await this.pedidoRepository.create({
        numeroPedido,
        observaciones,
        productos: productos.map((p) => ({ producto: p.productoId, cantidad: p.cantidad })),
      });

      const lotesData = productos.map((p) => ({
        pedido: pedido._id,
        producto: p.productoId,
        cantidad: p.cantidad,
        contenedor: contenedorId || null,
        fechaEstimadaDeLlegada: contenedorId ? null : fechaEstimadaLlegada,
        estado: "PENDIENTE",
      }));

      const lotesResult = await this.loteService.createManyLotes(lotesData);
      if (!lotesResult.success) {
        return { success: false, error: lotesResult.error, statusCode: lotesResult.statusCode || 500 };
      }
      const lotes = lotesResult.data || [];

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
