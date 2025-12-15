const BaseRepository = require('./baseRepository');
const ProductosIgnorar = require('../models/productosIngorar.model');

class ProductoIgnorarRepository extends BaseRepository {
  constructor() {
    super(ProductosIgnorar);
  }

  async upsertManyByCodigos(codigos = []) {
    if (!Array.isArray(codigos) || codigos.length === 0) {
      return { upsertedCount: 0, matchedCount: 0, modifiedCount: 0 };
    }

    const uniqueCodigos = Array.from(
      new Set(codigos.map((c) => String(c).trim()).filter(Boolean))
    );

    if (uniqueCodigos.length === 0) {
      return { upsertedCount: 0, matchedCount: 0, modifiedCount: 0 };
    }

    const ops = uniqueCodigos.map((codigo) => ({
      updateOne: {
        filter: { codigo },
        update: { $setOnInsert: { codigo } },
        upsert: true,
      },
    }));

    const result = await this.model.bulkWrite(ops, { ordered: false });
    return {
      upsertedCount: result?.upsertedCount ?? 0,
      matchedCount: result?.matchedCount ?? 0,
      modifiedCount: result?.modifiedCount ?? 0,
    };
  }
}

module.exports = ProductoIgnorarRepository;