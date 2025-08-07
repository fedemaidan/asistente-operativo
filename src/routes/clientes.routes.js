const express = require("express");
const clienteController = require("../controllers/clienteController");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await clienteController.getAll();
    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener los clientes",
      message: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await clienteController.getById(req.params.id);

    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener el cliente",
      message: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  const { nombre, descuento, ccActivas } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "El nombre es requerido" });
  }

  try {
    const cliente = await clienteController.createCliente({
      nombre,
      descuento,
      ccActivas,
    });

    if (!cliente.success) {
      return res.status(400).json({ error: cliente.error });
    }

    return res.json(cliente);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al crear el cliente",
      message: error.message,
    });
  }
});

module.exports = router;
