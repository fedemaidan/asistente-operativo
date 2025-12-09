const BaseRepository = require("./baseRepository");
const Lote = require("../models/lote.model");

class LoteRepository extends BaseRepository {
  constructor() {
    super(Lote);
  }

  async findPendientesByProducto(productIds = []) {
    const filter = {
      recibido: false,
      ...(productIds.length > 0 ? { producto: { $in: productIds } } : {}),
    };

    return this.find(filter, {
      populate: { path: "contenedor", select: "fechaEstimadaLlegada" },
    });
  }
}

module.exports = LoteRepository;
