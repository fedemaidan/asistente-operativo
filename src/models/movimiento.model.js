const mongoose = require("mongoose");

const movimientosSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["INGRESO", "EGRESO"],
    required: true,
  },
  numeroFactura: {
    type: String,
    default: null,
  },
  fechaFactura: {
    type: Date,
    default: null,
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
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
    enum: ["PENDIENTE", "CONFIRMADO", "CONFIRMAR MONTO", "COBRADO"],
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
        default: Date.now,
      },
      usuario: {
        type: String,
        required: true,
      },
    },
  ],
});

// Middleware pre-save para registrar logs automáticamente
movimientosSchema.pre("save", function (next) {
  console.log("save");
  if (this.isNew) {
    // Si es un nuevo documento, no hay logs que registrar
    return next();
  }

  const modifiedPaths = this.modifiedPaths();
  if (modifiedPaths.length === 0) {
    return next();
  }

  // Obtener el documento original antes de los cambios
  this.constructor
    .findById(this._id)
    .then((originalDoc) => {
      if (!originalDoc) {
        return next();
      }

      const logsToAdd = [];

      modifiedPaths.forEach((path) => {
        if (
          [
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
          ].includes(path)
        ) {
          const valorAnterior = originalDoc[path];
          const valorNuevo = this[path];

          // Solo agregar log si el valor realmente cambió
          if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
            logsToAdd.push({
              campo: path,
              valorAnterior: valorAnterior,
              valorNuevo: valorNuevo,
              fechaActualizacion: new Date(),
              usuario: this.nombreUsuario || "Sistema", // Usuario que creó el movimiento
            });
          }
        }
      });

      // Agregar los logs al array
      if (logsToAdd.length > 0) {
        this.logs.push(...logsToAdd);
      }

      next();
    })
    .catch(next);
});

// Middleware pre-findOneAndUpdate para registrar logs en actualizaciones
movimientosSchema.pre("findOneAndUpdate", function (next) {
  console.log("findOneAndUpdate middleware ejecutándose");
  const update = this.getUpdate();
  const modifiedFields = Object.keys(update);

  if (modifiedFields.length === 0) {
    return next();
  }

  // Obtener el documento original
  this.model
    .findOne(this.getQuery())
    .then((originalDoc) => {
      if (!originalDoc) {
        return next();
      }

      const logsToAdd = [];

      modifiedFields.forEach((field) => {
        if (
          [
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
          ].includes(field)
        ) {
          const valorAnterior = originalDoc[field];
          const valorNuevo = update[field];

          // Solo agregar log si el valor realmente cambió
          if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
            logsToAdd.push({
              campo: field,
              valorAnterior: valorAnterior,
              valorNuevo: valorNuevo,
              fechaActualizacion: new Date(),
              usuario:
                update.nombreUsuario || originalDoc.nombreUsuario || "Sistema",
            });
          }
        }
      });

      // Agregar los logs al update
      if (logsToAdd.length > 0) {
        if (!update.$push) {
          update.$push = {};
        }
        update.$push.logs = { $each: logsToAdd };
      }

      next();
    })
    .catch(next);
});

// Middleware específico para findByIdAndUpdate
movimientosSchema.pre("findByIdAndUpdate", function (next) {
  console.log("findByIdAndUpdate middleware ejecutándose");
  const update = this.getUpdate();
  const modifiedFields = Object.keys(update);

  if (modifiedFields.length === 0) {
    return next();
  }

  // Obtener el documento original
  this.model
    .findById(this.getQuery()._id || this.getQuery())
    .then((originalDoc) => {
      if (!originalDoc) {
        return next();
      }

      const logsToAdd = [];

      modifiedFields.forEach((field) => {
        if (
          [
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
          ].includes(field)
        ) {
          const valorAnterior = originalDoc[field];
          const valorNuevo = update[field];

          // Solo agregar log si el valor realmente cambió
          if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
            logsToAdd.push({
              campo: field,
              valorAnterior: valorAnterior,
              valorNuevo: valorNuevo,
              fechaActualizacion: new Date(),
              usuario:
                update.nombreUsuario || originalDoc.nombreUsuario || "Sistema",
            });
          }
        }
      });

      // Agregar los logs al update
      if (logsToAdd.length > 0) {
        if (!update.$push) {
          update.$push = {};
        }
        update.$push.logs = { $each: logsToAdd };
      }

      next();
    })
    .catch(next);
});

// Compilar el modelo DESPUÉS de definir middlewares
const Movimiento = mongoose.model("Movimiento", movimientosSchema);

module.exports = Movimiento;
