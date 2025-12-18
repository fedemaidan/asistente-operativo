const express = require("express");
const {
  getProductos,
  updateProducto,
  deleteProducto,
  getTags,
  updateTag,
  deleteTag,
  eliminarTagsDeProductos,
  agregarTagAProductos,
  addNotaProducto,
  updateNotaProducto,
  deleteNotaProducto,
} = require("../controllers/productoController");

const router = express.Router();

router.get("/", getProductos);

router.get("/tags", getTags);
router.put("/tags/:id", updateTag);
router.delete("/tags/:id", deleteTag);
router.post("/eliminar-tags", eliminarTagsDeProductos);
router.post("/tags/asignar", agregarTagAProductos);

router.post("/:id/notas", addNotaProducto);
router.put("/:id/notas/:notaId", updateNotaProducto);
router.delete("/:id/notas/:notaId", deleteNotaProducto);

router.put("/:id", updateProducto);
router.delete("/:id", deleteProducto);

module.exports = router;