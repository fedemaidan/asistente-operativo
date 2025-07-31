const express = require("express");
const movimientosRouter = require("./movimientos");

const router = express.Router();

router.use("/movimientos", movimientosRouter);

module.exports = router;
