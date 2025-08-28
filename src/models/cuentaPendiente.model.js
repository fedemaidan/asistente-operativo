const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const cuentaPendienteSchema = new mongoose.Schema({
  descripcion: {
    type: String,
    default: "",
  },
  fechaCuenta: {
    type: Date,
    default: getFechaArgentina, // FECHA DEL USUARIO || FECHA DE CREACION
    required: true,
  },
  fechaCreacion: {
    type: Date,
    default: getFechaArgentina,
    required: true,
  },
  horaCreacion: {
    type: String,
    default: getFechaArgentina,
  },
  proveedorOCliente: {
    type: String,
    required: true,
  },
  descuentoAplicado: {
    type: Number,
    default: 1,
  },
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
  moneda: {
    type: String,
    enum: ["ARS", "USD"],
    required: true,
  },
  cc: {
    type: String,
    enum: ["ARS", "USD BLUE", "USD OFICIAL"],
    required: true,
  },
  tipoDeCambio: {
    type: Number,
    required: true,
  },
  usuario: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
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
          "active",
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
      empresaId: {
        type: String,
        required: true,
      },
    },
  ],
});

// Middleware pre-save para registrar logs automáticamente
cuentaPendienteSchema.pre("save", function (next) {
  console.log("CuentaPendiente save middleware");
  if (this.isNew) {
    // Si es un nuevo documento, no hay logs que registrar
    return next();
  }

  const modifiedPaths = this.modifiedPaths();
  if (modifiedPaths.length === 0) {
    return next();
  }

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
            "descripcion",
            "fechaCuenta",
            "proveedorOCliente",
            "descuentoAplicado",
            "subTotal",
            "montoTotal",
            "moneda",
            "cc",
            "usuario",
            "active",
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
              fechaActualizacion: getFechaArgentina(),
              usuario: this.usuario || "Sistema",
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
cuentaPendienteSchema.pre("findOneAndUpdate", function (next) {
  console.log("CuentaPendiente findOneAndUpdate middleware ejecutándose");
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
            "descripcion",
            "fechaCuenta",
            "proveedorOCliente",
            "descuentoAplicado",
            "subTotal",
            "montoTotal",
            "moneda",
            "cc",
            "usuario",
            "active",
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
              fechaActualizacion: getFechaArgentina(),
              usuario: update.usuario || originalDoc.usuario || "Sistema",
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
cuentaPendienteSchema.pre("findByIdAndUpdate", function (next) {
  console.log("CuentaPendiente findByIdAndUpdate middleware ejecutándose");
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
            "descripcion",
            "fechaCuenta",
            "proveedorOCliente",
            "descuentoAplicado",
            "subTotal",
            "montoTotal",
            "moneda",
            "cc",
            "usuario",
            "active",
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
              fechaActualizacion: getFechaArgentina(),
              usuario: update.usuario || originalDoc.usuario || "Sistema",
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
const CuentaPendiente = mongoose.model(
  "CuentaPendiente",
  cuentaPendienteSchema
);
module.exports = CuentaPendiente;
