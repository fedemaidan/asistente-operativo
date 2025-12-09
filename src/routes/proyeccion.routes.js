const express = require("express");
const multer = require("multer");
const proyeccionController = require("../controllers/proyeccionController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/",
  upload.fields([
    { name: "ventas", maxCount: 1 },
    { name: "stock", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { fechaInicio, fechaFin, horizonte } = req.body;
      const ventasFile = req.files?.ventas?.[0];
      const stockFile = req.files?.stock?.[0];

      const result = await proyeccionController.createProyeccion({
        fechaInicio,
        fechaFin,
        ventasFile,
        stockFile,
        horizonte,
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
