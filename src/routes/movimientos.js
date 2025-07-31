const express = require("express");
const movimientoController = require("../controllers/movimientoController");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const result = await movimientoController.createMovimiento(req.body);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: "Movimiento creado exitosamente",
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// PUT /api/movimientos/:id - Actualizar un movimiento existente
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await movimientoController.updateMovimiento(id, req.body);

    if (result.success) {
      res.json({
        success: true,
        message: "Movimiento actualizado exitosamente",
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/movimientos - Obtener todos los movimientos
router.get("/", async (req, res) => {
  try {
    const { populate = "cliente,caja" } = req.query;
    const result = await movimientoController.getAll({}, populate);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/movimientos/:id - Obtener un movimiento por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { populate = "cliente,caja" } = req.query;
    const result = await movimientoController.getById(id, populate);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/movimientos/cliente/:clienteId - Obtener movimientos por cliente
router.get("/cliente/:clienteId", async (req, res) => {
  try {
    const { clienteId } = req.params;
    const result = await movimientoController.getByCliente(clienteId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/movimientos/caja/:cajaId - Obtener movimientos por caja
router.get("/caja/:cajaId", async (req, res) => {
  try {
    const { cajaId } = req.params;
    const result = await movimientoController.getByCaja(cajaId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/movimientos/tipo/:type - Obtener movimientos por tipo
router.get("/tipo/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const result = await movimientoController.getByType(type);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
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

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/movimientos/estadisticas - Obtener estadísticas de movimientos
router.get("/estadisticas", async (req, res) => {
  try {
    const result = await movimientoController.getEstadisticas();

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// DELETE /api/movimientos/:id - Eliminar un movimiento
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await movimientoController.delete(id);

    if (result.success) {
      res.json({
        success: true,
        message: "Movimiento eliminado exitosamente",
        data: result.data,
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

module.exports = router;
