const ProductoService = require("../services/productoService");
const productoService = new ProductoService();
const { sendResponse, parsePositiveInt } = require("../Utiles/controllerHelper");


const getSortOptions = (sortField, sortOrder) => {
  const field = sortField || "createdAt";
  const direction = sortOrder === "asc" ? 1 : -1;
  return { [field]: direction };
};


module.exports = {
  getProductos: async (req, res) => {
    try {
      const { limit, offset, sortField, sortOrder } = req.query;

      const parsedLimit = parsePositiveInt(limit, 200);
      const parsedOffset = parsePositiveInt(offset, 0);
      const sort = getSortOptions(sortField, sortOrder);

      const result = await productoService.getAllPaginated({
        limit: parsedLimit,
        offset: parsedOffset,
        sort,
      });
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al obtener los productos",
        details: error.message,
      });
    }
  },
  updateProducto: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await productoService.updateProducto(id, req.body);
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al actualizar el producto",
        details: error.message,
      });
    }
  },
  deleteProducto: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await productoService.deleteProducto(id);
      return sendResponse(res, result, 200);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al eliminar el producto",
        details: error.message,
      });
    }
  },
};