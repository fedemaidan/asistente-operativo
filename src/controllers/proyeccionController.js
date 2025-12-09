const { excelBufferToJson } = require("../Utiles/Funciones/Excel/excelHandler");
const {
  subirExcelBufferADrive,
} = require("../Utiles/Funciones/Excel/excelToDrive");
const getDatesFromExcel = require("../Utiles/Chatgpt/getDatesFromExcel");
const { limpiarDatosVentas } = require("../Utiles/Funciones/HandleVentasExcel");
const ProyeccionService = require("../services/proyeccionService");
const Proyeccion = require("../models/proyeccion.model");

const proyeccionService = new ProyeccionService();

const parseFechas = async (ventasFileName, fechaInicio, fechaFin) => {
  const { date1, date2, dateDiff } = await getDatesFromExcel(ventasFileName);

  if (fechaInicio && fechaFin) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    if (!isNaN(inicio) && !isNaN(fin) && inicio < fin) {
      const computedDateDiff = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
      return {
        fechaInicio: new Date(inicio.setHours(13, 0, 0, 0)),
        fechaFin: new Date(fin.setHours(13, 0, 0, 0)),
        dateDiff: computedDateDiff,
      };
    }
  }

  return {
    fechaInicio: new Date(new Date(date1).setHours(13, 0, 0, 0)),
    fechaFin: new Date(new Date(date2).setHours(13, 0, 0, 0)),
    dateDiff,
  };
};

module.exports = {
  createProyeccion: async ({ fechaInicio, fechaFin, ventasFile, stockFile, horizonte }) => {
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

    const fechas = await parseFechas(
      ventasFile.originalname,
      fechaInicio,
      fechaFin
    );

    const horizonteDias = horizonte
      ? parseInt(horizonte, 10) || 90
      : 90;

    const proyeccion = await proyeccionService.generarProyeccion({
      ventasData: ventasParsed,
      stockData: stockParsed,
      dateDiff: fechas.dateDiff,
      horizonte: horizonteDias,
    });

    return {
      ...proyeccion,
      links: {
        ventas: driveVentas?.driveUrl,
        stock: driveStock?.driveUrl,
      },
      fechas: {
        fechaInicio: fechas.fechaInicio,
        fechaFin: fechas.fechaFin,
        dateDiff: fechas.dateDiff,
        horizonteDias,
      },
    };
  },
  // Compatibilidad con flujos previos del bot
  create: async (payload) => {
    try {
      const doc = await Proyeccion.create(payload);
      return { success: true, data: doc };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
