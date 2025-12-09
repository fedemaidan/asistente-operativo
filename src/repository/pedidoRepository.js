const BaseRepository = require("./baseRepository");
const Pedido = require("../models/pedido.model");

class PedidoRepository extends BaseRepository {
  constructor() {
    super(Pedido);
  }
}

module.exports = PedidoRepository;
