import mongoose from "mongoose";

const cuentaPendienteSchema = new mongoose.Schema({
  descripcion: {
    type: String,
    default: "",
  },
  fechaCuenta: {
    type: Date,
    default: Date.now, // FECHA DEL USUARIO || FECHA DE CREACION
    required: true,
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
    required: true,
  },
  proveedorOCliente: {
    type: String,
    required: true,
  },
  descuentoAplicado: {
    type: Number,
    default: 1,
  },
  montoTotal: {
    type: Number,
    required: true,
  },
  moneda: {
    type: String,
    enum: ["ARS", "USD"],
    required: true,
  },
  cc: {
    type: String,
    enum: ["ARS", "USD_BLUE", "USD_OFICIAL"],
    required: true,
  },
});
