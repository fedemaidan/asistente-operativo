const { StockSteps } = require("./StockSteps");

const StockFlow = {
  async start(userId, data, sock) {
    if (userId != null && sock != null) {
      if (typeof StockSteps["CargarStockStep"] === "function") {
        await StockSteps["CargarStockStep"](userId, data, sock);
      } else {
        console.log("El step solicitado no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },

  async Handle(userId, message, currentStep, sock, messageType) {
    if (userId != null && sock != null) {
      if (typeof StockSteps[currentStep] === "function") {
        await StockSteps[currentStep](userId, message, sock);
      } else {
        console.log("El step solicitado no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = StockFlow;
