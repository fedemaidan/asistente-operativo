const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");
const Caja = require("./caja.model");

const movimientosSchema = new mongoose.Schema({
  descripcion: { type: String, default: "" },
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
  categoria: {
    type: String,
    default: null,
  },
  camposBusqueda: {
    type: String,
    default: "",
  },
  movimientoComplementario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Movimiento",
    default: null
  },
  montoDolarBalance: {
    type: Number,
    default: 0,
    required: true,
  },
  logs: [
    {
      campo: {
        type: String,
        enum: [
          "descripcion",
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
    "descripcion",
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
    "concepto",
    "active",
    "total",
    "categoria",
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
    .then(async (originalDoc) => {
      if (!originalDoc) return next();

      // Actor para el log: soportar múltiples fuentes
      const opts =
        (typeof this.getOptions === "function" && this.getOptions()) ||
        this.options ||
        {};
      const actor =
        raw._actor ||
        (raw.$set && raw.$set._actor) ||
        opts._actor ||
        raw.nombreUsuario ||
        (raw.$set && raw.$set.nombreUsuario) ||
        originalDoc.nombreUsuario ||
        "Sistema";

      // Asegurar inmutabilidad de nombreUsuario: impedir su actualización y limpiar _actor del update
      delete effectiveUpdate.nombreUsuario;
      if (raw.$set) {
        delete raw.$set.nombreUsuario;
        delete raw.$set._actor;
      }
      if (raw.nombreUsuario) delete raw.nombreUsuario;
      if (raw._actor) delete raw._actor;

      const logsToAdd = buildLogs(originalDoc, effectiveUpdate, actor);
      const newUpdate = { ...raw };
      if (logsToAdd.length > 0) {
        // Inyectar $push.logs correctamente
        newUpdate.$push = newUpdate.$push || {};
        newUpdate.$push.logs = { $each: logsToAdd };
      }

      // Recalcular camposBusqueda con el estado "siguiente"
      try {
        const getNested = (obj, path) => {
          if (!obj || !path) return undefined;
          return path
            .split(".")
            .reduce((acc, key) => (acc ? acc[key] : undefined), obj);
        };

        const descripcion = String(
          effectiveUpdate.descripcion !== undefined
            ? effectiveUpdate.descripcion
            : originalDoc?.descripcion || ""
        );

        const clienteNombre =
          effectiveUpdate["cliente.nombre"] !== undefined
            ? String(effectiveUpdate["cliente.nombre"])
            : effectiveUpdate?.cliente?.nombre !== undefined
            ? String(effectiveUpdate.cliente.nombre)
            : String(originalDoc?.cliente?.nombre || "");

        const cajaId =
          effectiveUpdate.caja !== undefined
            ? effectiveUpdate.caja
            : originalDoc?.caja;
        const cajaDoc = cajaId ? await Caja.findById(cajaId) : null;
        const cajaNombre = String(cajaDoc?.nombre || "");

        const cuentaCorriente = String(
          effectiveUpdate.cuentaCorriente !== undefined
            ? effectiveUpdate.cuentaCorriente
            : originalDoc?.cuentaCorriente || ""
        );
        const moneda = String(
          effectiveUpdate.moneda !== undefined
            ? effectiveUpdate.moneda
            : originalDoc?.moneda || ""
        );
        const estado = String(
          effectiveUpdate.estado !== undefined
            ? effectiveUpdate.estado
            : originalDoc?.estado || ""
        );
        const usuario = String(originalDoc?.nombreUsuario || "");
        const tipoDeCambio = Math.round(
          Number(
            effectiveUpdate.tipoDeCambio !== undefined
              ? effectiveUpdate.tipoDeCambio
              : originalDoc?.tipoDeCambio || 0
          )
        );

        const totalNext =
          effectiveUpdate.total !== undefined
            ? effectiveUpdate.total
            : originalDoc?.total || {};

        const montoCC = (() => {
          if (cuentaCorriente === "ARS")
            return Math.round(Number(totalNext?.ars || 0));
          if (cuentaCorriente === "USD BLUE")
            return Math.round(Number(totalNext?.usdBlue || 0));
          if (cuentaCorriente === "USD OFICIAL")
            return Math.round(Number(totalNext?.usdOficial || 0));
          return 0;
        })();

        const montoEnviado = (() => {
          if (moneda === "ARS") return Math.round(Number(totalNext?.ars || 0));
          if (moneda === "USD") {
            const usdVal =
              totalNext?.usdBlue !== undefined && totalNext?.usdBlue !== null
                ? totalNext.usdBlue
                : totalNext?.usdOficial;
            return Math.round(Number(usdVal || 0));
          }
          return 0;
        })();

        const categoria = String(
          effectiveUpdate.categoria !== undefined
            ? effectiveUpdate.categoria
            : originalDoc?.categoria || ""
        );

        const camposBusqueda = [
          descripcion,
          clienteNombre,
          cajaNombre,
          cuentaCorriente,
          moneda,
          estado,
          usuario,
          String(tipoDeCambio),
          String(montoCC),
          String(montoEnviado),
          String(categoria),
        ]
          .filter(
            (v) => v !== undefined && v !== null && String(v).trim().length > 0
          )
          .join(" ");

        newUpdate.$set = newUpdate.$set || {};
        newUpdate.$set.camposBusqueda = camposBusqueda;
      } catch (e) {
        // En caso de error al recomputar, continuar sin bloquear la actualización
      }

      this.setUpdate(newUpdate);

      next();
    })
    .catch(next);
}

movimientosSchema.pre("findOneAndUpdate", preUpdateWithLogs);
movimientosSchema.pre("findByIdAndUpdate", preUpdateWithLogs);

// Compilar el modelo DESPUÉS de definir middlewares
const Movimiento = mongoose.model("Movimiento", movimientosSchema);

module.exports = Movimiento;
