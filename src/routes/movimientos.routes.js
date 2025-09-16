const express = require("express");
const movimientoController = require("../controllers/movimientoController");
const Caja = require("../models/caja.model");
const migrarPagosDesdeGoogleSheets = require("../Utiles/Funciones/Migracion/migracionPagos");
const Movimiento = require("../models/movimiento.model");

const router = express.Router();

router.post("/", async (req, res) => {
  const { movimiento, montoEnviado } = req.body;

  try {
    const result = await movimientoController.createMovimiento(
      movimiento,
      montoEnviado
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.put("/pendiente", async (req, res) => {
  const result = await Movimiento.updateMany(
    { active: true },
    { $set: { estado: "PENDIENTE" } }
  );
  res.json(result);
});

router.put("/:id", async (req, res) => {
  const { nombreUsuario } = req.body;

  console.log("req.body", req.body);

  if (!nombreUsuario) {
    return res
      .status(400)
      .json({ error: "El nombreUsuario es requerido para los logs" });
  }

  try {
    const { id } = req.params;
    const result = await movimientoController.updateMovimiento(id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const {
      populate,
      type,
      limit = 20,
      offset = 0,
      sortField = "fechaFactura",
      sortDirection = "desc",
      clienteNombre,
      tipoFactura,
      cajaNombre,
      estado,
      fecha,
      fechaInicio,
      fechaFin,
      includeInactive = false,
      totalMoneda = false,
      text,
      nombreUsuario,
    } = req.query;

    const isNumberSearch =
      text && String(text).trim().length > 0 && !isNaN(Number(text));
    const filters = { active: true }; // Por defecto solo mostrar movimientos activos
    if (type) filters.type = type;

    // Si se solicita incluir inactivos, remover el filtro de active
    if (includeInactive === "true") {
      delete filters.active;
    }
    if (nombreUsuario) {
      filters.nombreUsuario = nombreUsuario;
    }

    if (clienteNombre) {
      filters["cliente.nombre"] = {
        $regex: clienteNombre,
        $options: "i", // case insensitive
      };
    }
    if (estado) filters.estado = estado;

    if (tipoFactura) filters.tipoFactura = tipoFactura;

    if (text && String(text).trim().length > 0) {
      if (isNumberSearch) {
        filters.camposBusqueda = { $regex: String(text).trim(), $options: "i" };
      } else {
        filters.$text = { $search: String(text).trim() };
      }
    }

    if (cajaNombre) {
      if (cajaNombre === "ambas") {
        const cajasCheque = await Caja.find({
          nombre: { $in: ["CHEQUE", "ECHEQ"] },
        });
        if (cajasCheque.length > 0) {
          const cajaIds = cajasCheque.map((caja) => caja._id);
          filters.caja = { $in: cajaIds };
        } else {
          filters.caja = null;
        }
      } else if (cajaNombre === "CHEQUE" || cajaNombre === "ECHEQ") {
        const cajaDoc = await Caja.findOne({ nombre: cajaNombre });
        if (cajaDoc?._id) {
          filters.caja = cajaDoc._id;
        } else {
          filters.caja = null;
        }
      } else {
        const cajaDoc = await Caja.findOne({ nombre: cajaNombre });
        if (cajaDoc?._id) {
          filters.caja = cajaDoc._id;
        } else {
          filters.caja = null;
        }
      }
    }

    if (fecha) {
      // Crear fecha en zona horaria local (no UTC)
      // Formato esperado: "YYYY-MM-DD"
      const [year, month, day] = fecha.split("-");
      const startDate = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        0,
        0,
        0,
        0
      );
      const endDate = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        23,
        59,
        59,
        999
      );

      console.log(`Filtro de fecha: ${fecha}`);
      console.log(
        `Rango: ${startDate.toISOString()} - ${endDate.toISOString()}`
      );

      filters.$or = [
        {
          fechaFactura: {
            $gte: startDate,
            $lte: endDate,
          },
        },
        {
          fechaFactura: null,
          fechaCreacion: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      ];
    }

    // Filtro por rango de fechas (fechaInicio a fechaFin)
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

      // Aplicar filtro a fechaFactura con fallback a fechaCreacion
      if (Object.keys(dateFilter).length > 0) {
        filters.$or = [
          { fechaFactura: dateFilter },
          {
            fechaFactura: null,
            fechaCreacion: dateFilter,
          },
        ];

        console.log(
          `Filtro de rango: ${fechaInicio || "inicio"} - ${fechaFin || "fin"}`
        );
        console.log(`Fechas aplicadas:`, dateFilter);
      }
    }

    const sort = {};
    if (sortField) {
      const realSortField = sortField === "cuentaDestino" ? "caja" : sortField;
      sort[realSortField] = sortDirection === "asc" ? 1 : -1;
    }

    const options = {
      filter: filters,
      populate,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
    };

    const result = await movimientoController.getAllPaginado(options);
    if (totalMoneda) {
      const sumaARS = await movimientoController.getSumTotalByMoneda(
        "ARS",
        filters?.caja
      );
      const sumaUSD = await movimientoController.getSumTotalByMoneda(
        "USD",
        filters?.caja
      );
      res.json({ ...result, sumaARS, sumaUSD });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

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

    const result = await movimientoController.textSearchOpts(text, {
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

router.get("/clientes-totales", async (req, res) => {
  try {
    const { includeInactive = false } = req.query;
    const result = await movimientoController.getClientesTotales(
      includeInactive
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/cliente/:clienteId", async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { includeInactive = false } = req.query;
    const result = await movimientoController.getByCliente(
      clienteId,
      includeInactive
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/fecha/:fechaInicio/:fechaFin", async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.params;
    const { includeInactive = false } = req.query;
    const result = await movimientoController.getByFechaRange(
      fechaInicio,
      fechaFin,
      includeInactive
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/arqueo/diario", async (req, res) => {
  try {
    const { type, cajaNombre, moneda, includeInactive = false } = req.query;

    const filters = { active: true };
    if (type) filters.type = type;

    if (includeInactive === "true") {
      delete filters.active;
    }
    if (moneda) filters.moneda = moneda;

    if (cajaNombre) {
      const cajaDoc = await Caja.findOne({ nombre: cajaNombre });
      if (cajaDoc?._id) {
        filters.caja = cajaDoc._id;
      } else {
        filters.caja = null;
      }
    }

    const result = await movimientoController.getArqueoDiario({
      filter: filters,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id/logs", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await movimientoController.getLogs(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error al obtener los logs del movimiento",
      message: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { populate } = req.query;
    const result = await movimientoController.getById(id, populate || "");
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombreUsuario } = req.body;

    if (!nombreUsuario) {
      return res
        .status(400)
        .json({ error: "El nombreUsuario es requerido para los logs" });
    }

    const result = await movimientoController.delete(id, nombreUsuario);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/confirmar", async (req, res) => {
  const { ids, usuario } = req.body;
  const result = await movimientoController.actualizarEstados(ids, usuario);
  res.json(result);
});

router.get("/arqueo/total-general", async (req, res) => {
  const result = await movimientoController.getArqueoTotal();
  res.json(result);
});

router.post("/migracion/pagos", async (req, res) => {
  const result = await migrarPagosDesdeGoogleSheets(
    "1zf7cetDmaKG59vGMI9Dlb2D7SVCijEk-6xiL7GRyWqo"
  );
  res.json(result);
});

router.put("/migracion/busqueda", async (req, res) => {
  const result = await movimientoController.migrarBusqueda();
  res.json(result);
});

module.exports = router;
