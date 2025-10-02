const express = require('express');
const tagController = require('../controllers/tagController');
const proyeccionController = require('../controllers/proyeccionController');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await proyeccionController.getTags();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/', async (req, res) => {
  const { id: _id, nombre } = req.body;
  try {
    const result = await tagController.update(_id, { nombre });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/', async (req, res) => {
  const { id: _id } = req.body;
  try {
    const result = await tagController.delete(_id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
