const FlowManager = require("../../../FlowControl/FlowManager");
const {
  addComprobanteToSheet,
} = require("../../../Utiles/GoogleServices/Sheets/comprobante");
const botSingleton = require("../../../Utiles/botSingleton");
const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");

module.exports = async function ConfirmacionDuplicadoStep(userId, message) {
  const sock = botSingleton.getSock();
  const GOOGLE_SHEET_ID = botSingleton.getSheetIdByUserId(userId);
  const comprobante = FlowManager.userFlows[userId].flowData;
  const data = await opcionElegida(message);

  if (data.data.Eleccion == "1") {
    await addComprobanteToSheet(comprobante, GOOGLE_SHEET_ID);
    await sock.sendMessage(userId, {
      text: `✅ *Comprobante agregado a pesar del posible duplicado. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing*`,
    });
    FlowManager.resetFlow(userId);
  } else if (data.data.Eleccion == "2") {
    await sock.sendMessage(userId, {
      text: "❌ *Operación cancelada. El comprobante no fue agregado.*",
    });
    FlowManager.resetFlow(userId);
  } else {
    await sock.sendMessage(userId, {
      text: "Disculpa, no lo he entendido. Por favor, elige una de las opciones disponibles (1 o 2).",
    });
  }
};
