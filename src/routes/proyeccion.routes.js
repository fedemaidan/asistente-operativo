const express = require("express");
const multer = require("multer");
const proyeccionController = require("../controllers/proyeccionController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/metadata", proyeccionController.getProyeccionesMetadata);

router.post(
  "/",
  upload.fields([
    { name: "ventas", maxCount: 1 },
    { name: "stock", maxCount: 1 },
    { name: "quiebre", maxCount: 1 },
  ]),
  proyeccionController.createProyeccion
);

module.exports = router;
