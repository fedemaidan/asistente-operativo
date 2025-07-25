const {
  parseExcelToJson,
} = require("../../../Utiles/Funciones/Excel/excelHandler");
const FlowManager = require("../../../FlowControl/FlowManager");
const {
  limpiarDatosVentas,
  proyectarStock,
} = require("../../../Utiles/Funciones/HandleVentasExcel");
const {
  updateProyeccionToSheet,
} = require("../../../Utiles/GoogleServices/Sheets/proyeccionStock");
const getDatesFromExcel = require("../../../Utiles/Chatgpt/getDatesFromExcel");
const botSingleton = require("../../../Utiles/botSingleton");

module.exports = async function CargarVentasStep(userId, excelRaw) {
  const GOOGLE_SHEET_ID = botSingleton.getSheetIdByUserId(userId);
  const sock = botSingleton.getSock();
  const { stockArray: stockExcelData } =
    FlowManager.userFlows[userId]?.flowData;

  console.log("EXCEL RAW", excelRaw);
  const { data, fileName } = await parseExcelToJson(excelRaw);

  if (!data || Object.keys(data).length === 0) {
    await sock.sendMessage(userId, {
      text: "❌ *Error al procesar el archivo*\n\nEl archivo de ventas parece estar vacío o no tiene el formato esperado.",
    });
    FlowManager.resetFlow(userId);
    return;
  }

  const { date1, date2, dateDiff } = await getDatesFromExcel(fileName);

  const ventasExcelData = limpiarDatosVentas(data);
  const stockProyeccion = await proyectarStock(
    stockExcelData,
    ventasExcelData,
    dateDiff,
    GOOGLE_SHEET_ID
  );

  await updateProyeccionToSheet(
    stockProyeccion,
    `Proyección ${date1} al ${date2}`,
    GOOGLE_SHEET_ID
  );

  FlowManager.resetFlow(userId);
  await sock.sendMessage(userId, {
    text: `Proyección de stock actualizada correctamente. Link: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing`,
  });
};
