const BaseController = require("./baseController");
const StockProyeccion = require("../models/productoProyeccion.model");
const ProductosIgnorar = require("../models/productosIngorar.model");

class StockProyeccionController extends BaseController {
  constructor() {
    super(StockProyeccion);
  }

  async getStockPorProyeccionId(proyeccionId) {
    try {
      const result = await this.model.find({ proyeccionId });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async eliminarYAgregarIgnorados(ids = []) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: "ids requerido" };
      }

      // Obtener productos a eliminar
      const productos = await this.model.find({ _id: { $in: ids } });

      // Preparar operaciones upsert para productos a ignorar (por codigo)
      const ops = productos
        .map((p) =>
          p?.codigo
            ? {
                updateOne: {
                  filter: { codigo: p.codigo },
                  update: {
                    $setOnInsert: {
                      codigo: p.codigo,
                      descripcion: p.descripcion || null,
                    },
                  },
                  upsert: true,
                },
              }
            : null
        )
        .filter(Boolean);

      if (ops.length > 0) {
        await ProductosIgnorar.bulkWrite(ops, { ordered: false });
      }

      // Eliminar productos de la proyección
      const deleteRes = await this.model.deleteMany({ _id: { $in: ids } });

      return {
        success: true,
        data: {
          ignoradosUpserted: ops.length,
          eliminados: deleteRes?.deletedCount || 0,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new StockProyeccionController();
