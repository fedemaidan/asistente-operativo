const ProductoService = require("../services/productoService");
const productoService = new ProductoService();
const { sendResponse, parsePositiveInt, parseStrictPositiveInt } = require("../Utiles/controllerHelper");


const getSortOptions = (sortField, sortOrder) => {
  const field = sortField || "createdAt";
  const direction = sortOrder === "asc" ? 1 : -1;
  return { [field]: direction };
};


module.exports = {
  getProductos: async (req, res) => {
    try {
      const { limit, offset, sortField, sortOrder, page, pageSize, all, text, includeIgnored } = req.query;

      const sort = getSortOptions(sortField, sortOrder);
      const safeText = typeof text === "string" ? text.trim() : "";
      const safeIncludeIgnored = String(includeIgnored).toLowerCase() === "true";

      if (String(all).toLowerCase() === "true") {
        const result = await productoService.getAll({
          sort,
          text: safeText,
          includeIgnored: safeIncludeIgnored,
        });
        return sendResponse(res, result);
      }

      const shouldUsePage = page !== undefined || pageSize !== undefined;
      const parsedLimit = shouldUsePage
        ? parseStrictPositiveInt(pageSize, 200)
        : parseStrictPositiveInt(limit, 200);
      const parsedPage = parseStrictPositiveInt(page, 1);
      const parsedOffset = shouldUsePage
        ? (parsedPage - 1) * parsedLimit
        : parsePositiveInt(offset, 0);

      const result = await productoService.getAllPaginated({
        limit: parsedLimit,
        offset: parsedOffset,
        sort,
        page: shouldUsePage ? parsedPage : undefined,
        text: safeText,
        includeIgnored: safeIncludeIgnored,
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

  getTags: async (_req, res) => {
    try {
      const result = await productoService.getTagsResumen();
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al obtener los tags",
        details: error.message,
      });
    }
  },

  updateTag: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre } = req.body;
      const result = await productoService.actualizarTag(id, nombre);
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al actualizar el tag",
        details: error.message,
      });
    }
  },

  deleteTag: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await productoService.eliminarTag(id);
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al eliminar el tag",
        details: error.message,
      });
    }
  },

  eliminarTagsDeProductos: async (req, res) => {
    try {
      const { productoIds } = req.body;
      const result = await productoService.eliminarTagsDeProductos(productoIds);
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al eliminar tags de productos",
        details: error.message,
      });
    }
  },

  agregarTagAProductos: async (req, res) => {
    try {
      const { productoIds, tagNombre } = req.body;
      const result = await productoService.agregarTagAProductos(productoIds, tagNombre);
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al agregar tag a productos",
        details: error.message,
      });
    }
  },

  addNotaProducto: async (req, res) => {
    try {
      const { id } = req.params;
      const { nota } = req.body;
      const result = await productoService.agregarNotaProducto(id, nota);
      return sendResponse(res, result, 201);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al agregar nota al producto",
        details: error.message,
      });
    }
  },

  updateNotaProducto: async (req, res) => {
    try {
      const { id, notaId } = req.params;
      const { nota } = req.body;
      const result = await productoService.actualizarNotaProducto(id, notaId, nota);
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al actualizar nota del producto",
        details: error.message,
      });
    }
  },

  deleteNotaProducto: async (req, res) => {
    try {
      const { id, notaId } = req.params;
      const result = await productoService.eliminarNotaProducto(id, notaId);
      return sendResponse(res, result, 200);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al eliminar nota del producto",
        details: error.message,
      });
    }
  },
};