const FlowManager = require("../../../FlowControl/FlowManager");
const {
  parseExcelToJson,
} = require("../../../Utiles/Funciones/Excel/excelHandler");

module.exports = async function VerificarTipoExcelStep(userId, message, sock) {
  const { data, success, error } = await parseExcelToJson(message);
  if (!success) {
    await sock.sendMessage(userId, {
      text: "❌ No se pudo procesar el archivo Excel.",
    });
    console.log("❌ No se encontró un documento Excel válido.", error);
    return;
  }

  const mensaje =
    `📊 *Archivo Excel Detectado* 📊\n\n` +
    `Hemos recibido tu archivo Excel correctamente. Para procesarlo de la manera adecuada, necesitamos saber qué tipo de información contiene.\n\n` +
    `Por favor, selecciona una opción:\n\n` +
    `*1.* 🏦 *Reporte Banco*\n` +
    `*2.* 💰 *Reporte Financiera*\n` +
    `*3.* 🧾 *Reporte Stock*\n\n` +
    `Responde con el número de la opción que corresponda (1, 2 o 3).`;

  await sock.sendMessage(userId, {
    text: mensaje,
  });

  FlowManager.setFlow(userId, "EXCEL", "ElegirTipoExcelStep", data);
};
