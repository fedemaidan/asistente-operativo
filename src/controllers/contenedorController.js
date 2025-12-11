const PedidoService = require("../services/pedidoService");
const { sendResponse, parsePositiveInt } = require("../Utiles/controllerHelper");
const pedidoService = new PedidoService();


module.exports = {
  getContenedores: async (req, res) => {
    try {
      const { limit, offset, sortField, sortOrder } = req.query;
      const parsedLimit = parsePositiveInt(limit, 200);
      const parsedOffset = parsePositiveInt(offset, 0);
      const sort = { [sortField || "createdAt"]: sortOrder === "asc" ? 1 : -1 };

      const result = await pedidoService.getAllContenedores({
        limit: parsedLimit,
        offset: parsedOffset,
        sort,
      });

      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al obtener los contenedores",
        details: error.message,
      });
    }
  },
};
