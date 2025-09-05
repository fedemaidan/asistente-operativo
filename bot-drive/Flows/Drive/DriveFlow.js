const botSingleton = require("../../../src/Utiles/botSingleton");
const { DriveSteps } = require("./DriveSteps");

const DriveFlow = {
  async start(userId, data) {
    const sock = botSingleton.getSock();
    if (userId != null && sock != null) {
      if (typeof DriveSteps["GuardarArchivoStep"] === "function") {
        await DriveSteps["GuardarArchivoStep"](userId, data);
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
      if (typeof DriveSteps[currentStep] === "function") {
        await DriveSteps[currentStep](userId, message);
      } else {
        console.log("El step solicitado en DriveFlow no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = DriveFlow;
