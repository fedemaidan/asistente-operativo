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

  async createWithSession(data, session) {
    if (session) {
      return this.model.create([data], { session }).then((docs) => docs[0]);
    }
    const doc = new this.model(data);
    return doc.save();
  }
}

module.exports = ContenedorRepository;
