import mongoose from "mongoose";

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
  cliente: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cliente",
      required: true,
    },
    nombre: { type: String, required: true },
    descuento: { type: Number, required: true },
    ccActivas: {
      type: [String],
      enum: ["ARS", "USD_BLUE", "USD_OFICIAL"],
      required: true,
    },
  },
  cuentaCorriente: {
    type: String,
    enum: ["ARS", "USD_BLUE", "USD_OFICIAL"],
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  caja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Caja",
    required: true,
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
      "facturaA",
      "facturaB",
      "facturaC",
    ],
  },
  estado: {
    type: String,
    enum: ["PENDIENTE", "CONFIRMADO", "CONFIRMAR MONTO", "COBRADO"],
  },
  fechaCobro: {
    type: Date,
    default: null,
  },
  userPhone: {
    type: String,
  },
  nombreUsuario: {
    type: String,
    required: true,
  },
});

const Movimiento = mongoose.model("Movimiento", movimientosSchema);
export default Movimiento;
