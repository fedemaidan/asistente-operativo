const BaseRepository = require('./baseRepository');
const Producto = require('../models/producto.model');

class ProductoRepository extends BaseRepository {
  constructor() {
    super(Producto);
  }

  normalizeCodigo(codigo) {
    return typeof codigo === "string" ? codigo.trim().toUpperCase() : String(codigo || "").trim().toUpperCase();
  }

  normalizeCodigos(codigos = []) {
    return Array.isArray(codigos)
      ? codigos.map((c) => this.normalizeCodigo(c)).filter((c) => Boolean(c))
      : [];
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

  async findByCodigos(codigos = [], options = {}) {
    const normalized = this.normalizeCodigos(codigos);
    if (normalized.length === 0) return [];
    const { select = null } = options;
    return this.find({ codigo: { $in: normalized } }, { select });
  }

  /**
   * Upsert por codigo (evita duplicados cuando codigo es unique).
   * Solo inserta si no existe; no pisa datos existentes.
   */
  async upsertManyByCodigo(productos = []) {
    const rows = Array.isArray(productos) ? productos : [];
    if (rows.length === 0) return { success: true, upserts: 0 };

    const ops = rows
      .map((p) => {
        const codigo = this.normalizeCodigo(p?.codigo);
        if (!codigo) return null;
        return {
          updateOne: {
            filter: { codigo },
            update: {
              $setOnInsert: {
                ...p,
                codigo,
                active: p?.active ?? true,
              },
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean);

    if (ops.length === 0) return { success: true, upserts: 0 };

    const result = await this.model.bulkWrite(ops, { ordered: false });
    const upserts = result?.upsertedCount ?? 0;
    return { success: true, upserts };
  }

  async updateProyeccionFields(id, payload) {
    return this.updateById(id, payload, { new: true });
  }

  /** Tamaño de cada batch para bulkUpdate (evita payloads gigantes y mejora throughput) */
  static BULK_UPDATE_BATCH_SIZE = 500;

  /**
   * Actualiza campos de proyección de muchos productos en operaciones bulk por lotes.
   * Ejecuta batches en paralelo para reducir tiempo total.
   * @param {Array<{id: string|ObjectId, payload: Object}>} updates - Array de { id, payload }
   * @returns {Promise<{ modifiedCount: number }>}
   */
  async bulkUpdateProyeccionFields(updates = []) {
    const valid = updates.filter((u) => u?.id && u?.payload && Object.keys(u.payload).length > 0);
    if (valid.length === 0) return { modifiedCount: 0 };

    const batchSize = this.constructor.BULK_UPDATE_BATCH_SIZE;
    const batches = [];
    for (let i = 0; i < valid.length; i += batchSize) {
      batches.push(valid.slice(i, i + batchSize));
    }

    const runBatch = (batch) => {
      const ops = batch.map((u) => ({
        updateOne: { filter: { _id: u.id }, update: { $set: u.payload } },
      }));
      return this.model.bulkWrite(ops, {
        ordered: false,
        bypassDocumentValidation: true,
      });
    };

    const results = await Promise.all(batches.map(runBatch));
    const modifiedCount = results.reduce((acc, r) => acc + (r?.modifiedCount ?? 0), 0);
    return { modifiedCount };
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

  async addNota(productoId, notaDoc) {
    if (!productoId) return null;
    return this.model
      .findOneAndUpdate(
        { _id: productoId, active: true },
        { $push: { notas: notaDoc } },
        { new: true, runValidators: true }
      )
      .populate({ path: "tags", select: "nombre" })
      .lean();
  }

  async updateNota(productoId, notaId, updateData) {
    if (!productoId || !notaId) return null;
    return this.model
      .findOneAndUpdate(
        { _id: productoId, active: true, "notas._id": notaId },
        {
          $set: {
            ...(updateData?.nota !== undefined ? { "notas.$.nota": updateData.nota } : {}),
            ...(updateData?.updatedAt ? { "notas.$.updatedAt": updateData.updatedAt } : {}),
          },
        },
        { new: true, runValidators: true }
      )
      .populate({ path: "tags", select: "nombre" })
      .lean();
  }

  async deleteNota(productoId, notaId) {
    if (!productoId || !notaId) return null;
    return this.model
      .findOneAndUpdate(
        { _id: productoId, active: true },
        { $pull: { notas: { _id: notaId } } },
        { new: true, runValidators: true }
      )
      .populate({ path: "tags", select: "nombre" })
      .lean();
  }

  async hasNota(productoId, notaId) {
    if (!productoId || !notaId) return false;
    const doc = await this.model
      .findOne({ _id: productoId, active: true, "notas._id": notaId }, { _id: 1 })
      .lean();
    return Boolean(doc?._id);
  }
}

module.exports = ProductoRepository;