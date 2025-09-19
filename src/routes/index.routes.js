const express = require("express");
const movimientosRouter = require("./movimientos.routes.js");
const cajasRouter = require("./cajas.routes.js");
const clientesRouter = require("./clientes.routes.js");
const cuentasPendientesRouter = require("./cuentasPendientes.routes.js");
const mongoose = require("mongoose");
const DolarService = require("../services/monedasService/dolarService.js");
const {
  ejecutarMigracion,
} = require("../Utiles/Funciones/Migracion/migracion.js");
const migrarCuentasPendientesConCliente = require("../Utiles/Funciones/Migracion/migracionCuentasPendientes.js");
const proyeccionRouter = require("./proyeccion.routes.js");
const router = express.Router();

router.use("/movimientos", movimientosRouter);
router.use("/cajas", cajasRouter);
router.use("/clientes", clientesRouter);
router.use("/cuentas-pendientes", cuentasPendientesRouter);
router.use("/proyeccion", proyeccionRouter);
router.get("/dolar", async (req, res) => {
  const dolar = await DolarService.obtenerValoresDolar();
  res.json({
    ultimaActualizacion: dolar.ultima_actualizacion,
    oficial: dolar.oficial.venta,
    blue: dolar.blue.venta,
  });
});

router.delete("/reset-db", async (req, res) => {
  try {
    await mongoose.connection.dropDatabase();
    res.json({ success: true, message: "Base de datos borrada" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/migracion", ejecutarMigracion);
router.post("/migracion/cuentas-pendientes", async (req, res) => {
  const resultado = await migrarCuentasPendientesConCliente();
  res.json({
    success: true,
    message: "🏁 Proceso de migración finalizado",
    cuentasActualizadas: resultado.cuentasActualizadas,
    cuentasSinCliente: resultado.cuentasSinCliente,
    errores: resultado.errores,
    totalCuentas: resultado.total,
  });
});

module.exports = router;
