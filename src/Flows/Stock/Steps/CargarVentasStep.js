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

module.exports = async function CargarVentasStep(userId, excelRaw, sock) {
  const { stockArray: stockExcelData } =
    FlowManager.userFlows[userId]?.flowData;

  const { data } = await parseExcelToJson(excelRaw);

  if (!data || Object.keys(data).length === 0) {
    await sock.sendMessage(userId, {
      text: "❌ *Error al procesar el archivo*\n\nEl archivo de ventas parece estar vacío o no tiene el formato esperado.",
    });
    FlowManager.resetFlow();
    return;
  }

  console.log("stockExcelData", stockExcelData);
  const ventasExcelData = limpiarDatosVentas(data);
  const stockProyeccion = proyectarStock(stockExcelData, ventasExcelData);

  console.log("STOCK PROYECCION", stockProyeccion.slice(0, 10));

  await updateProyeccionToSheet(stockProyeccion);

  FlowManager.resetFlow(userId);
  await sock.sendMessage(userId, {
    text: `Proyección de stock actualizada correctamente. Link: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing`,
  });
};
