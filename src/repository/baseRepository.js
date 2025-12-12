
class BaseRepository {
  constructor(model) {
    if (!model) {
      throw new Error("Model es requerido para BaseRepository");
    }
    this.model = model;
  }

  /**
   * Crea un nuevo documento
   * @param {Object} data - Datos del documento
   * @returns {Promise<Object>} Documento creado
   */
  async create(data) {
    try {
      const document = new this.model(data);
      return await document.save();
    } catch (error) {
      throw new Error(`Error al crear documento: ${error.message}`);
    }
  }

  /**
   * Crea múltiples documentos
   * @param {Array} dataArray - Array de datos de documentos
   * @returns {Promise<Array>} Documentos creados
   */
  async createMany(dataArray) {
    try {
      return await this.model.insertMany(dataArray);
    } catch (error) {
      throw new Error(`Error al crear múltiples documentos: ${error.message}`);
    }
  }

  /**
   * Busca un documento por ID
   * @param {String|ObjectId} id - ID del documento
   * @param {Object} populate - Campos a popular
   * @returns {Promise<Object|null>} Documento encontrado o null
   */
  async findById(id, populate = null) {
    try {
      let query = this.model.findById(id);
      if (populate) {
        query = query.populate(populate);
      }
      return await query.exec();
    } catch (error) {
      throw new Error(`Error al buscar por ID: ${error.message}`);
    }
  }

  /**
   * Busca un documento por criterios
   * @param {Object} filter - Criterios de búsqueda
   * @param {Object} populate - Campos a popular
   * @returns {Promise<Object|null>} Documento encontrado o null
   */
  async findOne(filter, populate = null) {
    try {
      let query = this.model.findOne(filter);
      if (populate) {
        query = query.populate(populate);
      }
      return await query.exec();
    } catch (error) {
      throw new Error(`Error al buscar documento: ${error.message}`);
    }
  }

  /**
   * Busca múltiples documentos por criterios
   * @param {Object} filter - Criterios de búsqueda
   * @param {Object} options - Opciones de búsqueda (limit, skip, sort, select, populate)
   * @returns {Promise<Array>} Array de documentos encontrados
   */
  async find(filter = {}, options = {}) {
    try {
      const {
        limit = null,
        skip = 0,
        sort = {},
        select = null,
        populate = null
      } = options;

      let query = this.model.find(filter);

      if (skip) query = query.skip(skip);
      if (limit) query = query.limit(limit);
      if (Object.keys(sort).length > 0) query = query.sort(sort);
      if (select) query = query.select(select);
      if (populate) query = query.populate(populate);

      return await query.exec();
    } catch (error) {
      throw new Error(`Error al buscar documentos: ${error.message}`);
    }
  }

  /**
   * Cuenta documentos que coinciden con los criterios
   * @param {Object} filter - Criterios de búsqueda
   * @returns {Promise<Number>} Cantidad de documentos
   */
  async count(filter = {}) {
    try {
      return await this.model.countDocuments(filter);
    } catch (error) {
      throw new Error(`Error al contar documentos: ${error.message}`);
    }
  }

  /**
   * Actualiza un documento por ID
   * @param {String|ObjectId} id - ID del documento
   * @param {Object} updateData - Datos a actualizar
   * @param {Object} options - Opciones de actualización (new, runValidators)
   * @returns {Promise<Object|null>} Documento actualizado o null
   */
  async updateById(id, updateData, options = {}) {
    try {
      const {
        new: returnNew = true,
        runValidators = true
      } = options;

      return await this.model.findByIdAndUpdate(
        id,
        updateData,
        {
          new: returnNew,
          runValidators,
          ...options
        }
      );
    } catch (error) {
      throw new Error(`Error al actualizar por ID: ${error.message}`);
    }
  }

  /**
   * Actualiza un documento por criterios
   * @param {Object} filter - Criterios de búsqueda
   * @param {Object} updateData - Datos a actualizar
   * @param {Object} options - Opciones de actualización
   * @returns {Promise<Object|null>} Documento actualizado o null
   */
  async updateOne(filter, updateData, options = {}) {
    try {
      const {
        new: returnNew = true,
        runValidators = true
      } = options;

      return await this.model.findOneAndUpdate(
        filter,
        updateData,
        {
          new: returnNew,
          runValidators,
          ...options
        }
      );
    } catch (error) {
      throw new Error(`Error al actualizar documento: ${error.message}`);
    }
  }

  /**
   * Actualiza múltiples documentos
   * @param {Object} filter - Criterios de búsqueda
   * @param {Object} updateData - Datos a actualizar
   * @param {Object} options - Opciones de actualización
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateMany(filter, updateData, options = {}) {
    try {
      return await this.model.updateMany(filter, updateData, options);
    } catch (error) {
      throw new Error(`Error al actualizar múltiples documentos: ${error.message}`);
    }
  }

  /**
   * Elimina un documento por ID
   * @param {String|ObjectId} id - ID del documento
   * @returns {Promise<Object|null>} Documento eliminado o null
   */
  async deleteById(id) {
    try {
      return await this.model.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(`Error al eliminar por ID: ${error.message}`);
    }
  }

  /**
   * Elimina un documento por criterios
   * @param {Object} filter - Criterios de búsqueda
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async deleteOne(filter) {
    try {
      return await this.model.deleteOne(filter);
    } catch (error) {
      throw new Error(`Error al eliminar documento: ${error.message}`);
    }
  }

  /**
   * Elimina múltiples documentos
   * @param {Object} filter - Criterios de búsqueda
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async deleteMany(filter) {
    try {
      return await this.model.deleteMany(filter);
    } catch (error) {
      throw new Error(`Error al eliminar múltiples documentos: ${error.message}`);
    }
  }

  /**
   * Marca un documento como inactivo en lugar de eliminarlo
   * @param {String|ObjectId} id - ID del documento
   * @param {Object} options - Opciones adicionales (field, value, extraUpdates, updateOptions)
   * @returns {Promise<Object|null>} Documento actualizado o null
   */
  async softDeleteById(id, options = {}) {
    try {
      const {
        field = "active",
        value = false,
        extraUpdates = {},
        updateOptions = {},
      } = options;

      if (!field) {
        throw new Error("Campo inválido para soft delete");
      }

      return await this.updateById(
        id,
        {
          [field]: value,
          ...extraUpdates,
        },
        {
          new: true,
          runValidators: false,
          ...updateOptions,
        }
      );
    } catch (error) {
      throw new Error(`Error al hacer soft delete: ${error.message}`);
    }
  }

  /**
   * Busca y actualiza un documento (upsert)
   * @param {Object} filter - Criterios de búsqueda
   * @param {Object} updateData - Datos a actualizar/crear
   * @param {Object} options - Opciones de upsert
   * @returns {Promise<Object>} Documento encontrado/creado/actualizado
   */
  async findOneAndUpdate(filter, updateData, options = {}) {
    try {
      const {
        upsert = false,
        new: returnNew = true,
        runValidators = true
      } = options;

      return await this.model.findOneAndUpdate(
        filter,
        updateData,
        {
          upsert,
          new: returnNew,
          runValidators,
          ...options
        }
      );
    } catch (error) {
      throw new Error(`Error en findOneAndUpdate: ${error.message}`);
    }
  }

  /**
   * Ejecuta una agregación
   * @param {Array} pipeline - Pipeline de agregación
   * @returns {Promise<Array>} Resultados de la agregación
   */
  async aggregate(pipeline) {
    try {
      return await this.model.aggregate(pipeline);
    } catch (error) {
      throw new Error(`Error en agregación: ${error.message}`);
    }
  }

  /**
   * Busca documentos con paginación
   * @param {Object} filter - Criterios de búsqueda
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Object>} Objeto con datos, total, página, etc.
   */
  async findWithPagination(filter = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = {},
        select = null,
        populate = null
      } = options;

      const skip = (page - 1) * limit;
      const total = await this.count(filter);
      const totalPages = Math.ceil(total / limit);

      const data = await this.find(filter, {
        skip,
        limit,
        sort,
        select,
        populate
      });

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Error en paginación: ${error.message}`);
    }
  }

  /**
   * Busca documentos con paginación usando offset y limit
   * @param {Object} filter - Criterios de búsqueda
   * @param {Object} options - Opciones de paginación (limit, offset, sort, select, populate)
   * @returns {Promise<Object>} Objeto con data, total, limit, offset
   */
  async findPaginated(filter = {}, options = {}) {
    try {
      const {
        limit = 200,
        offset = 0,
        sort = {},
        select = null,
        populate = null
      } = options;

      const total = await this.count(filter);

      const data = await this.find(filter, {
        skip: offset,
        limit,
        sort,
        select,
        populate
      });

      return {
        data,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total
      };
    } catch (error) {
      throw new Error(`Error en paginación con offset: ${error.message}`);
    }
  }
}

module.exports = BaseRepository;
