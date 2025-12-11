const express = require("express");
const { createPedido, getPedidos, getPedidosResumen } = require("../controllers/pedidoController");

const router = express.Router();

router.get("/", getPedidos);
router.get("/resumen", getPedidosResumen);
router.post("/", createPedido);

module.exports = router;
