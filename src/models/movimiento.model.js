const mongoose = require("mongoose");

const movimientosSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["INGRESO", "EGRESO"],
    required: true,
  },
  numeroFactura: {
    type: String,
    required: true,
  },
  fechaFactura: {
    type: Date,
    required: true,
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
    nombre: { type: String, required: true },
    descuento: { type: Number, default: 0 },
    ccActivas: {
      type: [String],
      enum: ["ARS", "USD_BLUE", "USD_OFICIAL"],
      default: null,
    },
  },
  cuentaCorriente: {
    type: String,
    enum: ["ARS", "USD_BLUE", "USD_OFICIAL"],
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
});

const Movimiento = mongoose.model("Movimiento", movimientosSchema);
module.exports = Movimiento;
