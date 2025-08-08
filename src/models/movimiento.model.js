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
    nombre: { type: String, required: true },
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
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true,
      },
    },
  ],
});

const Movimiento = mongoose.model("Movimiento", movimientosSchema);
module.exports = Movimiento;
