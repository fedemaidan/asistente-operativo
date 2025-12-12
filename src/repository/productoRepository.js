const BaseRepository = require('./baseRepository');
const Producto = require('../models/producto.model');

class ProductoRepository extends BaseRepository {
  constructor() {
    super(Producto);
  }

  async getPaginated(options = {}) {
    const { limit, offset, sort } = options;
    return this.findPaginated(
      { active: true },
      {
        limit,
        offset,
        sort,
      }
    );
  }

  async updateProducto(id, data) {
    return this.updateById(id, data);
  }

  async softDeleteProducto(id) {
    return this.softDeleteById(id);
  }

  async findByCodigos(codigos = []) {
    if (!Array.isArray(codigos) || codigos.length === 0) return [];
    return this.find({ codigo: { $in: codigos } });
  }

  async updateProyeccionFields(id, payload) {
    return this.updateById(id, payload, { new: true });
  }
}

module.exports = ProductoRepository;