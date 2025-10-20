const express = require("express");
const movimientoController = require("../controllers/movimientoController");
const Caja = require("../models/caja.model");
const migrarPagosDesdeGoogleSheets = require("../Utiles/Funciones/Migracion/migracionPagos");
const Movimiento = require("../models/movimiento.model");

const router = express.Router();

// Helper para normalizar arrays desde query params
const toArray = (val, altKey, reqQuery) => {
  if (!val && altKey && reqQuery[altKey]) val = reqQuery[altKey];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    if (val.includes(","))
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return [val];
  }
  return undefined;
};

const parseFlexible = (value, endOfDay = false) => {
  if (!value) return null;

  const [y, m, d] = String(value).split("-").map(Number);

  if (!y || !m || !d) return null;

  if (endOfDay) {
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  } else {
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }
};

// Helper para construir filtros de fecha consistentes
const buildDateFilter = (fechaInicio, fechaFin) => {
  if (!fechaInicio && !fechaFin) return null;

  const dateFilter = {};
  const startDate = parseFlexible(fechaInicio, false);
  const endDate = parseFlexible(fechaFin, true);

  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  if (Object.keys(dateFilter).length === 0) return null;

  return {
    $or: [
      { fechaFactura: dateFilter },
      { fechaFactura: null, fechaCreacion: dateFilter },
    ],
  };
};

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
      moneda,
      estado,
      fecha,
      fechaInicio,
      fechaFin,
      includeInactive = false,
      totalMoneda = false,
      text,
      nombreUsuario,
      cajasIds,
      categorias,
    } = req.query;

    console.log("req.query", req.query);
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
    if (moneda) filters.moneda = moneda;

    if (tipoFactura) filters.tipoFactura = tipoFactura;

    if (text && String(text).trim().length > 0) {
      if (isNumberSearch) {
        filters.camposBusqueda = { $regex: String(text).trim(), $options: "i" };
      } else {
        filters.$text = { $search: `"${String(text).trim()}"` };
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

    const cajasIdsArr = toArray(cajasIds, "cajasIds[]", req.query);
    const categoriasArr = toArray(categorias, "categorias[]", req.query);

    if (cajasIdsArr && cajasIdsArr.length > 0) {
      filters.caja = { $in: cajasIdsArr };
    }

    if (categoriasArr && categoriasArr.length > 0) {
      filters.categoria = { $in: categoriasArr };
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
      const dateFilterObj = buildDateFilter(fechaInicio, fechaFin);
      if (dateFilterObj) {
        Object.assign(filters, dateFilterObj);
        console.log(
          `Filtro de rango flexible: ${fechaInicio || "inicio"} - ${
            fechaFin || "fin"
          }`
        );
      }
    }

    const sort = {};
    if (sortField) {
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortField === "cuentaDestino") {
        sort["caja"] = dir;
      } else if (sortField === "fecha") {
        // Ordenar por fechaFactura y como secundario fechaCreacion
        sort["fechaFactura"] = dir;
        sort["fechaCreacion"] = dir;
      } else {
        sort[sortField] = dir;
      }
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

router.get("/clientes-totales-v2", async (req, res) => {
  try {
    const result = await movimientoController.getClientesTotalesV2();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/clientes-totales/compare", async (req, res) => {
  try {
    const startV1 = Date.now();
    const resultV1 = await movimientoController.getClientesTotales();
    const endV1 = Date.now();
    const timeV1 = (endV1 - startV1) / 1000; 

    const startV2 = Date.now();
    const resultV2 = await movimientoController.getClientesTotalesV2();
    const endV2 = Date.now();
    const timeV2 = (endV2 - startV2) / 1000;

    // Calcular totales globales de la versión original
    let totalesV1 = {
      ARS: 0,
      "USD BLUE": 0,
      "USD OFICIAL": 0,
    };
    if (resultV1.success && Array.isArray(resultV1.data)) {
      resultV1.data.forEach((cliente) => {
        totalesV1.ARS += cliente.ARS || 0;
        totalesV1["USD BLUE"] += cliente["USD BLUE"] || 0;
        totalesV1["USD OFICIAL"] += cliente["USD OFICIAL"] || 0;
      });
    }

    // Calcular totales globales de la versión optimizada
    let totalesV2 = {
      ARS: 0,
      "USD BLUE": 0,
      "USD OFICIAL": 0,
    };
    if (resultV2.success && Array.isArray(resultV2.data)) {
      resultV2.data.forEach((cliente) => {
        totalesV2.ARS += cliente.ARS || 0;
        totalesV2["USD BLUE"] += cliente["USD BLUE"] || 0;
        totalesV2["USD OFICIAL"] += cliente["USD OFICIAL"] || 0;
      });
    }

    res.json({
      success: true,
      comparacion: {
        version1_original: {
          tiempoSegundos: timeV1,
          cantidadClientes: resultV1.success ? resultV1.data.length : 0,
          totales: totalesV1,
        },
        version2_optimizada: {
          tiempoSegundos: timeV2,
          cantidadClientes: resultV2.success ? resultV2.data.length : 0,
          totales: totalesV2,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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

router.get("/totales-agrupados", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, categorias, cajasIds, type, moneda } =
      req.query;

    // Construir filtros base (igual que en GET /)
    const filters = { active: true };
    if (type) filters.type = type;
    if (moneda) filters.moneda = moneda;

    // Normalizar arrays
    const cajasIdsArr = toArray(cajasIds, "cajasIds[]", req.query);
    const categoriasArr = toArray(categorias, "categorias[]", req.query);

    if (cajasIdsArr && cajasIdsArr.length > 0) {
      filters.caja = { $in: cajasIdsArr };
    }

    if (categoriasArr && categoriasArr.length > 0) {
      filters.categoria = { $in: categoriasArr };
    }

    // Aplicar filtro de fechas (igual que en GET /)
    if (fechaInicio || fechaFin) {
      const dateFilterObj = buildDateFilter(fechaInicio, fechaFin);
      if (dateFilterObj) {
        Object.assign(filters, dateFilterObj);
      }
    }

    const result = await movimientoController.getTotalesAgrupados(filters);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener los totales agrupados:", error);
    res.status(500).json({ success: false, error: error.message });
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
  try {
    const { fechaInicio, fechaFin, cajaNombre } = req.query;
    const result = await movimientoController.getArqueoTotal({
      fechaInicio,
      fechaFin,
      cajaNombre,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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
