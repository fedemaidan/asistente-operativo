const { getByChatgpt4Vision } = require('./base');
const openai = require('./openai'); // Importar el cliente OpenAI configurado
const fs = require('fs');

const analizarComprobantes = async (filePath) => {
    try {
        // const r_fake = {
        //     tipo: 'TRANSFERENCIA',
        //     monto: '23000.00',
        //     banco_emisor: 'Mercado Pago',
        //     'numero_operación': '99146705059'
        //   }
        //   return { respuesta: r_fake, prompt: "prompt"};
        // return {
        //     prompt: "prompt",
        //     respuesta: {
        //         tipo: 'CHEQUES',
        //         cheques: [
        //           {
        //             monto: 855563,
        //             banco_emisor: 'Banco de La Pampa',
        //             numero_comprobante: '64991759',
        //             cuit: null,
        //             fecha_pago: '2025-02-01'
        //           },
        //           {
        //             monto: 1483089,
        //             banco_emisor: 'Galicia',
        //             numero_comprobante: '62531778',
        //             cuit: null,
        //             fecha_pago: '2025-02-04'
        //           }
        //         ]
        //       }
        // }
        const comprobantes = [
            {
                name: "Transferencia",
                accion: "TRANSFERENCIA",
                json_data: {
                    "tipo": "TRANSFERENCIA",
                    "monto": 'monto de la transferencia o null',
                    "banco_emisor": 'banco emisor de la transferencia o null',
                    "numero_comprobante": 'número de la operación/transferencia',
                    "cuit": "cuit o null",
                    "fecha_pago": "YYYY-MM-DD o null",

                }
            },
            {
                name: "Conjunto de cheques",
                accion: "CHEQUES",
                json_data: {
                    "tipo": "CHEQUES",
                    "cheques": [
                        {
                            "monto": 'monto del cheque en formato float o null',
                            "banco_emisor": 'banco emisor del cheque o null',
                            "numero_comprobante": 'número de la operación/cheque/ o cualquier referencia al mismo/ o null',
                            "cuit": "cuit o null",
                            "fecha_pago": "YYYY-MM-DD o null",
                        }
                    ]
                },
            },
        ]
        // Prompts para analizar el cheque
        const prompt = `
            Eres un asistente financiero. Voy a proporcionarte una imagen de un cheque o comprobante de transferencia.
            Tu objetivo es identificar que comprobante es y extraer la información relevante.
            Formatos de comprobantes: ${JSON.stringify(comprobantes)}

            Los números deben interpretarse según el formato argentino (miles con punto, decimales con coma). Si no contienen decimales, trátalos como enteros.
            Devuelve los datos como un JSON con su formato correspondiente.
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

module.exports = { analizarComprobantes };
