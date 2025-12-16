const LoteRepository = require("../repository/loteRepository");
const ProductoService = require("./productoService");
const ProyeccionService = require("./proyeccionService");

class LoteService {
  constructor() {
    this.loteRepository = new LoteRepository();
    this.productoService = new ProductoService();
    this.proyeccionService = new ProyeccionService();
  }

  async _recalcularProyeccionCompletaSiExiste() {
    const result = await this.proyeccionService.recalcularDesdeUltimoContexto();
    // Si no hay proyección activa, no cortamos la operación de lotes/pedidos.
    if (!result?.success && result?.statusCode === 409) {
      return { success: false, skipped: true, error: result.error };
    }
    if (!result?.success) {
      throw new Error(result?.error || "Error al recalcular proyección");
    }
    return { success: true, skipped: false, meta: result.meta };
  }

  _toObjectIdString(value) {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value?.toString === "function") return value.toString();
    return null;
  }

  _buildDeltaStockProyectadoPorProducto(lotes = [], factor = 1) {
    const deltaPorProducto = new Map();
    (lotes || []).forEach((lote) => {
      const productoId = this._toObjectIdString(lote?.producto);
      const cantidad = Number(lote?.cantidad || 0);
      if (!productoId) return;
      if (!Number.isFinite(cantidad) || cantidad <= 0) return;

      const delta = cantidad * factor;
      deltaPorProducto.set(productoId, (deltaPorProducto.get(productoId) || 0) + delta);
    });
    return deltaPorProducto;
  }

  async _aplicarDeltaStockProyectado(deltaPorProducto = new Map()) {
    const entries = Array.from(deltaPorProducto.entries()).filter(([, delta]) => delta !== 0);
    if (entries.length === 0) return;

    await Promise.all(
      entries.map(async ([productoId, delta]) => {
        const result = await this.productoService.updateProducto(productoId, {
          $inc: { stockProyectado: delta },
        });
        if (!result?.success) {
          throw new Error(result?.error || "Error al actualizar stockProyectado");
        }
      })
    );
  }

  async getAllPaginated(options = {}) {
    try {
      const {
        limit = 200,
        offset = 0,
        sort = { createdAt: -1 },
        filter = {},
        populate = null,
      } = options;

      const result = await this.loteRepository.findPaginated(filter, {
        limit,
        offset,
        sort,
        populate,
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

  async createLote(data = {}) {
    try {
      const {
        pedido,
        producto,
        cantidad,
        contenedor = null,
        fechaEstimadaDeLlegada = null,
        estado = "PENDIENTE",
      } = data;

      if (!pedido) {
        return {
          success: false,
          error: "pedido es requerido",
          statusCode: 400,
        };
      }

      if (!producto) {
        return {
          success: false,
          error: "producto es requerido",
          statusCode: 400,
        };
      }

      if (!cantidad || Number(cantidad) <= 0) {
        return {
          success: false,
          error: "cantidad debe ser mayor a 0",
          statusCode: 400,
        };
      }

      const isEntregado = estado === "ENTREGADO";

      const created = await this.loteRepository.create({
        pedido,
        producto,
        cantidad,
        contenedor: contenedor || null,
        fechaEstimadaDeLlegada: contenedor ? null : fechaEstimadaDeLlegada,
        estado: isEntregado ? "ENTREGADO" : "PENDIENTE",
        fechaEntrega: isEntregado ? new Date() : null,
      });

      // Al crear lote, el stockProyectado “sube” (proyección de unidades por recibir)
      await this._aplicarDeltaStockProyectado(
        this._buildDeltaStockProyectadoPorProducto([created], +1)
      );
      await this._recalcularProyeccionCompletaSiExiste();
      return { success: true, data: created };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createManyLotes(lotes = []) {
    try {
      if (!Array.isArray(lotes) || lotes.length === 0) {
        return {
          success: false,
          error: "Debe enviar al menos un lote",
          statusCode: 400,
        };
      }

      const normalized = lotes.map((l) => {
        const isEntregado = l.estado === "ENTREGADO" || l.recibido === true;
        return {
          ...l,
          estado: isEntregado ? "ENTREGADO" : "PENDIENTE",
          fechaEntrega: isEntregado ? new Date() : null,
          fechaEstimadaDeLlegada: l.contenedor ? null : l.fechaEstimadaDeLlegada || l.fechaEstimadaDeLlegada,
        };
      });

      const created = await this.loteRepository.createMany(normalized);
      await this._aplicarDeltaStockProyectado(
        this._buildDeltaStockProyectadoPorProducto(created, +1)
      );
      await this._recalcularProyeccionCompletaSiExiste();
      return { success: true, data: created };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cambia el estado de un lote (PENDIENTE/ENTREGADO/CANCELADO).
   * Ajuste stockProyectado solo en transiciones PENDIENTE <-> ENTREGADO.
   */
  async setEstadoLote(loteId, estado) {
    try {
      if (!loteId) {
        return { success: false, error: "loteId es requerido", statusCode: 400 };
      }

      const desired = estado || "PENDIENTE";
      const current = await this.loteRepository.findById(loteId);
      if (!current) {
        return { success: false, error: "Lote no encontrado", statusCode: 404 };
      }

      if (current.estado === desired) {
        return {
          success: true,
          data: current,
          meta: { changed: false, pedidoId: current.pedido, contenedorId: current.contenedor },
        };
      }

      // Update condicional para evitar doble-aplicación en concurrencia
      const updated = await this.loteRepository.updateOne(
        { _id: current._id, estado: current.estado },
        {
          $set: {
            estado: desired,
            fechaEntrega: desired === "ENTREGADO" ? new Date() : null,
          },
        },
        { new: true }
      );

      if (!updated) {
        // Si otro proceso lo cambió, devolvemos el estado actual sin tocar stock.
        const refreshed = await this.loteRepository.findById(loteId);
        return {
          success: true,
          data: refreshed,
          meta: { changed: false, pedidoId: refreshed?.pedido, contenedorId: refreshed?.contenedor },
        };
      }

      let factor = 0;
      const esDestinoNoPendiente = desired === "ENTREGADO" || desired === "CANCELADO";
      const esOrigenNoPendiente = current.estado === "ENTREGADO" || current.estado === "CANCELADO";
      if (current.estado === "PENDIENTE" && esDestinoNoPendiente) factor = -1;
      if (esOrigenNoPendiente && desired === "PENDIENTE") factor = +1;

      await this._aplicarDeltaStockProyectado(
        this._buildDeltaStockProyectadoPorProducto([current], factor)
      );

      await this._recalcularProyeccionCompletaSiExiste();
      return {
        success: true,
        data: updated,
        meta: { changed: true, pedidoId: current.pedido, contenedorId: current.contenedor },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cambia el estado de TODOS los lotes de un contenedor a PENDIENTE/ENTREGADO/CANCELADO.
   * Ajusta stockProyectado SOLO para transiciones PENDIENTE <-> ENTREGADO.
   */
  async setEstadoPorContenedor(contenedorId, estado) {
    try {
      if (!contenedorId) {
        return { success: false, error: "contenedorId es requerido", statusCode: 400 };
      }
      const desired = estado || "PENDIENTE";

      // Traemos candidatos a cambiar (solo los que realmente deberían transicionar)
      const candidates = await this.loteRepository.find(
        { contenedor: contenedorId, estado: { $ne: desired } },
        { select: "pedido producto cantidad estado contenedor" }
      );

      if (!candidates || candidates.length === 0) {
        return {
          success: true,
          data: [],
          meta: { changedCount: 0, pedidoIds: [] },
        };
      }

      const changed = [];
      const pedidoIds = new Set();

      // Actualización segura: una por lote con condición
      for (const lote of candidates) {
        const res = await this.loteRepository.updateOne(
          { _id: lote._id, estado: lote.estado },
          {
            $set: {
              estado: desired,
              fechaEntrega: desired === "ENTREGADO" ? new Date() : null,
            },
          },
          { new: true }
        );
        if (res) {
          changed.push(lote);
          if (lote?.pedido) pedidoIds.add(this._toObjectIdString(lote.pedido));
        }
      }

      let factor = 0;
      const esDestinoNoPendiente = desired === "ENTREGADO" || desired === "CANCELADO";
      const efectivos = changed.filter((l) => l.estado !== desired);
      if (efectivos.length > 0) {
        if (esDestinoNoPendiente) factor = -1;
        else if (desired === "PENDIENTE") factor = +1;
      }

      await this._aplicarDeltaStockProyectado(
        this._buildDeltaStockProyectadoPorProducto(efectivos, factor)
      );

      await this._recalcularProyeccionCompletaSiExiste();
      return {
        success: true,
        data: changed,
        meta: { changedCount: changed.length, pedidoIds: Array.from(pedidoIds) },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setEstadoPorPedido(pedidoId, estado) {
    try {
      if (!pedidoId) {
        return { success: false, error: "pedidoId es requerido", statusCode: 400 };
      }
      const desired = estado || "PENDIENTE";

      const candidates = await this.loteRepository.find(
        { pedido: pedidoId, estado: { $ne: desired } },
        { select: "pedido producto cantidad estado contenedor" }
      );

      if (!candidates || candidates.length === 0) {
        return {
          success: true,
          data: [],
          meta: { changedCount: 0, contenedorIds: [] },
        };
      }

      const changed = [];
      const contenedorIds = new Set();

      for (const lote of candidates) {
        const res = await this.loteRepository.updateOne(
          { _id: lote._id, estado: lote.estado },
          {
            $set: {
              estado: desired,
              fechaEntrega: desired === "ENTREGADO" ? new Date() : null,
            },
          },
          { new: true }
        );
        if (res) {
          changed.push(lote);
          if (lote?.contenedor) contenedorIds.add(this._toObjectIdString(lote.contenedor));
        }
      }

      let factor = 0;
      const esDestinoNoPendiente = desired === "ENTREGADO" || desired === "CANCELADO";
      const efectivos = changed.filter((l) => l.estado !== desired);
      if (efectivos.length > 0) {
        if (esDestinoNoPendiente) factor = -1;
        else if (desired === "PENDIENTE") factor = +1;
      }

      await this._aplicarDeltaStockProyectado(
        this._buildDeltaStockProyectadoPorProducto(efectivos, factor)
      );

      await this._recalcularProyeccionCompletaSiExiste();
      return {
        success: true,
        data: changed,
        meta: { changedCount: changed.length, contenedorIds: Array.from(contenedorIds) },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async countPendientesPorPedido(pedidoId) {
    try {
      if (!pedidoId) return { success: false, error: "pedidoId es requerido", statusCode: 400 };
      const count = await this.loteRepository.count({ pedido: pedidoId, estado: "PENDIENTE" });
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async countLotesPorPedido(pedidoId) {
    try {
      if (!pedidoId) return { success: false, error: "pedidoId es requerido", statusCode: 400 };
      const count = await this.loteRepository.count({ pedido: pedidoId });
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async countPendientesPorContenedor(contenedorId) {
    try {
      if (!contenedorId) {
        return { success: false, error: "contenedorId es requerido", statusCode: 400 };
      }
      const count = await this.loteRepository.count({ contenedor: contenedorId, estado: "PENDIENTE" });
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async countLotesPorContenedor(contenedorId) {
    try {
      if (!contenedorId) {
        return { success: false, error: "contenedorId es requerido", statusCode: 400 };
      }
      const count = await this.loteRepository.count({ contenedor: contenedorId });
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async findLotes(filter = {}, options = {}) {
    try {
      const lotes = await this.loteRepository.find(filter, options);
      return { success: true, data: lotes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async findPendientesByProducto(productIds = []) {
    try {
      const lotes = await this.loteRepository.findPendientesByProducto(productIds);
      return { success: true, data: lotes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateLote(id, data = {}) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del lote es requerido",
          statusCode: 400,
        };
      }

      if (Object.keys(data).length === 0) {
        return {
          success: false,
          error: "No hay campos válidos para actualizar",
          statusCode: 400,
        };
      }

      const updated = await this.loteRepository.updateById(id, data, {
        new: true,
      });

      if (!updated) {
        return {
          success: false,
          error: "Lote no encontrado",
          statusCode: 404,
        };
      }

      await this._recalcularProyeccionCompletaSiExiste();
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteLote(id) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del lote es requerido",
          statusCode: 400,
        };
      }

      const deleted = await this.loteRepository.deleteById(id);

      if (!deleted) {
        return {
          success: false,
          error: "Lote no encontrado",
          statusCode: 404,
        };
      }

      await this._recalcularProyeccionCompletaSiExiste();
      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLotesPendientesDetalles() {
    try {
      const lotes = await this.loteRepository.findPendientes({
        productIds: [],
        populate: [
          { path: "producto", select: "codigo nombre" },
          { path: "contenedor", select: "codigo fechaEstimadaLlegada" },
        ],
      });

      return { success: true, data: lotes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = LoteService;
