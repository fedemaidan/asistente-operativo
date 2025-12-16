const ContenedorRepository = require("../repository/contenedorRepository");
const LoteService = require("./loteService");
const PedidoService = require("./pedidoService");
const ProyeccionService = require("./proyeccionService");

class ContenedorService {
  constructor() {
    this.contenedorRepository = new ContenedorRepository();
    this.loteService = new LoteService();
    this.pedidoService = new PedidoService();
    this.proyeccionService = new ProyeccionService();
  }

  /**
   * Marca un contenedor como ENTREGADO/PENDIENTE y sincroniza:
   * - Lotes del contenedor (recibido=true/false)
   * - Stock proyectado (por transiciones reales)
   * - Estado de pedidos afectados
   */
  async setEstadoContenedor(contenedorId, estado) {
    try {
      if (!contenedorId) {
        return { success: false, error: "contenedorId es requerido", statusCode: 400 };
      }
      if (!estado || !["PENDIENTE", "ENTREGADO", "CANCELADO"].includes(estado)) {
        return { success: false, error: "estado inválido", statusCode: 400 };
      }

      const contenedor = await this.contenedorRepository.findById(contenedorId);
      if (!contenedor) {
        return { success: false, error: "Contenedor no encontrado", statusCode: 404 };
      }

      const esNoPendiente = estado === "ENTREGADO" || estado === "CANCELADO";

      const lotesResult = await this.loteService.setEstadoPorContenedor(
        contenedorId,
        esNoPendiente ? estado : "PENDIENTE"
      );
      if (!lotesResult.success) {
        return { success: false, error: lotesResult.error, statusCode: lotesResult.statusCode || 500 };
      }

      const totalResult = await this.loteService.countLotesPorContenedor(contenedorId);
      if (!totalResult.success) {
        return { success: false, error: totalResult.error, statusCode: totalResult.statusCode || 500 };
      }

      // Recalcular estado real del contenedor según lotes pendientes
      const pendientesResult = await this.loteService.countPendientesPorContenedor(contenedorId);
      if (!pendientesResult.success) {
        return { success: false, error: pendientesResult.error, statusCode: pendientesResult.statusCode || 500 };
      }

      const total = totalResult.data || 0;
      const pendientes = pendientesResult.data || 0;
      // Estado derivado: si no hay lotes, PENDIENTE
      const estadoDerivado = total > 0 && pendientes === 0 ? "ENTREGADO" : "PENDIENTE";

      return {
        success: true,
        data: {
          ...contenedor.toObject(),
          estado: estadoDerivado,
        },
        meta: {
          pedidosAfectados: (lotesResult.meta?.pedidoIds || []).length,
          lotesCambiados: lotesResult.meta?.changedCount || 0,
          estadoDerivado,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAllPaginated(options = {}) {
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

  async createContenedor(data = {}) {
    try {
      const { codigo, fechaEstimadaLlegada } = data;

      if (!codigo) {
        return {
          success: false,
          error: "codigo es requerido",
          statusCode: 400,
        };
      }

      if (!fechaEstimadaLlegada) {
        return {
          success: false,
          error: "fechaEstimadaLlegada es requerida",
          statusCode: 400,
        };
      }

      const existente = await this.contenedorRepository.findByCodigo(codigo);
      if (existente) {
        return {
          success: false,
          error: "codigo ya existe",
          statusCode: 409,
        };
      }

      const created = await this.contenedorRepository.create({
        codigo,
        fechaEstimadaLlegada,
      });

      return { success: true, data: created };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateContenedor(id, data = {}) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del contenedor es requerido",
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

      if (data.codigo) {
        const existente = await this.contenedorRepository.findByCodigo(
          data.codigo
        );
        if (existente && existente._id.toString() !== id.toString()) {
          return {
            success: false,
            error: "codigo ya existe",
            statusCode: 409,
          };
        }
      }

      const updated = await this.contenedorRepository.updateById(id, data, {
        new: true,
      });

      if (!updated) {
        return {
          success: false,
          error: "Contenedor no encontrado",
          statusCode: 404,
        };
      }

      const recalculo = await this.proyeccionService.recalcularDesdeUltimoContexto();
      if (!recalculo?.success && recalculo?.statusCode !== 409) {
        throw new Error(recalculo?.error || "Error al recalcular proyección");
      }
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteContenedor(id) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del contenedor es requerido",
          statusCode: 400,
        };
      }

      const deleted = await this.contenedorRepository.deleteById(id);

      if (!deleted) {
        return {
          success: false,
          error: "Contenedor no encontrado",
          statusCode: 404,
        };
      }

      const recalculo = await this.proyeccionService.recalcularDesdeUltimoContexto();
      if (!recalculo?.success && recalculo?.statusCode !== 409) {
        throw new Error(recalculo?.error || "Error al recalcular proyección");
      }
      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ContenedorService;
