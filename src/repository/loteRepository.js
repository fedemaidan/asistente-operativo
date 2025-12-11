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
}

module.exports = LoteRepository;
