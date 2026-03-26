const botSingleton = require("../../Utiles/botSingleton");
const { VerificarRemitenteSteps } = require("./VerificarRemitenteSteps");

const VerificarRemitenteFlow = {
  async start(userId) {
    const sock = botSingleton.getSock();
    if (userId != null && sock != null) {
      if (typeof VerificarRemitenteSteps.InicioVerificacionStep === "function") {
        await VerificarRemitenteSteps.InicioVerificacionStep(userId);
      } else {
        console.log("VerificarRemitente: step inicial no existe");
      }
    } else {
      console.log("VerificarRemitente: sock o userId inválido");
    }
  },

  async Handle(userId, message, currentStep, messageType) {
    const sock = botSingleton.getSock();
    if (userId != null && sock != null) {
      if (typeof VerificarRemitenteSteps[currentStep] === "function") {
        await VerificarRemitenteSteps[currentStep](userId, message);
      } else {
        console.log("VerificarRemitenteFlow: step inexistente", currentStep);
      }
    } else {
      console.log("VerificarRemitenteFlow: sock o userId inválido");
    }
  },
};

module.exports = VerificarRemitenteFlow;
