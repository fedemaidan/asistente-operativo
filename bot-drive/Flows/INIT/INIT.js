const FlowManager = require("../../FlowControl/FlowManager");
const botSingleton = require("../../../src/Utiles/botSingleton");
const DriveFlow = require("../Drive/DriveFlow");
const {
  guardarArchivoDrive,
} = require("../../../src/Utiles/GoogleServices/Drive/guardarDrive");

const defaultFlow = {
  async Init(userId, message, messageType) {
    const sock = botSingleton.getSock();
    try {
      //si es texto se analiza en cambio si es una imagen o documento o document-caption este ya se encuentra analizado y salta el "Analizar intencion"
      let result = {};

      if (
        messageType == "text" ||
        messageType == "text_extended" ||
        messageType == "audio"
      ) {
        //result = await analizarIntencion(message, userId);
      } else if (messageType == "image") {
        result.accion = "Guardar archivo";
        result.data = message;
      } else if (messageType == "document") {
        result.accion = "Guardar archivo";
        result.data = message;
      } else {
        result = message;
      }

      console.log("result", JSON.stringify(result, null, 2));

      switch (result.accion) {
        case "Guardar archivo":
          const carpetaId = botSingleton.getDriveFolderIdByUserId(userId);
          console.log("messageDrive", message);
          const response = await guardarArchivoDrive(
            message.imageUrl,
            carpetaId,
            message?.caption || "imagen"
          );

          DriveFlow.start(userId, response);
          break;

        case "No comprendido":
          console.log("No comprendido");
          FlowManager.resetFlow(userId);
          break;
      }
      return;
    } catch (err) {
      console.error("Error analizando la intención:", err.message);
      return { accion: "DESCONOCIDO" };
    }
  },

  async handle(userId, message) {
    const sock = botSingleton.getSock();
    try {
      // Si viene un álbum (albumMessage), no respondemos; luego llegarán las imágenes individuales
      if (message?.albumMessage) return;

      console.log("No comprendido");
    } catch (err) {
      console.error("Error en defaultFlow.handle:", err.message);
    }
  },
};

module.exports = defaultFlow;
