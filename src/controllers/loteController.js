const LoteService = require("../services/loteService");
const { sendResponse, parsePositiveInt } = require("../Utiles/controllerHelper");

const loteService = new LoteService();

module.exports = {
  /**
   * Devuelve lotes (paginated, genérico). Ya existía LoteService.getAllPaginated.
   */
  getLotes: async (req, res) => {
    try {
      const { limit, offset, sortField, sortOrder } = req.query;

      const parsedLimit = parsePositiveInt(limit, 200);
      const parsedOffset = parsePositiveInt(offset, 0);
      const sort = sortField
        ? { [sortField]: sortOrder === "asc" ? 1 : -1 }
        : { createdAt: -1 };

      const result = await loteService.getAllPaginated({
        limit: parsedLimit,
        offset: parsedOffset,
        sort,
      });

      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al obtener los lotes",
        details: error.message,
      });
    }
  },

  /**
   * Lotes pendientes (no recibidos) con producto y contenedor populados.
   * Endpoint pensado para consumirse desde el front de proyecciones.
   */
  getLotesPendientes: async (req, res) => {
    try {
      const result = await loteService.getLotesPendientesDetalles();
      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al obtener los lotes pendientes",
        details: error.message,
      });
    }
  },
};