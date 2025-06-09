const { getByChatgpt35TurboByText } = require("./base");

const analizarModificacionOperacion = async (datos, mensajeUsuario) => {
    try {
        const prompt = `
        Soy un bot de una financiera que ayuda a gestionar operaciones y comprobantes. Mi trabajo es analizar si el usuario quiere modificar los datos de una operacion y determinar qué cambios solicita.
        
        Aquí están los datos actuales de la operación:
        ${JSON.stringify(comprobante, null, 2)}

        El usuario dice: "${mensajeUsuario}"

        Tienes que identificar qué datos quiere modificar y devolverlos en formato JSON. Si el usuario no especifica un cambio claro, deja el valor sin modificar. 

        RESPONDE SOLO CON UN JSON QUE SOLO INCLUYA LOS DATOS A MODIFICAR MANTIENIENDO EL JSON DE LOS DATOS DE LA OPERACION:

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

module.exports = { analizarModificacionOperacion };
