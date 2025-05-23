const FlowManager = require("../FlowControl/FlowManager");
const defaultFlow = require("../Flows/INIT/INIT");
const ComprobanteFlow = require("../Flows/Comprobante/ComprobanteFlow");
const ExcelFlow = require("../Flows/Excel/ExcelFlow");
const ConciliacionFlow = require("../Flows/Conciliacion/ConciliacionFlow");
const StockFlow = require("../Flows/Stock/StockFlow");

class FlowMapper {
  async handleMessage(userId, message, sock, messageType) {
    const flow = FlowManager.getFlow(userId);

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
        case "EXCEL":
          await ExcelFlow.Handle(
            userId,
            message,
            flow.currentStep,
            sock,
            messageType
          );
          break;
        case "CONCILIACION":
          await ConciliacionFlow.Handle(
            userId,
            message,
            flow.currentStep,
            sock,
            messageType
          );
          break;
        case "STOCK":
          await StockFlow.Handle(
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
        messageType === "document-caption" ||
        messageType === "excel"
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
