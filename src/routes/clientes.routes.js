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

router.get("/:id/cuenta-corriente", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      limit = 20,
      offset = 0,
      sortField = "fecha",
      sortDirection = "desc",
      fechaInicio,
      fechaFin,
      includeInactive = false,
    } = req.query;

    const result = await clienteController.getClienteCCById(id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortField,
      sortDirection,
      fechaInicio,
      fechaFin,
      includeInactive: includeInactive === "true",
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener la cuenta corriente del cliente",
      message: error.message,
    });
  }
});

// NUEVO: Cuenta Corriente computada (parseada, ordenada y con saldo)
router.get("/:idCliente/cc", async (req, res) => {
  try {
    const { idCliente } = req.params;
    const {
      sortDirection = "desc",
      fechaInicio,
      fechaFin,
      includeInactive = false,
      group,
    } = req.query;

    const result = await clienteController.getClienteCCComputed(idCliente, {
      sortDirection,
      fechaInicio,
      fechaFin,
      includeInactive: includeInactive === "true" || includeInactive === true,
      group,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener la CC computada del cliente",
      message: error.message,
    });
  }
});

router.get("/:id/logs", async (req, res) => {
  try {
    const result = await clienteController.getLogs(req.params.id);
    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener los logs del cliente",
      message: error.message,
    });
  }
});

router.get("/nombre/:nombre", async (req, res) => {
  try {
    const result = await clienteController.getByNombre(req.params.nombre);
    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener el cliente por nombre",
      message: error.message,
    });
  }
});

router.get("/cuenta/:cuenta", async (req, res) => {
  try {
    const result = await clienteController.getByCuentaActiva(req.params.cuenta);
    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener clientes por cuenta activa",
      message: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  const { nombre, descuento, ccActivas, usuario } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "El nombre es requerido" });
  }

  if (!usuario) {
    return res.status(400).json({ error: "El usuario es requerido" });
  }

  try {
    const cliente = await clienteController.createCliente({
      nombre,
      descuento,
      ccActivas,
      usuario,
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

router.put("/:id", async (req, res) => {
  const { nombre, descuento, ccActivas, usuario } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "El nombre es requerido" });
  }

  if (!usuario) {
    return res.status(400).json({ error: "El usuario es requerido" });
  }

  try {
    const cliente = await clienteController.updateCliente(req.params.id, {
      nombre,
      descuento,
      ccActivas,
      usuario, // Se usa solo para los logs, no se actualiza en el cliente
    });

    if (!cliente.success) {
      return res.status(400).json({ error: cliente.error });
    }

    return res.json(cliente);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al actualizar el cliente",
      message: error.message,
    });
  }
});

router.patch("/:id/cuentas", async (req, res) => {
  const { ccActivas, usuario } = req.body;

  if (!ccActivas || !Array.isArray(ccActivas)) {
    return res.status(400).json({ error: "ccActivas debe ser un array" });
  }

  if (!usuario) {
    return res.status(400).json({ error: "El usuario es requerido" });
  }

  try {
    const cliente = await clienteController.updateCuentasActivas(
      req.params.id,
      ccActivas,
      usuario
    );

    if (!cliente.success) {
      return res.status(400).json({ error: cliente.error });
    }

    return res.json(cliente);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al actualizar las cuentas activas",
      message: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await clienteController.delete(req.params.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al eliminar el cliente",
      message: error.message,
    });
  }
});

router.get("/cc/:id", async (req, res) => {
  try {
    const result = await clienteController.getClienteMovimientosCC(
      req.params.id
    );
  } catch (error) {
    console.log("error", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener la cuenta corriente del cliente",
      message: error.message,
    });
  }
});

module.exports = router;
