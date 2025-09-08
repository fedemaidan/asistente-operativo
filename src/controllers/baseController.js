const mongoose = require("mongoose");

class BaseController {
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    try {
      const newDocument = new this.model(data);
      const savedDocument = await newDocument.save();
      return { success: true, data: savedDocument };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAllPaginado({
    filter = {},
    populate = "",
    sort = { createdAt: -1 },
    limit = 20,
    offset = 0,
  }) {
    try {
      const total = await this.model.countDocuments(filter);

      let queryBuilder = this.model.find(filter);

      if (sort) {
        // Mapear campos del frontend a campos de la base de datos
        const mappedSort = {};
        Object.keys(sort).forEach((key) => {
          if (key === "montoCC") {
            mappedSort["montoTotal.ars"] = sort[key];
          } else {
            mappedSort[key] = sort[key];
          }
        });
        queryBuilder = queryBuilder.sort(mappedSort);
      }

      if (populate && populate.trim() !== "") {
        const populateFields = populate.split(",").map((field) => field.trim());
        populateFields.forEach((field) => {
          queryBuilder = queryBuilder.populate({
            path: field,
            options: { strictPopulate: false },
          });
        });
      }

      const documents = await queryBuilder.skip(offset).limit(limit);

      return { success: true, data: documents, total };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAll(query = {}, populate = "", options = {}) {
    try {
      const filter = { ...query, ...options.filter };

      let queryBuilder = this.model.find(filter);

      if (options.sort) {
        queryBuilder = queryBuilder.sort(options.sort);
      }

      // Solo hacer populate si se proporciona un valor válido
      if (populate && populate.trim() !== "") {
        const populateFields = populate.split(",").map((field) => field.trim());
        populateFields.forEach((field) => {
          // Configurar populate para manejar campos null
          queryBuilder = queryBuilder.populate({
            path: field,
            options: { strictPopulate: false },
          });
        });
      }

      const documents = await queryBuilder;
      return { success: true, data: documents };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getById(id, populate = "") {
    try {
      let queryBuilder = this.model.findById(id);

      // Solo hacer populate si se proporciona un valor válido
      if (populate && populate.trim() !== "") {
        const populateFields = populate.split(",").map((field) => field.trim());
        populateFields.forEach((field) => {
          // Configurar populate para manejar campos null
          queryBuilder = queryBuilder.populate({
            path: field,
            options: { strictPopulate: false },
          });
        });
      }

      const document = await queryBuilder;
      if (!document) {
        return { success: false, error: "Documento no encontrado" };
      }
      return { success: true, data: document };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async update(id, data) {
    try {
      const updatedDocument = await this.model.findOneAndUpdate(
        { _id: id },
        data,
        {
          new: true,
          runValidators: true,
        }
      );
      if (!updatedDocument) {
        return { success: false, error: "Documento no encontrado" };
      }
      return { success: true, data: updatedDocument };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async delete(id) {
    try {
      const deletedDocument = await this.model.findByIdAndDelete(id);
      if (!deletedDocument) {
        return { success: false, error: "Documento no encontrado" };
      }
      return { success: true, data: deletedDocument };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async count(query = {}) {
    try {
      const count = await this.model.countDocuments(query);
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async search(
    text = "",
    { populate = "", sort = { createdAt: -1 }, filter = {} } = {}
  ) {
    try {
      const searchText = (text || "").trim();
      if (!searchText) {
        return { success: true, data: [], total: 0 };
      }

      // Crear condiciones de búsqueda
      const orConditions = this._buildSearchConditions(searchText);
      if (orConditions.length === 0) {
        return { success: true, data: [], total: 0 };
      }

      // Construir filtro final
      const searchFilter = { $or: orConditions };
      const finalFilter =
        filter && Object.keys(filter).length > 0
          ? { $and: [filter, searchFilter] }
          : searchFilter;

      // Ejecutar consulta
      let query = this.model.find(finalFilter);
      query = this._applySorting(query, sort);
      query = this._applyPopulate(query, populate);

      // Obtener resultados y total
      const [documents, total] = await Promise.all([
        query,
        this.model.countDocuments(finalFilter),
      ]);

      return { success: true, data: documents, total };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _buildSearchConditions(searchText) {
    const schemaPaths = this.model.schema.paths || {};
    const orConditions = [];

    // Buscar en campos de texto
    const regex = new RegExp(
      searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    Object.keys(schemaPaths).forEach((field) => {
      const fieldType = schemaPaths[field];
      if (fieldType && fieldType.instance === "String" && field !== "__v") {
        orConditions.push({ [field]: regex });
      }
    });

    // Buscar en campos numéricos si el texto es un número
    const numericValue = Number(searchText);
    if (!Number.isNaN(numericValue)) {
      Object.keys(schemaPaths).forEach((field) => {
        const fieldType = schemaPaths[field];
        if (fieldType && fieldType.instance === "Number") {
          orConditions.push({ [field]: numericValue });
        }
      });
    }

    // Buscar en campos ObjectId si el texto es un ObjectId válido
    if (mongoose.Types.ObjectId.isValid(searchText)) {
      const objectIdValue = new mongoose.Types.ObjectId(searchText);
      Object.keys(schemaPaths).forEach((field) => {
        const fieldType = schemaPaths[field];
        if (
          fieldType &&
          (fieldType.instance === "ObjectID" ||
            fieldType.instance === "ObjectId")
        ) {
          orConditions.push({ [field]: objectIdValue });
        }
      });
    }

    return orConditions;
  }

  _applySorting(query, sort) {
    if (!sort) return query;

    const mappedSort = {};
    Object.keys(sort).forEach((key) => {
      mappedSort[key === "montoCC" ? "montoTotal.ars" : key] = sort[key];
    });
    return query.sort(mappedSort);
  }

  _applyPopulate(query, populate) {
    if (!populate || !populate.trim()) return query;

    const populateFields = populate.split(",").map((field) => field.trim());
    populateFields.forEach((field) => {
      query = query.populate({
        path: field,
        options: { strictPopulate: false },
      });
    });
    return query;
  }
}

module.exports = BaseController;
