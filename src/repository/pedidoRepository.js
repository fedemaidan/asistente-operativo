const BaseRepository = require("./baseRepository");
const Pedido = require("../models/pedido.model");

class PedidoRepository extends BaseRepository {
  constructor() {
    super(Pedido);
  }

  async getPaginated(options = {}) {
    const { limit, offset, sort } = options;
    return this.findPaginated(
      {},
      {
        limit,
        offset,
        sort,
      }
    );
  }

  async getPaginatedWithProductos(options = {}) {
    const { limit, offset, sort } = options;
    return this.findPaginated(
      {},
      {
        limit,
        offset,
        sort,
        populate: { path: "productos.producto" },
      }
    );
  }

  async findByNumero(numeroPedido) {
    if (!numeroPedido) return null;
    return this.findOne({ numeroPedido });
  }

  async createWithSession(data, session) {
    const pedido = new this.model(data);
    return session ? pedido.save({ session }) : pedido.save();
  }
}

module.exports = PedidoRepository;
