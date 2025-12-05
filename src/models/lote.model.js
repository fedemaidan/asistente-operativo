const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const loteSchema = new mongoose.Schema({
  pedido: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pedido",
    required: true,
  },
  contenedor: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    ref: "Contenedor",
  },
  recibido: { type: Boolean, default: false },
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt", currentTime: getFechaArgentina }, });

loteSchema.index({ pedido: 1, contenedor: 1 }, { unique: true });

const Lote = mongoose.model("Lote", loteSchema);
module.exports = Lote;