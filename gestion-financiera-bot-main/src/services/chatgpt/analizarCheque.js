const { getByChatgpt4Vision } = require('./base');
const openai = require('./openai'); // Importar el cliente OpenAI configurado
const fs = require('fs');

const analizarCheque = async (filePath) => {
    try {
        // Prompts para analizar el cheque
        const prompt = `
            Eres un asistente financiero. Voy a proporcionarte una imagen de un cheque ADJUNTA.
            Necesito que extraigas los siguientes datos:
            - Monto del cheque
            - Número de operación
            - Banco emisor
            - Fecha
            - Cliente que emite el cheque
            - Cliente que recibe el cheque

            Devuelve los datos como un JSON.
        `;

        // Consultar a OpenAI
        const response = await getByChatgpt4Vision([filePath], prompt);

        const respuesta = JSON.parse(response);
        console.log('Respuesta de OpenAI:', respuesta);
        if (respuesta.hasOwnProperty('json_data'))
        return { respuesta: respuesta.json_data, prompt: prompt};
        else
        return { respuesta: respuesta, prompt: prompt};
    } catch (error) {
        console.error('Error analizando el cheque:', error.message);
        return null;
    }
};

module.exports = { analizarCheque };
