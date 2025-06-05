const botSingleton = require("../../Utiles/botSingleton");
const { ExcelSteps } = require("./ExcelSteps");

const ExcelFlow = {
  async start(userId, data) {
    const sock = botSingleton.getSock();
    if (userId != null && sock != null) {
      if (typeof ExcelSteps["VerificarTipoExcelStep"] === "function") {
        await ExcelSteps["VerificarTipoExcelStep"](userId, data);
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
      if (typeof ExcelSteps[currentStep] === "function") {
        await ExcelSteps[currentStep](userId, message);
      } else {
        console.log("El step solicitado en ExcelFlow no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = ExcelFlow;
