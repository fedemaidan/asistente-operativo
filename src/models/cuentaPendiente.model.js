// models/cuentaPendiente.model.js
const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const cuentaPendienteSchema = new mongoose.Schema({
  descripcion: { type: String, default: "" },
  fechaCuenta: { type: Date, default: getFechaArgentina, required: true },
  fechaCreacion: { type: Date, default: getFechaArgentina, required: true },
  horaCreacion: { type: String, default: getFechaArgentina },
  proveedorOCliente: { type: String, required: true },
  descuentoAplicado: { type: Number, default: 1 },
  subTotal: {
    ars: { type: Number, required: true },
    usdOficial: { type: Number, required: true },
    usdBlue: { type: Number, required: true },
  },
  montoTotal: {
    ars: { type: Number, required: true },
    usdOficial: { type: Number, required: true },
    usdBlue: { type: Number, required: true },
  },
  moneda: { type: String, enum: ["ARS", "USD"], required: true },
  cc: {
    type: String,
    enum: ["ARS", "USD BLUE", "USD OFICIAL"],
    required: true,
  },
  tipoDeCambio: { type: Number, required: true },
  usuario: { type: String, required: true },
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente",
    default: null,
  },
  empresaId: { type: String },
  active: { type: Boolean, default: true },

  logs: [
    {
      campo: {
        type: String,
        enum: [
          "descripcion",
          "fechaCuenta",
          "proveedorOCliente",
          "descuentoAplicado",
          "subTotal",
          "montoTotal",
          "moneda",
          "cc",
          "usuario",
          "cliente",
          "active",
          "tipoDeCambio",
        ],
        required: true,
      },
      valorAnterior: { type: mongoose.Schema.Types.Mixed, required: false },
      valorNuevo: { type: mongoose.Schema.Types.Mixed, required: false },
      fechaActualizacion: { type: Date, default: getFechaArgentina },
      usuario: { type: String, required: true },
      empresaId: { type: String },
    },
  ],
});

// Índice de texto para búsquedas con $text
cuentaPendienteSchema.index(
  {
    descripcion: "text",
    proveedorOCliente: "text",
    usuario: "text",
  },
  { default_language: "spanish", name: "cuentaPendiente_text" }
);

function normalizeUpdate(raw) {
  const direct = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith("$")) direct[k] = v;
  }
  const set = raw.$set || {};
  const unset = raw.$unset || {};
  const effective = { ...direct, ...set };
  for (const k of Object.keys(unset)) effective[k] = null;
  return effective;
}

function buildLogs(originalDoc, effectiveUpdate, actor) {
  const loggable = new Set([
    "descripcion",
    "fechaCuenta",
    "proveedorOCliente",
    "descuentoAplicado",
    "subTotal",
    "montoTotal",
    "moneda",
    "cc",
    "usuario",
    "cliente",
    "clienteId",
    "active",
    "tipoDeCambio",
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
        empresaId:
          originalDoc.empresaId || effectiveUpdate.empresaId || undefined,
      });
    }
  }

  return logsToAdd;
}

function preUpdateWithLogs(next) {
  const raw = this.getUpdate() || {};
  const effectiveUpdate = normalizeUpdate(raw);

  this.model
    .findOne(this.getQuery())
    .then((originalDoc) => {
      if (!originalDoc) return next();

      const actor =
        effectiveUpdate.usuario ||
        raw.usuario ||
        (raw.$set && raw.$set.usuario) ||
        originalDoc.usuario ||
        "Sistema";

      const logsToAdd = buildLogs(originalDoc, effectiveUpdate, actor);

      if (logsToAdd.length > 0) {
        const newUpdate = { ...raw };
        newUpdate.$push = newUpdate.$push || {};
        newUpdate.$push.logs = { $each: logsToAdd };
        this.setUpdate(newUpdate);
      }

      next();
    })
    .catch(next);
}

cuentaPendienteSchema.pre("findOneAndUpdate", preUpdateWithLogs);
cuentaPendienteSchema.pre("findByIdAndUpdate", preUpdateWithLogs);

const CuentaPendiente = mongoose.model(
  "CuentaPendiente",
  cuentaPendienteSchema
);
module.exports = CuentaPendiente;
