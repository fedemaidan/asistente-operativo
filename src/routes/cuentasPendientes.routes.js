const express = require("express");
const cuentaPendienteController = require("../controllers/cuentaPendienteController");

const router = express.Router();

// POST /api/cuentas-pendientes - Crear cuenta pendiente
router.post("/", async (req, res) => {
  try {
    const result = await cuentaPendienteController.createCuentaPendiente(
      req.body
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/cuentas-pendientes/:id - Actualizar cuenta pendiente
router.put("/:id", async (req, res) => {
  const { usuario } = req.body;

  if (!usuario) {
    return res
      .status(400)
      .json({ error: "El usuario es requerido para los logs" });
  }

  try {
    const { id } = req.params;
    const result = await cuentaPendienteController.updateCuentaPendiente(
      id,
      req.body
    );
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/:id/signo", async (req, res) => {
  const { id } = req.params;
  const result = await cuentaPendienteController.updateSigno(id);
  return res.json(result);
});

// PUT /api/cuentas-pendientes/:id/delete - Eliminación lógica
router.put("/:id/delete", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario } = req.body;

    if (!usuario) {
      return res
        .status(400)
        .json({ error: "El usuario es requerido para los logs" });
    }

    const result = await cuentaPendienteController.deleteCuentaPendiente(
      id,
      usuario
    );
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/cuentas-pendientes - Listar cuentas pendientes
router.get("/", async (req, res) => {
  try {
    const {
      populate,
      limit = 20,
      offset = 0,
      sortField = "fechaCuenta",
      sortDirection = "desc",
      nombreCliente,
      fechaInicio,
      fechaFin,
      moneda,
      cc,
      text,
      usuario,
      includeInactive = false,
      descuentoMayorQue,
      descuentoMenorQue,
      montoDesde,
      montoHasta,
      montoTipo, // 'cc' | 'enviado'
    } = req.query;

    console.log("req.query", req.query);
    const isNumberSearch =
      text && String(text).trim().length > 0 && !isNaN(Number(text));

    const filters = {};
    if (nombreCliente) {
      filters.proveedorOCliente = {
        $regex: nombreCliente,
        $options: "i", // case insensitive
      };
    }
    if (moneda) {
      filters.moneda = moneda.toUpperCase();
    }
    if (cc) {
      filters.cc = cc.toUpperCase();
    }

    if (usuario) {
      filters.usuario = usuario;
    }

    // Filtro por monto (montoDesde/montoHasta) según tipo (cc|enviado)
    const hasMontoDesde =
      montoDesde !== undefined && montoDesde !== null && String(montoDesde).trim() !== "";
    const hasMontoHasta =
      montoHasta !== undefined && montoHasta !== null && String(montoHasta).trim() !== "";
    if (hasMontoDesde || hasMontoHasta) {
      const minVal = hasMontoDesde ? Number(montoDesde) : null;
      const maxVal = hasMontoHasta ? Number(montoHasta) : null;
      const exprField =
        montoTipo === "cc"
          ? {
              $switch: {
                branches: [
                  { case: { $eq: ["$cc", "ARS"] }, then: "$montoTotal.ars" },
                  { case: { $eq: ["$cc", "USD BLUE"] }, then: "$montoTotal.usdBlue" },
                  { case: { $eq: ["$cc", "USD OFICIAL"] }, then: "$montoTotal.usdOficial" },
                ],
                default: 0,
              },
            }
          : {
              // monto enviado sobre subTotal
              $switch: {
                branches: [
                  { case: { $eq: ["$moneda", "ARS"] }, then: "$subTotal.ars" },
                  {
                    case: {
                      $and: [{ $eq: ["$moneda", "USD"] }, { $eq: ["$cc", "USD BLUE"] }],
                    },
                    then: "$subTotal.usdBlue",
                  },
                  {
                    case: {
                      $and: [{ $eq: ["$moneda", "USD"] }, { $eq: ["$cc", "USD OFICIAL"] }],
                    },
                    then: "$subTotal.usdOficial",
                  },
                  {
                    // Caso moneda USD y CC ARS: usar usdBlue por consistencia
                    case: {
                      $and: [{ $eq: ["$moneda", "USD"] }, { $eq: ["$cc", "ARS"] }],
                    },
                    then: "$subTotal.usdBlue",
                  },
                ],
                default: 0,
              },
            };

      const amountConds = [];
      if (minVal !== null) {
        amountConds.push({ $gte: [exprField, minVal] });
      }
      if (maxVal !== null) {
        amountConds.push({ $lte: [exprField, maxVal] });
      }
      if (amountConds.length > 0) {
        filters.$expr = amountConds.length === 1 ? amountConds[0] : { $and: amountConds };
      }
    }

    if (text && String(text).trim().length > 0) {
      if (isNumberSearch) {
        filters.camposBusqueda = { $regex: String(text).trim(), $options: "i" };
      } else {
        filters.$text = { $search: `"${String(text).trim()}"` };
      }
    }

    if (descuentoMayorQue) {
      filters.descuentoAplicado = { $gt: parseFloat(descuentoMayorQue) };
    }

    if (descuentoMenorQue) {
      filters.descuentoAplicado = { $lt: parseFloat(descuentoMenorQue) };
    }
    console.log("filters", filters);
    // Filtros por fecha
    if (fechaInicio || fechaFin) {
      const dateFilter = {};
      if (fechaInicio) {
        const [year, month, day] = fechaInicio.split("-");
        const startDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          0,
          0,
          0,
          0
        );
        dateFilter.$gte = startDate;
      }

      if (fechaFin) {
        const [year, month, day] = fechaFin.split("-");
        const endDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          23,
          59,
          59,
          999
        );
        dateFilter.$lte = endDate;
      }
      filters.fechaCuenta = dateFilter;
      console.log(`Filtro de fechas en cuentas pendientes:`, {
        fechaInicio,
        fechaFin,
        descuentoMayorQue,
        descuentoMenorQue,
        dateFilter,
      });
    }

    // Filtro por active (solo si no se incluyen inactivos)
    if (!includeInactive || includeInactive === "false") {
      filters.active = true;
    }

    const sort = {};
    if (sortField) {
      sort[sortField] = sortDirection === "asc" ? 1 : -1;
    }

    const options = {
      filter: filters,
      populate,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
    };

    const result = await cuentaPendienteController.getAllPaginado(options);
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/cliente/:clienteId", async (req, res) => {
  const { clienteId } = req.params;
  const { populate } = req.query;
  try {
    console.log("req.params", req.params);
    console.log("req.query", req.query);
    console.log("BUSCANDO CUENTAS PENDIENTES DEL CLIENTE", clienteId);
    const result = await cuentaPendienteController.getByClienteId(
      clienteId,
      populate || ""
    );
    return res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener las cuentas pendientes del cliente",
      message: error.message,
    });
  }
});

// GET /api/cuentas-pendientes/search - Búsqueda $text
router.get("/search", async (req, res) => {
  const {
    text,
    populate,
    limit = 20,
    offset = 0,
    sortField,
    sortDirection,
    includeInactive,
  } = req.query;
  try {
    const sort = sortField
      ? { [sortField]: sortDirection === "asc" ? 1 : -1 }
      : null;
    const filter = {};
    if (!includeInactive || includeInactive === "false") {
      filter.active = true;
    }
    const result = await cuentaPendienteController.textSearchOpts(text, {
      populate: populate || "",
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
      filter,
    });
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id/logs", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cuentaPendienteController.getLogs(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener los logs de la cuenta pendiente",
      message: error.message,
    });
  }
});

// GET /api/cuentas-pendientes/:id - Obtener por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { populate } = req.query;
    const result = await cuentaPendienteController.getById(id, populate || "");
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/cuentas-pendientes/:id - Eliminar
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cuentaPendienteController.delete(id);
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/migracion/entregas-monto", async (req, res) => {
  const result = await cuentaPendienteController.migracionEntregasMonto();
  return res.json(result);
});

router.put("/migracion/busqueda", async (req, res) => {
  const result = await cuentaPendienteController.migrarBusqueda();
  return res.json(result);
});

module.exports = router;
