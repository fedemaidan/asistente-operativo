const ProductoRepository = require("../repository/productoRepository");
const Tag = require("../models/tag.model");


class ProductoService {
  constructor() {
    this.productoRepository = new ProductoRepository();
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async buildTextFilter(text) {
    const raw = typeof text === "string" ? text.trim() : "";
    if (!raw) return null;

    const regex = new RegExp(this.escapeRegExp(raw), "i");

    const tags = await Tag.find({ nombre: regex }, { _id: 1 }).lean();
    const tagIds = Array.isArray(tags) ? tags.map((t) => t._id).filter(Boolean) : [];

    const or = [{ nombre: regex }, { codigo: regex }];
    if (tagIds.length > 0) {
      or.push({ tags: { $in: tagIds } });
    }

    return { $or: or };
  }

  async getAll(options = {}) {
    try {
      const { sort = { createdAt: -1 }, text } = options;
      const filter = await this.buildTextFilter(text);
      const data = await this.productoRepository.getAllActive({ sort, filter });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAllPaginated(options = {}) {
    try {
      const {
        limit = 200,
        offset = 0,
        sort = { createdAt: -1 },
        page,
        text,
      } = options;

      const filter = await this.buildTextFilter(text);
      const result = await this.productoRepository.getPaginated({
        limit,
        offset,
        sort,
        filter,
      });

      const safeLimit = limit > 0 ? limit : 1;
      const computedPage = page ?? Math.floor((result.offset ?? 0) / safeLimit) + 1;
      const totalPages = Math.ceil((result.total ?? 0) / safeLimit);

      return {
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.hasMore,
          page: computedPage,
          totalPages,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateProducto(id, data = {}, options = {}) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del producto es requerido",
          statusCode: 400,
        };
      }

      if (!data || Object.keys(data).length === 0) {
        return {
          success: false,
          error: "No hay campos válidos para actualizar",
          statusCode: 400,
        };
      }

      const updated = await this.productoRepository.updateById(id, data, options);

      if (!updated) {
        return {
          success: false,
          error: "Producto no encontrado",
          statusCode: 404,
        };
      }

      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTagsResumen() {
    try {
      const tags = await Tag.find({}, { nombre: 1 }).lean();
      if (!Array.isArray(tags) || tags.length === 0) {
        return { success: true, data: [] };
      }

      const productosConTags = await this.productoRepository.getTagsUsageByProductoCodigo();

      const tagIdToCodigos = new Map();
      for (const tag of tags) {
        tagIdToCodigos.set(tag._id.toString(), []);
      }

      for (const p of productosConTags) {
        const codigo = p?.codigo;
        const tagIds = Array.isArray(p?.tags) ? p.tags : [];
        if (!codigo || tagIds.length === 0) continue;

        for (const tagId of tagIds) {
          const key = tagId?.toString?.() ? tagId.toString() : String(tagId);
          if (!tagIdToCodigos.has(key)) continue;
          tagIdToCodigos.get(key).push(codigo);
        }
      }

      const data = tags
        .map((t) => {
          const codigos = tagIdToCodigos.get(t._id.toString()) || [];
          const uniqueCodigos = Array.from(new Set(codigos)).sort();
          return { _id: t._id, nombre: t.nombre, codigos: uniqueCodigos };
        })
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async actualizarTag(id, nombre) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del tag es requerido",
          statusCode: 400,
        };
      }
      if (!nombre || !String(nombre).trim()) {
        return {
          success: false,
          error: "El nombre del tag es requerido",
          statusCode: 400,
        };
      }

      const updated = await Tag.findByIdAndUpdate(
        id,
        { nombre: String(nombre).trim() },
        { new: true, runValidators: true }
      ).lean();

      if (!updated) {
        return {
          success: false,
          error: "Tag no encontrado",
          statusCode: 404,
        };
      }

      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async eliminarTag(id) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del tag es requerido",
          statusCode: 400,
        };
      }

      const tag = await Tag.findById(id).lean();
      if (!tag) {
        return {
          success: false,
          error: "Tag no encontrado",
          statusCode: 404,
        };
      }

      await this.productoRepository.pullTagFromProductos(id);
      await Tag.findByIdAndDelete(id);

      return { success: true, data: tag };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async eliminarTagsDeProductos(productoIds = []) {
    try {
      if (!Array.isArray(productoIds) || productoIds.length === 0) {
        return {
          success: false,
          error: "productoIds es requerido",
          statusCode: 400,
        };
      }

      const result = await this.productoRepository.clearTagsByProductoIds(productoIds);

      return {
        success: true,
        data: {
          matchedCount: result?.matchedCount ?? result?.n ?? 0,
          modifiedCount: result?.modifiedCount ?? result?.nModified ?? 0,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async agregarTagAProductos(productoIds = [], tagNombre) {
    try {
      if (!Array.isArray(productoIds) || productoIds.length === 0) {
        return {
          success: false,
          error: "productoIds es requerido",
          statusCode: 400,
        };
      }

      const nombre = String(tagNombre || "").trim();
      if (!nombre) {
        return {
          success: false,
          error: "tagNombre es requerido",
          statusCode: 400,
        };
      }

      let tag = await Tag.findOne({ nombre }).lean();

      if (!tag) {
        try {
          const created = await Tag.create({ nombre });
          tag = created.toObject ? created.toObject() : created;
        } catch (e) {
          // Si se creó en paralelo (unique), reintentar buscar
          tag = await Tag.findOne({ nombre }).lean();
          if (!tag) throw e;
        }
      }

      const result = await this.productoRepository.model.updateMany(
        { _id: { $in: productoIds }, active: true },
        { $addToSet: { tags: tag._id } }
      );

      return {
        success: true,
        data: {
          tag,
          matchedCount: result?.matchedCount ?? result?.n ?? 0,
          modifiedCount: result?.modifiedCount ?? result?.nModified ?? 0,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteProducto(id) {
    try {
      if (!id) {
        return {
          success: false,
          error: "El ID del producto es requerido",
          statusCode: 400,
        };
      }

      const deleted = await this.productoRepository.softDeleteProducto(id);

      if (!deleted) {
        return {
          success: false,
          error: "Producto no encontrado",
          statusCode: 404,
        };
      }

      return { success: true, data: deleted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createManyProductos(productos = []) {
    try {
      const created = await this.productoRepository.createMany(productos);
      return { success: true, data: created };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async upsertManyByCodigo(productos = []) {
    try {
      const result = await this.productoRepository.upsertManyByCodigo(productos);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async findByCodigos(codigos = []) {
    try {
      const data = await this.productoRepository.findByCodigos(codigos);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ProductoService;