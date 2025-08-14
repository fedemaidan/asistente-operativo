const mongoose = require("mongoose");

const clienteSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
    },
    descuento: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
      validate: {
        validator: function (v) {
          return v >= 0 && v <= 1;
        },
        message:
          "El descuento debe estar entre 0 y 1 (ej: 0.05 = 5%, 0.15 = 15%)",
      },
    },
    ccActivas: {
      required: true,
      type: [String],
      enum: ["ARS", "USD BLUE", "USD OFICIAL"],
      default: ["ARS"],
    },
    usuario: {
      type: String,
      required: true,
    },
    logs: [
      {
        campo: {
          type: String,
          enum: ["nombre", "descuento", "ccActivas"],
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
  },
  {
    timestamps: true,
  }
);

// Middleware pre-save para registrar logs automáticamente
clienteSchema.pre("save", function (next) {
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
        if (["nombre", "descuento", "ccActivas"].includes(path)) {
          const valorAnterior = originalDoc[path];
          const valorNuevo = this[path];

          // Solo agregar log si el valor realmente cambió
          if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
            logsToAdd.push({
              campo: path,
              valorAnterior: valorAnterior,
              valorNuevo: valorNuevo,
              fechaActualizacion: new Date(),
              usuario: this.usuario, // Usuario que creó el cliente
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
clienteSchema.pre("findOneAndUpdate", function (next) {
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
        if (["nombre", "descuento", "ccActivas"].includes(field)) {
          const valorAnterior = originalDoc[field];
          const valorNuevo = update[field];

          // Solo agregar log si el valor realmente cambió
          if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
            logsToAdd.push({
              campo: field,
              valorAnterior: valorAnterior,
              valorNuevo: valorNuevo,
              fechaActualizacion: new Date(),
              usuario: update.usuario || originalDoc.usuario || "Sistema", // Usuario que hace la edición
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

const Cliente = mongoose.model("Cliente", clienteSchema);
module.exports = Cliente;
