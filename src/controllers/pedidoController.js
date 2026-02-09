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

const parseDistribucion = (distribucion = []) => {
  if (!Array.isArray(distribucion)) return [];
  return distribucion
    .filter((item) => item && item.productoId && item.cantidad)
    .map((item) => ({
      productoId: item.productoId,
      cantidad: Number(item.cantidad) || 0,
      contenedor: item.contenedor || null,
      fechaEstimadaLlegada: item.fechaEstimadaLlegada || null,
    }))
    .filter((item) => item.cantidad > 0);
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
  asociarContenedorExistente: async (req, res) => {
    try {
      const { pedidoId } = req.params;
      const { contenedorId } = req.body;

      const result = await pedidoService.asociarContenedorExistente(
        pedidoId,
        contenedorId
      );

      return sendResponse(res, result, result?.statusCode || 200);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al asociar contenedor al pedido",
        details: error.message,
      });
    }
  },
  getPedidosResumen: async (req, res) => {
    try {
      const { limit, offset, sortField, sortOrder } = req.query;
      const rawSearch = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const rawEstado = typeof req.query.estado === "string" ? req.query.estado.trim().toUpperCase() : "";
      const parsedLimit = parsePositiveInt(limit, 200);
      const parsedOffset = parsePositiveInt(offset, 0);
      const sort = { [sortField || "createdAt"]: sortOrder === "asc" ? 1 : -1 };

      const result = await pedidoService.getPedidosResumen({
        limit: parsedLimit,
        offset: parsedOffset,
        sort,
        search: rawSearch,
        estado: rawEstado,
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
        distribucion,
      } = req.body;

      const parsedProductos = parseProductos(productos);
      const parsedDistribucion = parseDistribucion(distribucion);

      const result = await pedidoService.createPedidoConLotes({
        numeroPedido,
        observaciones,
        fechaEstimadaLlegada,
        productos: parsedProductos,
        contenedor,
        distribucion: parsedDistribucion,
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
  setEstadoPedido: async (req, res) => {
    try {
      const { pedidoId } = req.params;
      const { estado } = req.body;

      const result = await pedidoService.setEstadoPedido(pedidoId, estado);
      return sendResponse(res, result, result?.statusCode || 200);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al actualizar estado del pedido",
        details: error.message,
      });
    }
  },
  updatePedidoLotes: async (req, res) => {
    try {
      const { pedidoId } = req.params;
      const { create, update, remove } = req.body;

      const parsedCreate = parseDistribucion(create);
      const parsedUpdate = Array.isArray(update) ? update : [];
      const parsedRemove = Array.isArray(remove) ? remove : [];

      const result = await pedidoService.updatePedidoLotes(pedidoId, {
        create: parsedCreate,
        update: parsedUpdate,
        remove: parsedRemove,
      });

      return sendResponse(res, result, result?.statusCode || 200);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Error al actualizar lotes del pedido",
        details: error.message,
      });
    }
  },
};
