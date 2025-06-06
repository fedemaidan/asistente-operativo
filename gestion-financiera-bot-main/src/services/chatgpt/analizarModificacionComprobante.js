const { getByChatgpt35TurboByText } = require("./base");

const analizarModificacionComprobante = async (comprobante, mensajeUsuario) => {
    try {
        const prompt = `
        Soy un bot de una financiera que ayuda a gestionar operaciones y comprobantes. Mi trabajo es analizar si el usuario quiere modificar los datos de un comprobante y determinar qué cambios solicita.
        
        Aquí están los datos actuales del comprobante:
        ${JSON.stringify(comprobante, null, 2)}

        El usuario dice: "${mensajeUsuario}"

        Tienes que identificar qué datos quiere modificar y devolverlos en formato JSON. Si el usuario no especifica un cambio claro, deja el valor sin modificar. 

        RESPONDE SOLO CON UN JSON QUE INCLUYA LOS DATOS A MODIFICAR. Ejemplo:
        {
            "monto": "Nuevo monto si el usuario lo menciona",
            "numero_comprobante": "Nuevo número si el usuario lo menciona",
            "banco_emisor": "Nuevo banco si el usuario lo menciona",
            "fecha_pago": "Nueva fecha si el usuario lo menciona",
            "tipo_cheque": "Nuevo tipo de cheque si el usuario lo menciona"
        }

        Si el usuario no menciona un campo, no lo pongas en el excel.
        `;
        
        const response = await getByChatgpt35TurboByText(prompt); // actualizar por el modelo 4o
        const respuesta = JSON.parse(response);

        return { respuesta, prompt };
    } catch (error) {
        console.error('Error al analizar la modificación:', error.message);
        return { respuesta: null, prompt: null };
    }
};

module.exports = { analizarModificacionComprobante };
