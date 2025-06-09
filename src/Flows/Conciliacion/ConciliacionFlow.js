const botSingleton = require("../../Utiles/botSingleton");
const { ConciliacionSteps } = require("./ConciliacionSteps");

const ConciliacionFlow = {
  async start(userId, data) {
    const sock = botSingleton.getSock();
    if (userId != null && sock != null) {
      if (typeof ConciliacionSteps["ProcesarReporteStep"] === "function") {
        await ConciliacionSteps["ProcesarReporteStep"](userId, data);
      } else {
        console.log("El step solicitadooo no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },

  async Handle(userId, message, currentStep, messageType) {
    const sock = botSingleton.getSock();
    if (userId != null && sock != null) {
      if (typeof ConciliacionSteps[currentStep] === "function") {
        await ConciliacionSteps[currentStep](userId, message);
      } else {
        console.log("El step solicitado en ConciliacionFlow no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = ConciliacionFlow;
