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

  async getAll(query = {}, populate = "") {
    try {
      const documents = await this.model.find(query).populate(populate);
      return { success: true, data: documents };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getById(id, populate = "") {
    try {
      const document = await this.model.findById(id).populate(populate);
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
      const updatedDocument = await this.model.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
      });
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
