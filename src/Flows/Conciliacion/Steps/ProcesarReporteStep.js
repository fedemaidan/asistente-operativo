const FlowManager = require("../../../FlowControl/FlowManager");
const botSingleton = require("../../../Utiles/botSingleton");
const {
  getMatchs,
} = require("../../../Utiles/Funciones/Excel/excelMovimientos");
const {
  updateComprobanteToSheet,
  getComprobantesFromSheet,
} = require("../../../Utiles/GoogleServices/Sheets/comprobante");

module.exports = async function ProcesarReporteStep(
  userId,
  movimientoBancario
) {
  const sock = botSingleton.getSock();
  const GOOGLE_SHEET_ID = botSingleton.getSheetIdByUserId(userId);
  await sock.sendMessage(userId, {
    text: "🔄 Procesando...",
  });

  const comprobantesRAW = await getComprobantesFromSheet(GOOGLE_SHEET_ID);
  const matchs = getMatchs(comprobantesRAW, movimientoBancario);
  if (matchs.length === 0) {
    await sock.sendMessage(userId, {
      text: "❌ No se encontraron comprobantes que coincidan con las referencias del archivo Excel.",
    });
    FlowManager.resetFlow(userId);
    return;
  }

  const mensajeExito = `✅ *Procesamiento completado*\n\n📊 Se encontraron ${
    matchs.length
  } ${
    matchs.length === 1 ? "comprobante " : "comprobantes "
  }en el archivo Excel.`;

  sock.sendMessage(userId, {
    text: mensajeExito,
  });

  await updateComprobanteToSheet(matchs, GOOGLE_SHEET_ID);
  await sock.sendMessage(userId, {
    text: `✅ Comprobantes actualizados en la hoja de cálculo. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing`,
  });
  FlowManager.resetFlow(userId);
};
