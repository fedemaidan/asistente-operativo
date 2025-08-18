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
  const { nombreUsuario } = req.body;

  console.log("req.body", req.body);

  if (!nombreUsuario) {
    return res
      .status(400)
      .json({ error: "El nombreUsuario es requerido para los logs" });
  }

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
    const { populate, type, limit = 20, offset = 0, sortField = "fechaFactura", sortDirection = "desc" } = req.query;

    const filters = {};
    if (type) filters.type = type;

    const sort = {};
    if (sortField) {
      sort[sortField] = sortDirection === "asc" ? 1 : -1;
    }

    const options = {
      filter: filters,
      populate,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort
    };

    const result = await movimientoController.getAllPaginado(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


router.get("/clientes-totales", async (req, res) => {
  try {
    const result = await movimientoController.getClientesTotales();
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

router.get("/:id/logs", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await movimientoController.getLogs(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener los logs del movimiento",
      message: error.message,
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
