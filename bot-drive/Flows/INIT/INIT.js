const FlowManager = require("../../FlowControl/FlowManager");
const botSingleton = require("../../../src/Utiles/botSingleton");
const DriveFlow = require("../Drive/DriveFlow");

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
          DriveFlow.start(userId, result.data);
          break;

        case "No comprendido":
          await sock.sendMessage(userId, {
            text: "No entendi tu mensaje, porfavor repitelo",
          });
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
    await sock.sendMessage(userId, {
      text: "No entendi tu mensaje, porfavor repitelo",
    });
  },
};

module.exports = defaultFlow;
