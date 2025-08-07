const mongoose = require("mongoose");

const clienteSchema = new mongoose.Schema({
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
    type: [String],
    enum: ["ARS", "USD_BLUE", "USD_OFICIAL"],
    default: ["ARS"],
  },
});

const Cliente = mongoose.model("Cliente", clienteSchema);
module.exports = Cliente;
