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
}

module.exports = BaseController;
