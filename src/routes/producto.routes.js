const express = require("express");
const {
  getProductos,
  updateProducto,
  deleteProducto,
} = require("../controllers/productoController");

const router = express.Router();

router.get("/", getProductos);
router.put("/:id", updateProducto);
router.delete("/:id", deleteProducto);

module.exports = router;