const PedidoService = require("../services/pedidoService");
const pedidoService = new PedidoService();
const { sendResponse, parsePositiveInt } = require("../Utiles/controllerHelper");

const parseProductos = (productos = []) => {
  if (!Array.isArray(productos)) return [];
  return productos
    .filter((p) => p && p.productoId && p.cantidad)
    .map((p) => ({
      productoId: p.productoId,
      cantidad: Number(p.cantidad) || 0,
    }))
    .filter((p) => p.cantidad > 0);
};


module.exports = {
  getPedidos: async (req, res) => {
    try {
      const { limit, offset, sortField, sortOrder } = req.query;
      const parsedLimit = parsePositiveInt(limit, 200);
      const parsedOffset = parsePositiveInt(offset, 0);
      const sort = { [sortField || "createdAt"]: sortOrder === "asc" ? 1 : -1 };

      const result = await pedidoService.getAllPedidos({
        limit: parsedLimit,
        offset: parsedOffset,
        sort,
      });

      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al obtener los pedidos",
        details: error.message,
      });
    }
  },
  getPedidosResumen: async (req, res) => {
    try {
      const { limit, offset, sortField, sortOrder } = req.query;
      const parsedLimit = parsePositiveInt(limit, 200);
      const parsedOffset = parsePositiveInt(offset, 0);
      const sort = { [sortField || "createdAt"]: sortOrder === "asc" ? 1 : -1 };

      const result = await pedidoService.getPedidosResumen({
        limit: parsedLimit,
        offset: parsedOffset,
        sort,
      });

      return sendResponse(res, result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al obtener el resumen de pedidos",
        details: error.message,
      });
    }
  },
  createPedido: async (req, res) => {
    try {
      const {
        numeroPedido,
        observaciones,
        fechaEstimadaLlegada,
        productos,
        contenedor,
      } = req.body;

      const parsedProductos = parseProductos(productos);

      const result = await pedidoService.createPedidoConLotes({
        numeroPedido,
        observaciones,
        fechaEstimadaLlegada,
        productos: parsedProductos,
        contenedor,
      });

      return sendResponse(res, result, 201);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al crear el pedido",
        details: error.message,
      });
    }
  },
};
