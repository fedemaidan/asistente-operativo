const BaseController = require("./baseController");
const ProductosIgnorar = require("../models/productosIngorar.model");

class ProductoIgnorarController extends BaseController {
  constructor() {
    super(ProductosIgnorar);
  }

  async createMany(codigosOrDocs = []) {
    try {
      // Normalizar a documentos { codigo }
      const docs = (codigosOrDocs || []).map((v) =>
        typeof v === "string"
          ? { codigo: v.trim() }
          : { codigo: String(v?.codigo || "").trim() }
      );

      // Filtrar vacíos
      const filtered = docs.filter((d) => d.codigo && d.codigo.length > 0);
      if (filtered.length === 0) return { success: true, data: [] };

      // Dedupe por codigo
      const unique = Array.from(
        new Map(filtered.map((d) => [d.codigo, d])).values()
      );

      // Usar upsert para evitar errores de índice único
      const ops = unique.map((d) => ({
        updateOne: {
          filter: { codigo: d.codigo },
          update: {
            $setOnInsert: {
              codigo: d.codigo,
              descripcion: d.descripcion || null,
            },
          },
          upsert: true,
        },
      }));

      const res = await this.model.bulkWrite(ops, { ordered: false });
      return { success: true, data: res };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ProductoIgnorarController();
