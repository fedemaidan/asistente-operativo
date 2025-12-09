const ProductoRepository = require("../repository/productoRepository");

class ProductoService {
  constructor() {
    this.productoRepository = new ProductoRepository();
  }

  async getAllPaginated(options = {}) {
    try {
      const {
        limit = 200,
        offset = 0,
        sort = { createdAt: -1 },
      } = options;

      const result = await this.productoRepository.getPaginated({
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

  async updateProducto(id, data = {}) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del producto es requerido",
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

      const updated = await this.productoRepository.updateProducto(id, data);

      if (!updated) {
        return {
          success: false,
          error: "Producto no encontrado",
          statusCode: 404,
        };
      }

      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteProducto(id) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del producto es requerido",
          statusCode: 400,
        };
      }

      const deleted = await this.productoRepository.softDeleteProducto(id);

      if (!deleted) {
        return {
          success: false,
          error: "Producto no encontrado",
          statusCode: 404,
        };
      }

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ProductoService;