const FlowManager = require("../../FlowControl/FlowManager");
const botSingleton = require("../../Utiles/botSingleton");
const { analizarIntencion } = require("../../Utiles/Chatgpt/AnalizarIntencion");
const ComprobanteFlow = require("../Comprobante/ComprobanteFlow");
const ExcelFlow = require("../Excel/ExcelFlow");

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
        result = await analizarIntencion(message, userId);
      } else if (messageType == "excel") {
        result.accion = "Excel";
        result.data = message;
      } else if (messageType == "csv") {
        result.accion = "Excel";
        result.data = message;
      } else {
        result = message;
      }

      console.log("result", JSON.stringify(result, null, 2));

      switch (result.accion) {
        case "Confirmar datos":
          ComprobanteFlow.start(userId, result.data);
          break;

        case "No comprendido":
          await sock.sendMessage(userId, {
            text: "No entendi tu mensaje, porfavor repitelo",
          });
          FlowManager.resetFlow(userId);
          break;

        case "Excel":
          ExcelFlow.start(userId, result.data);
          break;

        case "NoRegistrado":
          console.log("NO REGISTRADO");
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
