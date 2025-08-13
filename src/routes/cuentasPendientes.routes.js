const express = require("express");
const cuentaPendienteController = require("../controllers/cuentaPendienteController");

const router = express.Router();

// POST /api/cuentas-pendientes - Crear cuenta pendiente
router.post("/", async (req, res) => {
  try {
    const result = await cuentaPendienteController.createCuentaPendiente(
      req.body
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/cuentas-pendientes/:id - Actualizar cuenta pendiente
router.put("/:id", async (req, res) => {
  const { usuario } = req.body;

  if (!usuario) {
    return res
      .status(400)
      .json({ error: "El usuario es requerido para los logs" });
  }

  try {
    const { id } = req.params;
    const result = await cuentaPendienteController.updateCuentaPendiente(
      id,
      req.body
    );
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/cuentas-pendientes - Listar cuentas pendientes
router.get("/", async (req, res) => {
  try {
    const { populate } = req.query;
    const result = await cuentaPendienteController.getAll({}, populate || "");
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/cuentas-pendientes/:id/logs - Obtener logs por ID
router.get("/:id/logs", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cuentaPendienteController.getLogs(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener los logs de la cuenta pendiente",
      message: error.message,
    });
  }
});

// GET /api/cuentas-pendientes/:id - Obtener por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { populate } = req.query;
    const result = await cuentaPendienteController.getById(id, populate || "");
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/cuentas-pendientes/:id - Eliminar
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cuentaPendienteController.delete(id);
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
