const ContenedorRepository = require("../repository/contenedorRepository");

class ContenedorService {
  constructor() {
    this.contenedorRepository = new ContenedorRepository();
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

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ContenedorService;
