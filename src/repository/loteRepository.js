const BaseRepository = require("./baseRepository");
const Lote = require("../models/lote.model");

class LoteRepository extends BaseRepository {
  constructor() {
    super(Lote);
  }

  async createManyWithSession(dataArray = [], session) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return [];
    return session ? this.model.insertMany(dataArray, { session }) : this.model.insertMany(dataArray);
  }

  /**
   * Obtiene lotes pendientes (no recibidos).
   * Si se pasan productIds, filtra por esos productos.
   * Permite configurar populate para reutilizar en distintos casos.
   */
  async findPendientes({ productIds = [], populate = null } = {}) {
    const filter = { estado: "PENDIENTE" };
    if (Array.isArray(productIds) && productIds.length > 0) {
      filter.producto = { $in: productIds };
    }

    return this.find(filter, { populate });
  }

  /**
   * Compatibilidad con uso anterior en ProyeccionService.
   */
  async findPendientesByProducto(productIds = []) {
    return this.findPendientes({
      productIds,
      populate: [{ path: "contenedor" }],
    });
  }
}

module.exports = LoteRepository;
