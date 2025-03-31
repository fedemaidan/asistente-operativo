class FlowManager {
    constructor() {
        this.userFlows = {}; // Almacena los flujos de cada usuario
    }
    // Establecer el flujo y paso inicial para un usuario

    setFlow(userId, flowName, Step, flowData = {}) {
        console.log(Step)
        const actualFlowData = this.userFlows[userId]?.flowData || {};
        const _flowData = { ...actualFlowData, ...flowData };
        this.userFlows[userId] = { flowName, currentStep: Step, flowData: _flowData }
    }

    // Obtener el flujo actual de un usuario
    getFlow(userId) {
        return this.userFlows[userId] || null;
    }

    // Reiniciar el flujo de un usuario
    resetFlow(userId) {
        delete this.userFlows[userId];
    }
}
module.exports = new FlowManager();
