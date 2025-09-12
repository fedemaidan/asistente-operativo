const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const movimientosSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["INGRESO", "EGRESO"],
    required: true,
  },
  empresaId: {
    type: String,
    required: true,
  },
  numeroFactura: {
    type: String,
    default: null,
  },
  fechaFactura: {
    type: Date,
    default: getFechaArgentina,
  },
  fechaCreacion: {
    type: Date,
    default: getFechaArgentina,
  },
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente",
    default: null,
  },
  cliente: {
    nombre: { type: String, default: null },
    descuento: { type: Number, default: 0 },
    ccActivas: {
      type: [String],
      enum: ["ARS", "USD BLUE", "USD OFICIAL"],
      default: null,
    },
  },
  cuentaCorriente: {
    type: String,
    enum: ["ARS", "USD BLUE", "USD OFICIAL"],
    required: true,
  },
  moneda: {
    type: String,
    enum: ["ARS", "USD"],
    required: true,
  },
  total: {
    ars: { type: Number, required: true },
    usdOficial: { type: Number, required: true },
    usdBlue: { type: Number, required: true },
  },
  caja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Caja",
    default: null,
  },
  urlImagen: {
    type: String,
    default: "",
  },
  tipoFactura: {
    type: String,
    enum: [
      "transferencia",
      "deposito",
      "cheque",
      "efectivo",
      "facturaA",
      "facturaB",
      "facturaC",
    ],
    required: true,
  },
  estado: {
    type: String,
    enum: [
      "PENDIENTE",
      "CONFIRMADO",
      "REVISAR MONTO",
      "PENDIENTE A COBRAR",
      "COBRADO",
    ],
    default: "PENDIENTE",
  },
  fechaCobro: {
    type: Date,
    default: null,
  },
  userPhone: {
    type: String,
    default: null,
  },
  nombreUsuario: {
    type: String,
    required: true,
  },
  tipoDeCambio: {
    type: Number,
    required: true,
  },
  concepto: {
    type: String,
    default: null,
  },
  active: {
    type: Boolean,
    default: true,
  },
  camposBusqueda: {
    type: String,
    default: "",
  },
  logs: [
    {
      campo: {
        type: String,
        enum: [
          "tipoDeCambio",
          "estado",
          "caja",
          "cliente",
          "cuentaCorriente",
          "moneda",
          "tipoFactura",
          "urlImagen",
          "numeroFactura",
          "fechaFactura",
          "fechaCreacion",
          "userPhone",
          "nombreUsuario",
          "concepto",
          "active",
          "total",
        ],
        required: true,
      },
      valorAnterior: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
      valorNuevo: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
      fechaActualizacion: {
        type: Date,
        default: getFechaArgentina,
      },
      usuario: {
        type: String,
        required: true,
      },
    },
  ],
});

movimientosSchema.index({ camposBusqueda: "text" });

function normalizeUpdate(raw) {
  const direct = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith("$")) direct[k] = v;
  }
  const set = raw.$set || {};
  return { ...direct, ...set };
}

function buildLogs(originalDoc, effectiveUpdate, actor) {
  const loggable = new Set([
    "tipoDeCambio",
    "estado",
    "caja",
    "cliente",
    "cuentaCorriente",
    "moneda",
    "tipoFactura",
    "urlImagen",
    "numeroFactura",
    "fechaFactura",
    "fechaCreacion",
    "userPhone",
    "nombreUsuario",
    "concepto",
    "active",
    "total",
  ]);

  const logsToAdd = [];

  for (const field of Object.keys(effectiveUpdate)) {
    if (!loggable.has(field)) continue;

    const prev = originalDoc[field] !== undefined ? originalDoc[field] : null;
    const next =
      effectiveUpdate[field] !== undefined ? effectiveUpdate[field] : null;

    if (
      JSON.stringify(prev) !== JSON.stringify(next) &&
      (prev !== null || next !== null)
    ) {
      logsToAdd.push({
        campo: field,
        valorAnterior: prev === undefined ? null : prev,
        valorNuevo: next === undefined ? null : next,
        fechaActualizacion: getFechaArgentina(),
        usuario: actor || "Sistema",
      });
    }
  }

  return logsToAdd;
}

function preUpdateWithLogs(next) {
  const raw = this.getUpdate();
  const effectiveUpdate = normalizeUpdate(raw);

  this.model
    .findOne(this.getQuery())
    .then((originalDoc) => {
      if (!originalDoc) return next();

      // Actor para el log
      const actor =
        effectiveUpdate.nombreUsuario ||
        raw.nombreUsuario ||
        (raw.$set && raw.$set.nombreUsuario) ||
        originalDoc.nombreUsuario ||
        "Sistema";

      const logsToAdd = buildLogs(originalDoc, effectiveUpdate, actor);
      if (logsToAdd.length > 0) {
        // Inyectar $push.logs correctamente
        const newUpdate = { ...raw };
        newUpdate.$push = newUpdate.$push || {};
        newUpdate.$push.logs = { $each: logsToAdd };
        this.setUpdate(newUpdate);
      }

      next();
    })
    .catch(next);
}

movimientosSchema.pre("findOneAndUpdate", preUpdateWithLogs);
movimientosSchema.pre("findByIdAndUpdate", preUpdateWithLogs);

// Compilar el modelo DESPUÉS de definir middlewares
const Movimiento = mongoose.model("Movimiento", movimientosSchema);

module.exports = Movimiento;
