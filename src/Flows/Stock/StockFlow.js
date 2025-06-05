const botSingleton = require("../../Utiles/botSingleton");
const { StockSteps } = require("./StockSteps");

const StockFlow = {
  async start(userId, data) {
    const sock = botSingleton.getSock();
    if (userId != null && sock != null) {
      if (typeof StockSteps["CargarStockStep"] === "function") {
        await StockSteps["CargarStockStep"](userId, data);
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
      if (typeof StockSteps[currentStep] === "function") {
        await StockSteps[currentStep](userId, message);
      } else {
        console.log("El step solicitado no existe");
      }
    } else {
      console.log("Ocurrio un error con los datos");
    }
  },
};
module.exports = StockFlow;
