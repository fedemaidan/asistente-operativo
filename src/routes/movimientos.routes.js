const express = require("express");
const movimientoController = require("../controllers/movimientoController");
const Caja = require("../models/caja.model");

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
    } = req.query;

    const filters = {};
    if (type) filters.type = type;
    if (clienteNombre) {
      filters["cliente.nombre"] = {
        $regex: clienteNombre,
        $options: "i", // case insensitive
      };
    }
    if (estado) filters.estado = estado;

    if (tipoFactura) filters.tipoFactura = tipoFactura;

    if (cajaNombre) {
      const cajaDoc = await Caja.findOne({ nombre: cajaNombre });
      if (cajaDoc?._id) {
        filters.caja = cajaDoc._id;
      } else {
        // Si no existe la caja, forzamos a no devolver resultados
        filters.caja = null;
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
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/clientes-totales", async (req, res) => {
  try {
    const result = await movimientoController.getClientesTotales();
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
    const result = await movimientoController.getByCliente(clienteId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/tipo/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const result = await movimientoController.getByType(type);
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
    const result = await movimientoController.getByFechaRange(
      fechaInicio,
      fechaFin
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
    const { type, cajaNombre, moneda } = req.query;

    const filters = {};
    if (type) filters.type = type;
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
    const result = await movimientoController.delete(id);
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

module.exports = router;
