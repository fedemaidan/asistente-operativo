const { ConciliacionSteps } = require("./ConciliacionSteps");

const ConciliacionFlow = {
  async start(userId, data, sock) {
    if (userId != null && sock != null) {
      if (typeof ConciliacionSteps["ProcesarReporteStep"] === "function") {
        await ConciliacionSteps["ProcesarReporteStep"](userId, data, sock);
      } else {
        console.log("El step solicitadooo no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },

  async Handle(userId, message, currentStep, sock, messageType) {
    if (userId != null && sock != null) {
      if (typeof ConciliacionSteps[currentStep] === "function") {
        await ConciliacionSteps[currentStep](userId, message, sock);
      } else {
        console.log("El step solicitadoooo no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = ConciliacionFlow;
