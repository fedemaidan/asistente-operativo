const { ExcelSteps } = require("./ExcelSteps");

const ExcelFlow = {
  async start(userId, data, sock) {
    if (userId != null && sock != null) {
      if (typeof ExcelSteps["VerificarTipoExcelStep"] === "function") {
        await ExcelSteps["VerificarTipoExcelStep"](userId, data, sock);
      } else {
        console.log("El step solicitado no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },

  async Handle(userId, message, currentStep, sock, messageType) {
    if (userId != null && sock != null) {
      if (typeof ExcelSteps[currentStep] === "function") {
        await ExcelSteps[currentStep](userId, message, sock);
      } else {
        console.log("El step solicitado en ExcelFlow no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = ExcelFlow;
