const ProductoIgnorarRepository = require('../repository/productoIgnorarRepository');

class ProductoIgnorarService {
  constructor() {
    this.productoIgnorarRepository = new ProductoIgnorarRepository();
  }

  async getAll() {
    return this.productoIgnorarRepository.find();
  }

  async upsertByCodigos(codigos = []) {
    if (!Array.isArray(codigos) || codigos.length === 0) {
      return {
        success: false,
        error: "codigos es requerido",
        statusCode: 400,
      };
    }

    try {
      const summary = await this.productoIgnorarRepository.upsertManyByCodigos(codigos);
      const data = await this.getAll();
      return { success: true, data, meta: summary };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteById(id) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID es requerido",
          statusCode: 400,
        };
      }

      const deleted = await this.productoIgnorarRepository.deleteById(id);
      if (!deleted) {
        return {
          success: false,
          error: "Registro no encontrado",
          statusCode: 404,
        };
      }

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ProductoIgnorarService;