const BaseRepository = require("./baseRepository");
const Contenedor = require("../models/contenedor.model");

class ContenedorRepository extends BaseRepository {
  constructor() {
    super(Contenedor);
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

  async findByCodigo(codigo) {
    if (!codigo) return null;
    return this.findOne({ codigo });
  }
}

module.exports = ContenedorRepository;
