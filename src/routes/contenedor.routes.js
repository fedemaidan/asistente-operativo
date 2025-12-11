const express = require("express");
const { getContenedores } = require("../controllers/contenedorController");

const router = express.Router();

router.get("/", getContenedores);

module.exports = router;
