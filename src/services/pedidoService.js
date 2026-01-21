const PedidoRepository = require("../repository/pedidoRepository");
const ContenedorRepository = require("../repository/contenedorRepository");
const LoteService = require("./loteService");

class PedidoService {
  constructor() {
    this.pedidoRepository = new PedidoRepository();
    this.contenedorRepository = new ContenedorRepository();
    this.loteService = new LoteService();
  }

  _toIdString(value) {
    if (!value) return null;
    // Puede venir como ObjectId, string, o documento poblado { _id: ObjectId(...) }
    const candidate = value?._id ?? value;
    if (typeof candidate === "string") return candidate;
    if (typeof candidate?.toString === "function") return candidate.toString();
    return null;
  }

  _normalizeDistribucion(distribucion = []) {
    if (!Array.isArray(distribucion)) return [];
    return distribucion
      .filter((item) => item && item.productoId)
      .map((item) => ({
        productoId: item.productoId,
        cantidad: Number(item.cantidad),
        contenedor: item.contenedor || null,
        fechaEstimadaLlegada: item.fechaEstimadaLlegada || null,
      }));
  }

  async _resolveContenedoresForDistribucion(distribucion = []) {
    const contenedoresPorCodigo = new Map();
    const contenedoresPorId = new Map();

    for (const item of distribucion) {
      const contenedor = item.contenedor;
      if (!contenedor) continue;

      if (contenedor.tipo === "existente") {
        const contenedorId = contenedor.id;
        if (!contenedorId) {
          return { success: false, error: "contenedorId es requerido", statusCode: 400 };
        }
        if (!contenedoresPorId.has(contenedorId)) {
          const doc = await this.contenedorRepository.findById(contenedorId);
          if (!doc) {
            return { success: false, error: "Contenedor no encontrado", statusCode: 404 };
          }
          contenedoresPorId.set(contenedorId, doc);
        }
      }

      if (contenedor.tipo === "nuevo") {
        const codigo = contenedor.codigo;
        const fechaEstimadaLlegada = contenedor.fechaEstimadaLlegada;
        if (!codigo) {
          return { success: false, error: "codigo de contenedor es requerido", statusCode: 400 };
        }
        if (!fechaEstimadaLlegada) {
          return {
            success: false,
            error: "fechaEstimadaLlegada es requerida para el contenedor",
            statusCode: 400,
          };
        }
        if (!contenedoresPorCodigo.has(codigo)) {
          const existente = await this.contenedorRepository.findByCodigo(codigo);
          if (existente) {
            return { success: false, error: "codigo de contenedor ya existe", statusCode: 409 };
          }
          const created = await this.contenedorRepository.create({
            codigo,
            fechaEstimadaLlegada,
          });
          contenedoresPorCodigo.set(codigo, created);
        }
      }
    }

    return { success: true, contenedoresPorCodigo, contenedoresPorId };
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
            loteId: lote._id,
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
          const estado = c.recibido ? "ENTREGADO" : "PENDIENTE";
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
      if (!estado || !["PENDIENTE", "ENTREGADO"].includes(estado)) {
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

  async _actualizarTotalesPedidoDesdeLotes(pedidoId) {
    const lotesResult = await this.loteService.findLotes(
      { pedido: pedidoId },
      { populate: [{ path: "producto", select: "_id" }] }
    );
    if (!lotesResult.success) {
      return { success: false, error: lotesResult.error };
    }
    const lotes = lotesResult.data || [];
    const productosMap = new Map();
    lotes.forEach((lote) => {
      const pid = lote.producto?._id?.toString() || lote.producto?.toString();
      if (!pid) return;
      productosMap.set(pid, (productosMap.get(pid) || 0) + (lote.cantidad || 0));
    });
    const productos = Array.from(productosMap.entries()).map(([producto, cantidad]) => ({
      producto,
      cantidad,
    }));
    const updated = await this.pedidoRepository.updateById(
      pedidoId,
      { productos },
      { new: true }
    );
    return { success: true, data: updated };
  }

  async updatePedidoLotes(pedidoId, payload = {}) {
    try {
      if (!pedidoId) {
        return { success: false, error: "pedidoId es requerido", statusCode: 400 };
      }

      const pedido = await this.pedidoRepository.findById(pedidoId);
      if (!pedido) {
        return { success: false, error: "Pedido no encontrado", statusCode: 404 };
      }

      const { create = [], update = [], remove = [] } = payload;
      const crear = Array.isArray(create) ? create : [];
      const actualizar = Array.isArray(update) ? update : [];
      const eliminar = Array.isArray(remove) ? remove : [];

      const distribucionCrear = this._normalizeDistribucion(crear);
      const contenedoresResult = await this._resolveContenedoresForDistribucion(distribucionCrear);
      if (!contenedoresResult.success) {
        return contenedoresResult;
      }

      const created = [];
      for (const item of distribucionCrear) {
        let contenedorIdForItem = null;
        if (item.contenedor?.tipo === "existente") {
          contenedorIdForItem = contenedoresResult.contenedoresPorId.get(item.contenedor.id)?._id || null;
        }
        if (item.contenedor?.tipo === "nuevo") {
          contenedorIdForItem =
            contenedoresResult.contenedoresPorCodigo.get(item.contenedor.codigo)?._id || null;
        }

        const loteResult = await this.loteService.createLote({
          pedido: pedidoId,
          producto: item.productoId,
          cantidad: item.cantidad,
          contenedor: contenedorIdForItem,
          fechaEstimadaDeLlegada: contenedorIdForItem ? null : item.fechaEstimadaLlegada,
          estado: "PENDIENTE",
        });
        if (!loteResult.success) {
          return { success: false, error: loteResult.error, statusCode: loteResult.statusCode || 500 };
        }
        created.push(loteResult.data);
      }

      const updated = [];
      for (const item of actualizar) {
        if (!item || !item.loteId) {
          return { success: false, error: "loteId es requerido", statusCode: 400 };
        }

        let contenedorIdForItem = undefined;
        let fechaEstimadaDeLlegada = undefined;
        if (item.contenedor) {
          const contenedor = item.contenedor;
          if (contenedor.tipo === "existente") {
            const doc = await this.contenedorRepository.findById(contenedor.id);
            if (!doc) {
              return { success: false, error: "Contenedor no encontrado", statusCode: 404 };
            }
            contenedorIdForItem = doc._id;
          }
          if (contenedor.tipo === "nuevo") {
            const codigo = contenedor.codigo;
            const fechaContenedor = contenedor.fechaEstimadaLlegada;
            if (!codigo || !fechaContenedor) {
              return {
                success: false,
                error: "codigo y fechaEstimadaLlegada son requeridos para el contenedor",
                statusCode: 400,
              };
            }
            const existente = await this.contenedorRepository.findByCodigo(codigo);
            if (existente) {
              return { success: false, error: "codigo de contenedor ya existe", statusCode: 409 };
            }
            const creado = await this.contenedorRepository.create({
              codigo,
              fechaEstimadaLlegada: fechaContenedor,
            });
            contenedorIdForItem = creado._id;
          }
          if (contenedor.tipo === "sin") {
            contenedorIdForItem = null;
            fechaEstimadaDeLlegada = item.fechaEstimadaLlegada || null;
          }
        }

        const loteActual = await this.loteService.findLotes(
          { _id: item.loteId },
          { populate: [{ path: "pedido", select: "_id" }] }
        );
        const lote = loteActual?.data?.[0];
        if (!lote) {
          return { success: false, error: "Lote no encontrado", statusCode: 404 };
        }
        const lotePedidoId = this._toIdString(lote?.pedido);
        const pedidoIdStr = this._toIdString(pedidoId);
        if (lotePedidoId !== pedidoIdStr) {
          console.log("[pedidoService] Lote no pertenece al pedido", {
            pedidoId: pedidoIdStr,
            loteId: item.loteId,
            lotePedidoId,
          });
          return { success: false, error: "Lote no pertenece al pedido", statusCode: 400 };
        }

        const loteResult = await this.loteService.updateLoteDetalles(item.loteId, {
          cantidad: item.cantidad,
          contenedor: contenedorIdForItem,
          fechaEstimadaDeLlegada,
        });
        if (!loteResult.success) {
          return { success: false, error: loteResult.error, statusCode: loteResult.statusCode || 500 };
        }
        updated.push(loteResult.data);
      }

      const removed = [];
      for (const loteId of eliminar) {
        const loteActual = await this.loteService.findLotes({ _id: loteId });
        const lote = loteActual?.data?.[0];
        if (!lote) {
          return { success: false, error: "Lote no encontrado", statusCode: 404 };
        }
        const lotePedidoId = this._toIdString(lote?.pedido);
        const pedidoIdStr = this._toIdString(pedidoId);
        if (lotePedidoId !== pedidoIdStr) {
          return { success: false, error: "Lote no pertenece al pedido", statusCode: 400 };
        }
        const deleted = await this.loteService.deleteLoteAjustandoStock(loteId);
        if (!deleted.success) {
          return { success: false, error: deleted.error, statusCode: deleted.statusCode || 500 };
        }
        removed.push(deleted.data);
      }

      const totalesResult = await this._actualizarTotalesPedidoDesdeLotes(pedidoId);
      if (!totalesResult.success) {
        return { success: false, error: totalesResult.error, statusCode: 500 };
      }

      return {
        success: true,
        data: {
          pedido: totalesResult.data,
          created,
          updated,
          removed,
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
        distribucion = [],
      } = payload;

      if (!numeroPedido) {
        return { success: false, error: "numeroPedido es requerido", statusCode: 400 };
      }

      const distribucionNormalizada = this._normalizeDistribucion(distribucion);

      if (
        (!Array.isArray(productos) || productos.length === 0) &&
        distribucionNormalizada.length === 0
      ) {
        return { success: false, error: "Debe enviar al menos un producto", statusCode: 400 };
      }

      const existingPedido = await this.pedidoRepository.findByNumero(numeroPedido);
      if (existingPedido) {
        return { success: false, error: "El numero de pedido ya existe", statusCode: 409 };
      }

      let contenedorDoc = null;
      let contenedorId = null;

      if (distribucionNormalizada.length === 0 && contenedor) {
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

      const productosTotales = distribucionNormalizada.length > 0
        ? distribucionNormalizada.reduce((acc, item) => {
            const key = item.productoId.toString();
            acc.set(key, (acc.get(key) || 0) + item.cantidad);
            return acc;
          }, new Map())
        : productos.reduce((acc, item) => {
            acc.set(item.productoId, (acc.get(item.productoId) || 0) + item.cantidad);
            return acc;
          }, new Map());

      const pedido = await this.pedidoRepository.create({
        numeroPedido,
        observaciones,
        productos: Array.from(productosTotales.entries()).map(([producto, cantidad]) => ({
          producto,
          cantidad,
        })),
      });

      let lotesData = [];

      if (distribucionNormalizada.length > 0) {
        const contenedoresResult = await this._resolveContenedoresForDistribucion(distribucionNormalizada);
        if (!contenedoresResult.success) {
          return contenedoresResult;
        }

        lotesData = distribucionNormalizada.map((item) => {
          let contenedorIdForItem = null;
          if (item.contenedor?.tipo === "existente") {
            contenedorIdForItem = contenedoresResult.contenedoresPorId.get(item.contenedor.id)?._id || null;
          }
          if (item.contenedor?.tipo === "nuevo") {
            contenedorIdForItem = contenedoresResult.contenedoresPorCodigo.get(item.contenedor.codigo)?._id || null;
          }
          return {
            pedido: pedido._id,
            producto: item.productoId,
            cantidad: item.cantidad,
            contenedor: contenedorIdForItem,
            fechaEstimadaDeLlegada: contenedorIdForItem ? null : item.fechaEstimadaLlegada || fechaEstimadaLlegada,
            estado: "PENDIENTE",
          };
        });
      } else {
        lotesData = productos.map((p) => ({
          pedido: pedido._id,
          producto: p.productoId,
          cantidad: p.cantidad,
          contenedor: contenedorId || null,
          fechaEstimadaDeLlegada: contenedorId ? null : fechaEstimadaLlegada,
          estado: "PENDIENTE",
        }));
      }

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
