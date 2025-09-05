const botSingleton = require("../../../../src/Utiles/botSingleton");
const flowManager = require("../../../FlowControl/FlowManager");

module.exports = async function GuardarArchivoStep(userId, data) {
  console.log("GuardarArchivoStep", data);

  const sock = botSingleton.getSock();
  const carpetaId = botSingleton.getDriveFolderIdByUserId(userId);

  const { success, data: fileData } = data;

  if (success && fileData) {
    const fileName = fileData.name || "archivo";
    await sock.sendMessage(userId, {
      text: `✅ *¡Archivo guardado exitosamente!*\n\n📁 *Nombre:* ${fileName}\n🔗 *Ver carpeta:* https://drive.google.com/drive/folders/${carpetaId}?usp=drive_link`,
    });

    flowManager.resetFlow(userId);
  } else {
    await sock.sendMessage(userId, {
      text: "❌ *Error al guardar el archivo*\n\n😔 No se pudo subir tu archivo a Google Drive. Por favor, inténtalo nuevamente.",
    });
    flowManager.resetFlow(userId);
  }
};
