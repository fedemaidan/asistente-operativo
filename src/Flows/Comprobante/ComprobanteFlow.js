const { ComprobanteSteps } = require("./ComprobanteSteps");

const ComprobanteFlow = {
  async start(userId, data, sock) {
    //await sock.sendMessage(userId, { text: '📝 Recopilando datos de la hoja de ruta deseada \n Listando datos detectados:' });

    if (userId != null && sock != null) {
      if (typeof ComprobanteSteps["EnvioComprobanteStep"] === "function") {
        await ComprobanteSteps["EnvioComprobanteStep"](userId, data, sock);
      } else {
        console.log("El step solicitado no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },

  async Handle(userId, message, currentStep, sock, messageType) {
    if (userId != null && sock != null) {
      if (typeof ComprobanteSteps[currentStep] === "function") {
        await ComprobanteSteps[currentStep](userId, message, sock);
      } else {
        console.log("El step solicitado no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = ComprobanteFlow;
