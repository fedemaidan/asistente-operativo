const LoteRepository = require("../repository/loteRepository");

class LoteService {
  constructor() {
    this.loteRepository = new LoteRepository();
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
        recibido = false,
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

      const created = await this.loteRepository.create({
        pedido,
        producto,
        cantidad,
        contenedor: contenedor || null,
        fechaEstimadaDeLlegada: contenedor ? null : fechaEstimadaDeLlegada,
        recibido: Boolean(recibido),
      });

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

      const created = await this.loteRepository.createMany(lotes);
      return { success: true, data: created };
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

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = LoteService;
