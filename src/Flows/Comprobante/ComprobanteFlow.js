const botSingleton = require("../../Utiles/botSingleton");
const { ComprobanteSteps } = require("./ComprobanteSteps");

const ComprobanteFlow = {
  async start(userId, data) {
    const sock = botSingleton.getSock();
    //await sock.sendMessage(userId, { text: '📝 Recopilando datos de la hoja de ruta deseada \n Listando datos detectados:' });

    if (userId != null && sock != null) {
      if (typeof ComprobanteSteps["EnvioComprobanteStep"] === "function") {
        await ComprobanteSteps["EnvioComprobanteStep"](userId, data);
      } else {
        console.log("El step solicitado no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },

  async Handle(userId, message, currentStep, messageType) {
    const sock = botSingleton.getSock();
    if (userId != null && sock != null) {
      if (typeof ComprobanteSteps[currentStep] === "function") {
        await ComprobanteSteps[currentStep](userId, message);
      } else {
        console.log("El step solicitado no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = ComprobanteFlow;
