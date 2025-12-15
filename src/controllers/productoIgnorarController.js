const ProductoIgnorarService = require("../services/productoIgnorarService");
const { sendResponse } = require("../Utiles/controllerHelper");

const productoIgnorarService = new ProductoIgnorarService();

module.exports = {
  getAll: async (_req, res) => {
    try {
      const data = await productoIgnorarService.getAll();
      return sendResponse(res, { success: true, data });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al obtener productos ignorados",
        details: error.message,
      });
    }
  },

  upsertByCodigos: async (req, res) => {
    try {
      const { codigos } = req.body;
      const result = await productoIgnorarService.upsertByCodigos(codigos);
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al guardar productos ignorados",
        details: error.message,
      });
    }
  },

  deleteById: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await productoIgnorarService.deleteById(id);
      return sendResponse(res, result, 200);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al eliminar producto ignorado",
        details: error.message,
      });
    }
  },
};

