const BaseRepository = require("./baseRepository");
const UsuarioBot = require("../models/usuarioBot.model");

class UsuarioBotRepository extends BaseRepository {
  constructor() {
    super(UsuarioBot);
  }

  async findByTelefono(telefono) {
    const t = String(telefono || "").trim();
    if (!t) return null;
    return this.findOne({ telefono: t });
  }
}

module.exports = UsuarioBotRepository;
