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
  camposBusqueda: {
    type: String,
    default: "",
  },

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

cuentaPendienteSchema.index({ camposBusqueda: "text" });

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

      // Resolver actor para logs desde _actor u opciones, con fallback
      const opts =
        (typeof this.getOptions === "function" && this.getOptions()) ||
        this.options ||
        {};
      const actor =
        raw._actor ||
        (raw.$set && raw.$set._actor) ||
        opts._actor ||
        raw.usuario ||
        (raw.$set && raw.$set.usuario) ||
        originalDoc.usuario ||
        "Sistema";

      const logsToAdd = buildLogs(originalDoc, effectiveUpdate, actor);

      // Asegurar inmutabilidad: impedir actualización del campo usuario y limpiar _actor
      delete effectiveUpdate.usuario;
      if (raw.$set) {
        delete raw.$set.usuario;
        delete raw.$set._actor;
      }
      if (raw.usuario) delete raw.usuario;
      if (raw._actor) delete raw._actor;

      const newUpdate = { ...raw };

      if (logsToAdd.length > 0) {
        newUpdate.$push = newUpdate.$push || {};
        newUpdate.$push.logs = { $each: logsToAdd };
      }

      // Recalcular camposBusqueda con el estado "siguiente"
      try {
        const clienteNombre = String(
          effectiveUpdate.cliente !== undefined
            ? effectiveUpdate.cliente.nombre
            : originalDoc?.cliente?.nombre || ""
        );

        const cc = String(
          effectiveUpdate.cc !== undefined
            ? effectiveUpdate.cc
            : originalDoc?.cc || ""
        );

        const moneda = String(
          effectiveUpdate.moneda !== undefined
            ? effectiveUpdate.moneda
            : originalDoc?.moneda || ""
        );

        const usuario = String(originalDoc?.usuario || "");

        const tipoDeCambio = Math.round(
          Number(
            effectiveUpdate.tipoDeCambio !== undefined
              ? effectiveUpdate.tipoDeCambio
              : originalDoc?.tipoDeCambio || 0
          )
        );

        const totalNext =
          effectiveUpdate.montoTotal !== undefined
            ? effectiveUpdate.montoTotal
            : originalDoc?.montoTotal || {};

        const montoCC = (() => {
          if (cc === "ARS") return Math.round(Number(totalNext?.ars || 0));
          if (cc === "USD BLUE")
            return Math.round(Number(totalNext?.usdBlue || 0));
          if (cc === "USD OFICIAL")
            return Math.round(Number(totalNext?.usdOficial || 0));
          return 0;
        })();

        // Para montoEnviado usar SIEMPRE el subTotal (no el montoTotal)
        const subTotalNext =
          effectiveUpdate.subTotal !== undefined
            ? effectiveUpdate.subTotal
            : originalDoc?.subTotal || {};

        const montoEnviado = (() => {
          if (moneda === "ARS")
            return Math.round(Number(subTotalNext?.ars || 0));
          if (moneda === "USD") {
            const usdVal =
              subTotalNext?.usdBlue !== undefined &&
              subTotalNext?.usdBlue !== null
                ? subTotalNext.usdBlue
                : subTotalNext?.usdOficial;
            return Math.round(Number(usdVal || 0));
          }
          return 0;
        })();

        const descripcion = String(
          effectiveUpdate.descripcion !== undefined
            ? effectiveUpdate.descripcion
            : originalDoc?.descripcion || ""
        );

        const camposBusqueda = [
          clienteNombre,
          descripcion,
          cc,
          moneda,
          usuario,
          String(tipoDeCambio),
          String(montoCC),
          String(montoEnviado),
        ]
          .filter(
            (v) => v !== undefined && v !== null && String(v).trim().length > 0
          )
          .join(" ");

        newUpdate.$set = newUpdate.$set || {};
        newUpdate.$set.camposBusqueda = camposBusqueda;
      } catch (e) {
        // Continuar sin bloquear la actualización si falla el recomputo
      }

      this.setUpdate(newUpdate);

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
