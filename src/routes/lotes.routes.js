const express = require("express");
const { getLotes, getLotesPendientes } = require("../controllers/loteController");

const router = express.Router();

router.get("/", getLotes);
router.get("/pendientes", getLotesPendientes);

module.exports = router;