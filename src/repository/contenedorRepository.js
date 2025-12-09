const BaseRepository = require("./baseRepository");
const Contenedor = require("../models/contenedor.model");

class ContenedorRepository extends BaseRepository {
  constructor() {
    super(Contenedor);
  }
}

module.exports = ContenedorRepository;
