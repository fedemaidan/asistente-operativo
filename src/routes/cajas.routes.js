const express = require("express");
const cajaController = require("../controllers/cajaController");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await cajaController.getAll();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener las cajas",
      message: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  const { nombre } = req.body;
  try {
    const result = await cajaController.createCaja({ nombre });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al crear la caja",
      message: error.message,
    });
  }
});

module.exports = router;
