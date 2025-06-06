class FlowManager {
    constructor() {
        this.userFlows = {}; // Almacena los flujos de cada usuario
    }

    // Establecer el flujo y paso inicial para un usuario
    setFlow(userId, flowName, initialStep = 0, flowData = {}) {
        const actualFlowData = this.userFlows[userId]?.flowData || {};
        const _flowData = { ...actualFlowData, ...flowData };
        
        this.userFlows[userId] = { flowName, currentStep: initialStep, flowData: _flowData };
    }

    // Obtener el flujo actual de un usuario
    getFlow(userId) {
        return this.userFlows[userId] || null;
    }

    // Avanzar al siguiente paso del flujo
    nextStep(userId) {
        if (this.userFlows[userId]) {
            this.userFlows[userId].currentStep += 1;
        }
    }

    // Reiniciar el flujo de un usuario
    resetFlow(userId) {
        delete this.userFlows[userId];
    }

    // Verificar si un usuario está en un flujo
    isInFlow(userId, flowName) {
        const flow = this.getFlow(userId);
        return flow && flow.flowName === flowName;
    }
}

module.exports = new FlowManager();
