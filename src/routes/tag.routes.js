const express = require("express");
const tagController = require("../controllers/tagController");
const proyeccionController = require("../controllers/proyeccionController");
const Tag = require("../models/tag.model");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await proyeccionController.getTags();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/nombres", async (req, res) => {
  try {
    const tags = await Tag.find({}, { nombre: 1 }).lean();
    const nombres = tags
      .map((t) => t.nombre)
      .filter(Boolean)
      .sort();
    res.json({ success: true, data: ["Sin Tag", ...nombres] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/", async (req, res) => {
  const { id: _id, nombre } = req.body;
  try {
    const result = await tagController.update(_id, { nombre });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/", async (req, res) => {
  const { id: _id } = req.body;
  try {
    const result = await tagController.delete(_id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
