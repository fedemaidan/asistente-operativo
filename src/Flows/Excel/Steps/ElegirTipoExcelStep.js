const FlowManager = require("../../../FlowControl/FlowManager");
const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");
const analizarExcel = require("../../../Utiles/Funciones/Excel/analizarExcel");
const {
  updateComprobanteToSheet,
} = require("../../../Utiles/GoogleServices/Sheets/comprobante");

module.exports = async function ElegirTipoExcelStep(userId, message, sock) {
  const flowData = FlowManager.userFlows[userId].flowData;
  const data = await opcionElegida(message);

  if (data.data.Eleccion == "1") {
    await sock.sendMessage(userId, {
      text: "🔄 Procesando...",
    });

    const matchs = await analizarExcel(flowData, "BANCO");

    if (matchs.length === 0) {
      await sock.sendMessage(userId, {
        text: "❌ No se encontraron comprobantes que coincidan con las referencias del archivo Excel.",
      });
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

    console.log("MATCHS", matchs);

    //TODO: la funcion updateComprobanteToSheet tiene que ser generica. Hacer una especifica para movimientos banco
    await updateComprobanteToSheet(matchs);
    await sock.sendMessage(userId, {
      text: `✅ Comprobantes actualizados en la hoja de cálculo. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing`,
    });
  } else if (data.data.Eleccion == "2") {
  } else if (data.data.Eleccion == "3") {
    await sock.sendMessage(userId, {
      text: "❌ Has cancelado el proceso de confirmación.",
    });
  } else {
    await sock.sendMessage(userId, { text: "Disculpa, no lo he entendido" });
  }
};
