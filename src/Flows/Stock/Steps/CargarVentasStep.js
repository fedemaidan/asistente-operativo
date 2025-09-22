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
const stockProyeccionController = require("../../../controllers/stockProyeccionController");
const proyeccionController = require("../../../controllers/proyeccionController");

module.exports = async function CargarVentasStep(userId, data) {
  try {
    const { driveUrl: ventasDriveUrl, data: excelData, fileName } = data;
    const GOOGLE_SHEET_ID = botSingleton.getSheetIdByUserId(userId);
    const sock = botSingleton.getSock();
    const { excelJson: stockExcelData, driveUrl: stockDriveUrl } =
      FlowManager.userFlows[userId]?.flowData;

    if (!excelData || Object.keys(excelData).length === 0) {
      await sock.sendMessage(userId, {
        text: "❌ *Error al procesar el archivo*\n\nEl archivo de ventas parece estar vacío o no tiene el formato esperado.",
      });
      FlowManager.resetFlow(userId);
      return;
    }

    const { date1, date2, dateDiff } = await getDatesFromExcel(fileName);
    const { data: proyeccion, error: proyeccionError } =
      await proyeccionController.create({
        fechaInicio: new Date(date1),
        fechaFin: new Date(date2),
        linkStock: stockDriveUrl || null,
        linkVentas: ventasDriveUrl || null,
      });

    if (proyeccionError) {
      throw new Error(proyeccionError);
    }

    const ventasExcelData = limpiarDatosVentas(excelData);
    const stockProyeccion = await proyectarStock(
      stockExcelData,
      ventasExcelData,
      dateDiff,
      GOOGLE_SHEET_ID,
      proyeccion._id
    );

    // await updateProyeccionToSheet(
    //   stockProyeccion,
    //   `Proyección ${date1} al ${date2}`,
    //   GOOGLE_SHEET_ID
    // );

    const {
      success,
      data: stockProyeccionSaved,
      error,
    } = await stockProyeccionController.createMany(stockProyeccion);
    if (!success) {
      console.log("error", error);
      await sock.sendMessage(userId, {
        text: `❌ *Error al procesar el archivo*`,
      });
      FlowManager.resetFlow(userId);
      return;
    }
    FlowManager.resetFlow(userId);
    await sock.sendMessage(userId, {
      text: `Proyección de stock actualizada correctamente. Link: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing`,
    });
  } catch (error) {
    console.log("error", error);
    await sock.sendMessage(userId, {
      text: "❌ *Error al procesar el archivo*\n\nEl archivo de ventas parece estar vacío o no tiene el formato esperado.",
    });
    FlowManager.resetFlow(userId);
    return;
  }
};
