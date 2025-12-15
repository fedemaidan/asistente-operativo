const BaseRepository = require('./baseRepository');
const Producto = require('../models/producto.model');

class ProductoRepository extends BaseRepository {
  constructor() {
    super(Producto);
  }

  buildActiveFilter(extraFilter) {
    if (!extraFilter || (typeof extraFilter === "object" && Object.keys(extraFilter).length === 0)) {
      return { active: true };
    }
    return { $and: [{ active: true }, extraFilter] };
  }

  async getAllActive(options = {}) {
    const { sort = { createdAt: -1 }, filter } = options;
    return this.model
      .find(this.buildActiveFilter(filter))
      .sort(sort)
      .populate({ path: "tags", select: "nombre" })
      .lean();
  }

  async getPaginated(options = {}) {
    const { limit, offset, sort, filter } = options;
    return this.findPaginated(
      this.buildActiveFilter(filter),
      {
        limit,
        offset,
        sort,
        populate: { path: "tags", select: "nombre" },
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

  async getTagsUsageByProductoCodigo() {
    return this.model
      .find(
        { active: true, tags: { $exists: true, $ne: [] } },
        { codigo: 1, tags: 1 }
      )
      .lean();
  }

  async clearTagsByProductoIds(productoIds = []) {
    if (!Array.isArray(productoIds) || productoIds.length === 0) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    return this.model.updateMany(
      { _id: { $in: productoIds }, active: true },
      { $set: { tags: [] } }
    );
  }

  async pullTagFromProductos(tagId) {
    if (!tagId) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    return this.model.updateMany(
      { tags: tagId, active: true },
      { $pull: { tags: tagId } }
    );
  }
}

module.exports = ProductoRepository;