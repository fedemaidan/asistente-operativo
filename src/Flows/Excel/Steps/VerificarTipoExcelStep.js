const FlowManager = require("../../../FlowControl/FlowManager");
const botSingleton = require("../../../Utiles/botSingleton");

module.exports = async function VerificarTipoExcelStep(userId, data) {
  const sock = botSingleton.getSock();
  const { type } = data.data;

  console.log("data", data);

  const mensaje =
    `📊 *Archivo ${type} Detectado* 📊\n\n` +
    `Hemos recibido tu archivo ${type} correctamente. Para procesarlo de la manera adecuada, necesitamos saber qué tipo de información contiene.\n\n` +
    `Por favor, selecciona una opción:\n\n` +
    `*1.* 🏦 *Reporte Banco*\n` +
    `*2.* 💰 *Reporte Financiera*\n` +
    `*3.* 🧾 *Reporte Stock*\n` +
    `*4.* ❌ *Cancelar*\n\n` +
    `Responde con el número de la opción que corresponda (1, 2, 3 o 4).`;

  await sock.sendMessage(userId, {
    text: mensaje,
  });

  FlowManager.setFlow(userId, "EXCEL", "ElegirTipoExcelStep", {
    excelJson: data.data.data,
    fileName: data.fileName,
    type: type,
    driveUrl: data.driveUrl,
  });
};
