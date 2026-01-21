const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const pedidoSchema = new mongoose.Schema({
  numeroPedido: {
    type: String,
    required: true,
    unique: true,
  },
  estado: {
    type: String,
    enum: ["PENDIENTE", "ENTREGADO"],
    default: "PENDIENTE",
  }, observaciones: {
    type: String,
    default: "",
  },
  productos: [{
    producto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Producto",
      required: true,
    },
    cantidad: {
      type: Number,
      required: true,
    },
  }]
}, {
  timestamps: {
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    currentTime: getFechaArgentina,
  },
});

const Pedido = mongoose.model("Pedido", pedidoSchema);
module.exports = Pedido;