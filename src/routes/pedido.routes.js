const express = require("express");
const {
  createPedido,
  getPedidos,
  getPedidosResumen,
  asociarContenedorExistente,
  setEstadoPedido,
  updatePedidoLotes,
} = require("../controllers/pedidoController");

const router = express.Router();

router.get("/", getPedidos);
router.get("/resumen", getPedidosResumen);
router.post("/:pedidoId/asociar-contenedor", asociarContenedorExistente);
router.patch("/:pedidoId/estado", setEstadoPedido);
router.patch("/:pedidoId/lotes", updatePedidoLotes);
router.post("/", createPedido);

module.exports = router;
