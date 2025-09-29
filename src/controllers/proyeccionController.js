const BaseController = require("./baseController");
const Proyeccion = require("../models/proyeccion.model");
const { excelBufferToJson } = require("../Utiles/Funciones/Excel/excelHandler");
const {
  subirExcelBufferADrive,
} = require("../Utiles/Funciones/Excel/excelToDrive");
const getDatesFromExcel = require("../Utiles/Chatgpt/getDatesFromExcel");
const {
  proyectarStock,
  limpiarDatosVentas,
} = require("../Utiles/Funciones/HandleVentasExcel");
const stockProyeccionController = require("./stockProyeccionController");
const Tag = require("../models/tag.model");
const ProductoProyeccion = require("../models/productoProyeccion.model");

class ProyeccionController extends BaseController {
  constructor() {
    super(Proyeccion);
  }

  async createProyeccion({ fechaInicio, fechaFin, ventasFile, stockFile }) {
    if (!ventasFile || !stockFile) {
      throw new Error("Faltan archivos ventas/stock");
    }

    const {
      data: ventasExcelData,
      success: ventasSuccess,
      error: ventasError,
    } = excelBufferToJson(ventasFile.buffer);
    const ventasParsed = limpiarDatosVentas(ventasExcelData);

    const {
      data: stockParsed,
      success: stockSuccess,
      error: stockError,
    } = excelBufferToJson(stockFile.buffer);

    if (!ventasSuccess || !stockSuccess) {
      const errorPayload = {
        success: false,
        error: "No se pudieron procesar los archivos Excel",
        ventasError: ventasSuccess ? null : ventasError,
        stockError: stockSuccess ? null : stockError,
      };
      const err = new Error(errorPayload.error);
      err.payload = errorPayload;
      throw err;
    }

    const carpetaId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const driveVentas = await subirExcelBufferADrive(
      ventasFile.buffer,
      ventasFile.originalname,
      carpetaId,
      ventasFile.mimetype
    );
    const driveStock = await subirExcelBufferADrive(
      stockFile.buffer,
      stockFile.originalname,
      carpetaId,
      stockFile.mimetype
    );

    const { date1, date2, dateDiff } = await getDatesFromExcel(
      ventasFile.originalname
    );

    let computedFechaInicio, computedFechaFin, computedDateDiff;

    // Si ambas fechas son válidas y fechaInicio < fechaFin, usamos esas
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      if (!isNaN(inicio) && !isNaN(fin) && inicio < fin) {
        computedFechaInicio = new Date(inicio);
        computedFechaInicio.setHours(13, 0, 0, 0);
        computedFechaFin = new Date(fin);
        computedFechaFin.setHours(13, 0, 0, 0);
        computedDateDiff = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
      }
    }

    // Si no tenemos fechas válidas, usamos las del nombre del archivo
    if (!computedFechaInicio || !computedFechaFin) {
      computedFechaInicio = new Date(date1);
      computedFechaInicio.setHours(13, 0, 0, 0);
      computedFechaFin = new Date(date2);
      computedFechaFin.setHours(13, 0, 0, 0);
      computedDateDiff = dateDiff;
    }

    const { data: proyeccion, error: proyeccionError } = await this.create({
      fechaInicio: computedFechaInicio,
      fechaFin: computedFechaFin,
      linkStock: driveStock.driveUrl,
      linkVentas: driveVentas.driveUrl,
    });

    if (proyeccionError) {
      const err = new Error("Error al crear la proyección");
      err.payload = { success: false, proyeccionError };
      throw err;
    }

    const stockProyeccion = await proyectarStock(
      stockParsed,
      ventasParsed,
      computedDateDiff,
      "GOOGLE_SHEET_ID",
      proyeccion._id
    );

    await stockProyeccionController.createMany(stockProyeccion);

    return {
      success: true,
      data: {
        proyeccion,
      },
    };
  }

  async agregarTags(productosProyeccionId, tag, persist = false) {
    try {
      if (persist) {
        const productos = await ProductoProyeccion.find(
          { _id: { $in: productosProyeccionId } },
          {
            codigo: 1,
          }
        );
        const codigos = Array.from(
          new Set(
            productos
              .map((p) => (p?.codigo || "").toString().trim())
              .filter((c) => c && c.length > 0)
          )
        );

        if (codigos.length === 0) {
          return {
            success: false,
            error: "No se encontraron códigos para los productos seleccionados",
          };
        }

        const upsertRes = await Tag.updateOne(
          { nombre: tag },
          { $addToSet: { codigos: { $each: codigos } } },
          { upsert: true }
        );

        return { success: true, data: { tagUpsert: upsertRes } };
      }

      const updatedProductosProyeccion = await ProductoProyeccion.updateMany(
        { _id: { $in: productosProyeccionId } },
        { $addToSet: { tags: tag } }
      );

      return { success: true, data: updatedProductosProyeccion };
    } catch (error) {
      console.error(error);
      return { success: false, error: error.message };
    }
  }

  async getTags() {
    try {
      const tags = await Tag.find({});
      return { success: true, data: tags };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ProyeccionController();
