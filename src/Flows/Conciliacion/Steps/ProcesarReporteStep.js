const FlowManager = require("../../../FlowControl/FlowManager");
const botSingleton = require("../../../Utiles/botSingleton");
const {
  getMatchs,
} = require("../../../Utiles/Funciones/Excel/excelMovimientos");
const {
  getComprobantesFromMongo,
} = require("../../../Utiles/Funciones/comprobantes");
const movimientoController = require("../../../controllers/movimientoController");

module.exports = async function ProcesarReporteStep(
  userId,
  movimientosBancario
) {
  const user = botSingleton.getUsuarioByUserId(userId);
  const sock = botSingleton.getSock();
  await sock.sendMessage(userId, {
    text: "🔄 Procesando...",
  });

  console.log("ProcesarReporteStep - movimientosBancario", movimientosBancario);
  
  if (!movimientosBancario || movimientosBancario.length === 0) {
    await sock.sendMessage(userId, {
      text: "❌ No se encontraron movimientos bancarios en el archivo. " + userId ,
    });
    FlowManager.resetFlow(userId);
    return;
  }

  if (!movimientosBancario[0].caja) {
    await sock.sendMessage(userId, {
      text: "❌ No se pudo identificar la caja en el archivo." + userId,
    });
    FlowManager.resetFlow(userId);
    return;
  }

  //const comprobantesRAW = await getComprobantesFromSheet(GOOGLE_SHEET_ID);
  const comprobantesRAW = await getComprobantesFromMongo(
    movimientosBancario[0].caja
  );

  const matchs = getMatchs(comprobantesRAW, movimientosBancario);
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

  //await updateComprobanteToSheet(matchs, GOOGLE_SHEET_ID);

  const resp = await movimientoController.actualizarEstados(
    matchs.map((m) => m.comprobante.id),
    user
  );

  console.log("respController", resp);
  await sock.sendMessage(userId, {
    text: `✅ Comprobantes actualizados en la hoja de cálculo. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing`,
  });
  FlowManager.resetFlow(userId);
};
