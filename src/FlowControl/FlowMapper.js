const FlowManager = require("../FlowControl/FlowManager");
const defaultFlow = require("../Flows/INIT/INIT");
const ComprobanteFlow = require("../Flows/Comprobante/ComprobanteFlow");

class FlowMapper {
  async handleMessage(userId, message, sock, messageType) {
    const flow = FlowManager.getFlow(userId);

    //LOGICA PARA SABER SI ES CHOFER Y DE SER ASI
    //OBTENGO EL FLOW DESDE MI BD Y DIRECTAMENTE ENTRA AL PASO EN CONCRETO DE SU FLUJO

    if (flow) {
      switch (flow.flowName) {
        case "ENVIOCOMPROBANTE":
          await ComprobanteFlow.Handle(
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
        FlowManager.setFlow(userId, "INITFLOW");
        await defaultFlow.Init(userId, message, sock, messageType);
      } else {
        FlowManager.setFlow(userId, "INITFLOW");
        await defaultFlow.Init(userId, message, sock, messageType);
      }
    }
  }
}
module.exports = new FlowMapper();
