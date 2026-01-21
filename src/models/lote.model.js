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
  }, producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Producto",
    required: true,
  }, 
  cantidad: {
    type: Number,
    required: true,
    min: 1,
  },
  estado: {
    type: String,
    enum: ["PENDIENTE", "ENTREGADO"],
    default: "PENDIENTE",
  },
  fechaEntrega: {
    type: Date,
    default: null,
  },
  // solo se usa cuando NO hay contenedor
  fechaEstimadaDeLlegada: {
    type: Date, 
    default: null,
  }
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt", currentTime: getFechaArgentina }, });

// Compatibilidad: virtual recibido (true si estado === ENTREGADO)
loteSchema.virtual("recibido")
  .get(function () {
    return this.estado === "ENTREGADO";
  })
  .set(function (val) {
    this.estado = val ? "ENTREGADO" : "PENDIENTE";
  });

loteSchema.set("toJSON", { virtuals: true });
loteSchema.set("toObject", { virtuals: true });

loteSchema.index({ pedido: 1, contenedor: 1 });

const Lote = mongoose.model("Lote", loteSchema);
module.exports = Lote;