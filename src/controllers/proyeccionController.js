const {
  subirExcelBufferADrive,
} = require("../Utiles/Funciones/Excel/excelToDrive");
const getDatesFromExcel = require("../Utiles/Chatgpt/getDatesFromExcel");
const {
  limpiarDatosVentas,
  limpiarDatosQuiebre,
  limpiarDatosStockDesdeQuiebreExcel,
  safeParseExcelBuffer,
} = require("../Utiles/Funciones/HandleVentasExcel");
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
  getProyeccionesMetadata: async (req, res) => {
    try {
      const { ids } = req.body || {};
      const rawIds = Array.isArray(ids) ? ids : [];
      const uniqueIds = Array.from(new Set(rawIds.map((v) => String(v || "").trim()).filter(Boolean)));

      if (uniqueIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const docs = await Proyeccion.find(
        { _id: { $in: uniqueIds } },
        { fechaInicio: 1, fechaFin: 1, "links.ventas": 1, "links.stock": 1, "links.quiebre": 1 }
      )
        .lean();

      const data = (Array.isArray(docs) ? docs : []).map((d) => ({
        _id: d?._id,
        fechaInicio: d?.fechaInicio ?? null,
        fechaFin: d?.fechaFin ?? null,
        linkVentas: d?.links?.ventas || "",
        linkStock: d?.links?.stock || "",
        tieneQuiebre: Boolean(d?.links?.quiebre),
        linkQuiebre: d?.links?.quiebre || "",
      }));

      return res.json({ success: true, data });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },
  createProyeccion: async (req, res) => {
    try {
      const { fechaInicio, fechaFin, horizonte } = req.body;
      const ventasFile = req.files?.ventas?.[0];
      const quiebreFile = req.files?.quiebre?.[0] || null;

      if (!ventasFile || !quiebreFile) {
        throw new Error("Faltan archivos ventas/quiebre");
      }

      const {
        data: ventasExcelData,
        success: ventasSuccess,
        error: ventasError,
      } = safeParseExcelBuffer(ventasFile);
      const ventasParsed = limpiarDatosVentas(ventasExcelData);

      const {
        data: stockExcelData,
        success: stockSuccess,
        error: stockError,
      } = safeParseExcelBuffer(quiebreFile);
      console.log("[proyeccionController] stock excel data:", stockExcelData);
      const stockParsed = limpiarDatosStockDesdeQuiebreExcel(stockExcelData);
      console.log("[proyeccionController] stock parsed:", stockParsed);
      let quiebreParsed = null;
      let quiebreSuccess = true;
      let quiebreError = null;
      if (quiebreFile) {
        const parsed = safeParseExcelBuffer(quiebreFile);
        const quiebreRaw = Array.isArray(parsed?.data)
          ? parsed.data
          : Object.values(parsed?.data || {});
        console.log(
          "[proyeccionController] quiebre excel crudo (primeras 200 filas):",
          {
            file: quiebreFile?.originalname,
            totalFilas: Array.isArray(quiebreRaw) ? quiebreRaw.length : 0,
            filas: (quiebreRaw || []).slice(0, 200),
          }
        );
        quiebreParsed = limpiarDatosQuiebre(parsed?.data);
        quiebreSuccess = Boolean(parsed?.success);
        quiebreError = parsed?.error || null;
      }

      if (!ventasSuccess || !stockSuccess || !quiebreSuccess) {
        const errorPayload = {
          success: false,
          error: "No se pudieron procesar los archivos Excel",
          ventasError: ventasSuccess ? null : ventasError,
          stockError: stockSuccess ? null : stockError,
          quiebreError: quiebreSuccess ? null : quiebreError,
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
      const driveQuiebre = await subirExcelBufferADrive(
        quiebreFile.buffer,
        quiebreFile.originalname,
        carpetaId,
        quiebreFile.mimetype
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
        quiebreData: Array.isArray(quiebreParsed) ? quiebreParsed : [],
        dateDiff: fechas.dateDiff,
        horizonte: horizonteDias,
        fechaBase: fechas.fechaFin,
        fechaInicio: fechas.fechaInicio,
        fechaFin: fechas.fechaFin,
        links: {
          ventas: driveVentas?.driveUrl,
          stock: driveQuiebre?.driveUrl || "",
          quiebre: driveQuiebre?.driveUrl || "",
        },
      });

      return res.json({
        ...proyeccion,
        links: {
          ventas: driveVentas?.driveUrl,
          stock: driveQuiebre?.driveUrl || "",
          quiebre: driveQuiebre?.driveUrl || "",
        },
        fechas: {
          fechaInicio: fechas.fechaInicio,
          fechaFin: fechas.fechaFin,
          dateDiff: fechas.dateDiff,
          horizonteDias,
        },
      });
    } catch (error) {
      const payload = error?.payload;
      if (payload) {
        return res.status(400).json(payload);
      }
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
  create: async (payload) => {
    try {
      const {
        fechaInicio = null,
        fechaFin = null,
        linkStock = null,
        linkVentas = null,
        linkQuiebre = null,
        dateDiff = 0,
        horizonte = 90,
      } = payload || {};

      const doc = await Proyeccion.create({
        active: false,
        fechaInicio,
        fechaFin,
        fechaBase: fechaFin || null,
        dateDiff: Number(dateDiff) || 0,
        horizonte: Number(horizonte) || 90,
        links: { stock: linkStock || "", ventas: linkVentas || "", quiebre: linkQuiebre || "" },
        ventasData: [],
        stockData: [],
        quiebreData: [],
      });
      return { success: true, data: doc };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
