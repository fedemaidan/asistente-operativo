const { analizarIntencion } = require('../services/chatgpt/analizarIntencion');

const defaultFlow = {
    async analizarItencion(message) {
        try {
            const result = await analizarIntencion(message);
            console.log(result.respuesta)
            return result.respuesta;
        } catch (err) {
            console.error('Error analizando la intención:', err.message);
            return { accion: 'DESCONOCIDO' };
        }
    },

    async handle(userId, message, sock) {
        await sock.sendMessage(userId, {
            text: 'No entendí tu mensaje. Por favor, intenta nuevamente o utiliza uno de estos comandos:\n- Crear operación\n- Confirmar pago\n- Confirmar cobro',
        });
    },
};

module.exports = defaultFlow;
