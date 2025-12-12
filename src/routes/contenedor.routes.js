const express = require("express");
const { getContenedores, setEstadoContenedor } = require("../controllers/contenedorController");

const router = express.Router();

router.get("/", getContenedores);
router.patch("/:contenedorId/estado", setEstadoContenedor);

module.exports = router;
