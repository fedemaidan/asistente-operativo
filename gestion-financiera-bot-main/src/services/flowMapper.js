const FlowManager = require("./flowManager");
const crearOperacionFlow = require("../flows/crearOperacionFlow");
const defaultFlow = require("../flows/defaultFlow");
const botSingleton = require("../../../src/Utiles/botSingleton");

class FlowMapper {
  async handleMessage(userId, message, messageType) {
    const sock = botSingleton.getSock(userId);
    const flow = FlowManager.getFlow(userId);

    if (flow) {
      switch (flow.flowName) {
        case "CREAR_OPERACION":
          await crearOperacionFlow.handle(
            userId,
            message,
            flow.currentStep,
            sock,
            messageType
          );
          break;

        default:
          await defaultFlow.handle(userId, message, sock, messageType);
      }
    } else {
      if (
        messageType === "image" ||
        messageType === "document" ||
        messageType === "document-caption"
      ) {
        FlowManager.setFlow(userId, "CREAR_OPERACION");
        await crearOperacionFlow.start(userId, message, sock, messageType);
      } else {
        await defaultFlow.handle(userId, message, sock, messageType);
      }
    }
  }
}

module.exports = new FlowMapper();
