const mongoose = require("mongoose");

const clienteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
  },
  descuento: {
    type: Number,
    default: 0,
  },
  ccActivas: {
    type: [String],
    enum: ["ARS", "USD_BLUE", "USD_OFICIAL"],
    default: ["ARS"],
  },
});

const Cliente = mongoose.model("Cliente", clienteSchema);
module.exports = Cliente;
