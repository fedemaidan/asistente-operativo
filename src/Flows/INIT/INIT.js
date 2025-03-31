const { analizarIntencion } = require("../../Utiles/Chatgpt/AnalizarIntencion");
const ComprobanteFlow = require("../Comprobante/ComprobanteFlow");

const defaultFlow = {
  async Init(userId, message, sock, messageType) {
    try {
      //si es texto se analiza en cambio si es una imagen o documento o document-caption este ya se encuentra analizado y salta el "Analizar intencion"
      let result;
      await sock.sendMessage(userId, { text: "⏳ Analizando mensaje ⏳" });

      if (
        messageType == "text" ||
        messageType == "text_extended" ||
        messageType == "audio"
      ) {
        result = await analizarIntencion(message, userId);
      } else {
        result = message;
      }

      console.log(JSON.stringify(result, null, 2));

      switch (result.accion) {
        case "Confirmar datos":
          ComprobanteFlow.start(userId, result.data, sock);
          break;

        case "No comprendido":
          await sock.sendMessage(userId, {
            text: "No entendi tu mensaje, porfavor repitelo",
          });
          FlowManager.resetFlow(userId);
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

  async handle(userId, message, sock) {
    await sock.sendMessage(userId, {
      text: "No entendi tu mensaje, porfavor repitelo",
    });
  },
};

module.exports = defaultFlow;
