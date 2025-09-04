const FlowManager = require("./FlowManager");
const defaultFlow = require("../Flows/INIT/INIT");
const DriveFlow = require("../Flows/Drive/DriveFlow");
class FlowMapper {
  async handleMessage(userId, message, messageType) {
    const flow = FlowManager.getFlow(userId);

    if (flow) {
      switch (flow.flowName) {
        case "DRIVE":
          await DriveFlow.Handle(
            userId,
            message,
            flow.currentStep,
            messageType
          );
          break;
        default:
          await defaultFlow.handle(userId, message, messageType);
      }
    } else {
      if (
        messageType === "image" ||
        messageType === "document" ||
        messageType === "document-caption" ||
        messageType === "excel" ||
        messageType === "csv"
      ) {
        FlowManager.setFlow(userId, "INITFLOW");
        await defaultFlow.Init(userId, message, messageType);
      } else {
        FlowManager.setFlow(userId, "INITFLOW");
        await defaultFlow.Init(userId, message, messageType);
      }
    }
  }
}
module.exports = new FlowMapper();
