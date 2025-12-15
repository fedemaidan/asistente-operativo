const express = require("express");
const {
  getAll,
  upsertByCodigos,
  deleteById,
} = require("../controllers/productoIgnorarController");

const router = express.Router();

router.get("/", getAll);
router.post("/", upsertByCodigos);
router.delete("/:id", deleteById);

module.exports = router;

