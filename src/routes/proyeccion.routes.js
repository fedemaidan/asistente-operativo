const express = require("express");
const multer = require("multer");
const proyeccionController = require("../controllers/proyeccionController");
const stockProyeccionController = require("../controllers/stockProyeccionController");
const productosIgnorarController = require("../controllers/productosIgnorarController");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const {
      populate = "",
      limit = 20,
      offset = 0,
      sortField = "fechaCreacion",
      sortDirection = "desc",
    } = req.query;

    const sort = {};
    if (sortField) {
      sort[sortField] = sortDirection === "asc" ? 1 : -1;
    }

    const options = {
      filter: {},
      populate,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
    };

    const result = await proyeccionController.getAllPaginado(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
    console.error(error);
  }
});

router.get("/ignorar", async (req, res) => {
  try {
    const result = await productosIgnorarController.getAll();
    return res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ignorar", async (req, res) => {
  try {
    console.log("req.body", req.body);
    const { codigos } = req.body;
    const result = await productosIgnorarController.createMany(
      codigos.map((codigo) => {
        return { codigo: codigo.trim() };
      })
    );
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/ignorar", async (req, res) => {
  try {
    const { id } = req.body;
    const result = await productosIgnorarController.delete(id);
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const {
      populate = "",
      limit = 20,
      offset = 0,
      sortField = "codigo",
      sortDirection = "asc",
    } = req.query;

    const sort = {};
    if (sortField) {
      sort[sortField] = sortDirection === "asc" ? 1 : -1;
    }

    const options = {
      filter: { proyeccionId: id },
      populate,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
    };

    const result = await stockProyeccionController.getAllPaginado(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/",
  upload.fields([
    { name: "ventas", maxCount: 1 },
    { name: "stock", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { fechaInicio, fechaFin } = req.body;
      const ventasFile = req.files?.ventas?.[0];
      const stockFile = req.files?.stock?.[0];

      const result = await proyeccionController.createProyeccion({
        fechaInicio,
        fechaFin,
        ventasFile,
        stockFile,
      });

      res.json(result);
    } catch (error) {
      const payload = error?.payload;
      if (payload) {
        return res.status(400).json(payload);
      }
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;
