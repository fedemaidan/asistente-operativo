const {
  parseJsonBancoToInfo,
  getMatchs,
} = require("../../../Utiles/Funciones/Excel/excelMovimientos");
const {
  updateComprobanteToSheet,
  parseComprobantes,
} = require("../../../Utiles/GoogleServices/Sheets/comprobante");
const { getRowsValues } = require("../../../Utiles/GoogleServices/General");
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

module.exports = async function ProcesarReporteStep(userId, data, sock) {
  await sock.sendMessage(userId, {
    text: "🔄 Procesando...",
  });

  const dataComprobantes = await getRowsValues(
    GOOGLE_SHEET_ID,
    "ComprobanteRAW",
    "A2:M1000"
  );
  const comprobantesRAW = parseComprobantes(dataComprobantes);
  const matchs = getMatchs(comprobantesRAW, data);

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

  //TODO: la funcion updateComprobanteToSheet tiene que ser generica. Hacer una especifica para movimientos banco
  await updateComprobanteToSheet(matchs);
  await sock.sendMessage(userId, {
    text: `✅ Comprobantes actualizados en la hoja de cálculo. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing`,
  });
};
