const express = require("express");
const proyeccionController = require("../controllers/proyeccionController");
const stockProyeccionController = require("../controllers/stockProyeccionController");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await proyeccionController.getAll();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
    console.error(error);
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await stockProyeccionController.getStockPorProyeccionId(id);
    res.json({ data: result, success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
