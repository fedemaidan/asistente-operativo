const {
  subirExcelBufferADrive,
} = require("../Utiles/Funciones/Excel/excelToDrive");
const {
  limpiarDatosVentas,
  limpiarDatosQuiebre,
  limpiarDatosStockDesdeQuiebreExcel,
  safeParseExcelBuffer,
} = require("../Utiles/Funciones/HandleVentasExcel");
const ProyeccionService = require("../services/proyeccionService");
const Proyeccion = require("../models/proyeccion.model");

const proyeccionService = new ProyeccionService();

const parseFechas = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin) {
    throw new Error("Fecha de inicio y fecha de fin son obligatorias");
  }
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    throw new Error("Las fechas ingresadas no son válidas");
  }
  if (inicio >= fin) {
    throw new Error("La fecha de inicio debe ser anterior a la fecha de fin");
  }
  const dateDiff = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
  return {
    fechaInicio: new Date(new Date(inicio).setHours(13, 0, 0, 0)),
    fechaFin: new Date(new Date(fin).setHours(13, 0, 0, 0)),
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
  getProyeccionStatus: async (req, res) => {
    try {
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({ success: false, error: "Se requiere el id de la proyección" });
      }

      const doc = await Proyeccion.findById(id).lean();
      if (!doc) {
        return res.status(404).json({ success: false, error: "No se encontró la proyección" });
      }

      return res.json({
        success: true,
        data: {
          id: doc._id,
          status: doc.status,
          processingError: doc.processingError || null,
          finishedAt: doc.finishedAt || null,
          fechaInicio: doc.fechaInicio || null,
          fechaFin: doc.fechaFin || null,
          links: doc.links || {},
          lastRecalculatedAt: doc.lastRecalculatedAt || null,
          createdAt: doc.createdAt || null,
        },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[proyeccionController] getProyeccionStatus error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },
  createProyeccion: async (req, res) => {
    try {
      const tStart = Date.now();
      let tLast = tStart;

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
      console.log(`[proyeccion:timing] parseVentasExcel: ${Date.now() - tLast}ms`);
      tLast = Date.now();

      const {
        data: stockExcelData,
        success: stockSuccess,
        error: stockError,
      } = safeParseExcelBuffer(quiebreFile);
      const stockParsed = limpiarDatosStockDesdeQuiebreExcel(stockExcelData);
      console.log(`[proyeccion:timing] parseStockExcel: ${Date.now() - tLast}ms`);
      tLast = Date.now();
      let quiebreParsed = null;
      let quiebreSuccess = true;
      let quiebreError = null;
      if (quiebreFile) {
        const parsed = safeParseExcelBuffer(quiebreFile);
        quiebreParsed = limpiarDatosQuiebre(parsed?.data);
        quiebreSuccess = Boolean(parsed?.success);
        quiebreError = parsed?.error || null;
      }
      console.log(`[proyeccion:timing] parseQuiebreExcel: ${Date.now() - tLast}ms`);
      tLast = Date.now();

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
      console.log(`[proyeccion:timing] uploadDriveVentas: ${Date.now() - tLast}ms`);
      tLast = Date.now();

      const driveQuiebre = await subirExcelBufferADrive(
        quiebreFile.buffer,
        quiebreFile.originalname,
        carpetaId,
        quiebreFile.mimetype
      );
      console.log(`[proyeccion:timing] uploadDriveQuiebre: ${Date.now() - tLast}ms`);
      tLast = Date.now();

      const fechas = parseFechas(fechaInicio, fechaFin);
      console.log(`[proyeccion:timing] parseFechas: ${Date.now() - tLast}ms`);
      tLast = Date.now();

      const horizonteDias = horizonte
        ? parseInt(horizonte, 10) || 90
        : 90;

      const proyeccionDoc = await proyeccionService.iniciarProyeccion({
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
      console.log(`[proyeccion:timing] iniciarProyeccion (sync part): ${Date.now() - tLast}ms`);
      console.log(`[proyeccion:timing] TOTAL controller: ${Date.now() - tStart}ms`);

      return res.json({
        success: true,
        idProyeccion: proyeccionDoc?._id,
        status: proyeccionDoc?.status || "procesando",
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
      const msg = error?.message || "";
      const esValidacion =
        msg.includes("obligatorias") || msg.includes("no son válidas") || msg.includes("anterior a la fecha de fin");
      if (esValidacion) {
        return res.status(400).json({ success: false, error: msg });
      }
      console.error(error);
      return res.status(500).json({ success: false, error: msg });
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
