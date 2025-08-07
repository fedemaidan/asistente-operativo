const express = require("express");
const movimientoController = require("../controllers/movimientoController");

const router = express.Router();

router.post("/", async (req, res) => {
  const { movimiento, montoEnviado } = req.body;

  try {
    const result = await movimientoController.createMovimiento(
      movimiento,
      montoEnviado
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await movimientoController.updateMovimiento(id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { populate } = req.query;
    const result = await movimientoController.getAll({}, populate || "");
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { populate } = req.query;
    const result = await movimientoController.getById(id, populate || "");
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/cliente/:clienteId", async (req, res) => {
  try {
    const { clienteId } = req.params;
    const result = await movimientoController.getByCliente(clienteId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/movimientos/tipo/:type - Obtener movimientos por tipo
router.get("/tipo/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const result = await movimientoController.getByType(type);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/movimientos/fecha/:fechaInicio/:fechaFin - Obtener movimientos por rango de fechas
router.get("/fecha/:fechaInicio/:fechaFin", async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.params;
    const result = await movimientoController.getByFechaRange(
      fechaInicio,
      fechaFin
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/movimientos/estadisticas - Obtener estadísticas de movimientos
router.get("/estadisticas", async (req, res) => {
  try {
    const result = await movimientoController.getEstadisticas();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /api/movimientos/:id - Eliminar un movimiento
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await movimientoController.delete(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
