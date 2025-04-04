const { getByChatgpt4Vision } = require("../Chatgpt/Base");

async function transcribeImage(imagePath) {
  try {
    prompt = `
Sos un experto transcribiendo imagenes. Vas a recibir una imagen de una factura o un comprobante de pago.

Devolve solo un json con el texto transcribido. En el caso de que falten algunos atributos, devolve un - en el campo correspondiente.
No incluyas explicaciones adicionales ni texto extra. Solo el JSON.

    {
        accion: "Confirmar datos",
        data:
        {
            numero_comprobante: "Es el numero de comprobante o de transferencia.",
            monto: "Es el monto total del comprobante o de transferencia.",
            fecha: "Es la fecha del comprobante o de transferencia.",
            hora: "Es la hora del comprobante o de transferencia.",
            nombre: "Es el nombre de la persona que hizo la transferencia.",
            apellido: "Es el apellido de la persona que hizo la transferencia.",
            cuit: "Es el cuit de la persona que hizo la transferencia.",
            dni: "Es el dni de la persona que hizo la transferencia.",
        }
    }
`;

    // Consultar a OpenAI
    const response = await getByChatgpt4Vision([imagePath], prompt);

    const respuesta = JSON.parse(response);

    console.log("RESULTADO PROMPT", response);

    if (respuesta.hasOwnProperty("json_data")) {
      return respuesta.json_data;
    } else {
      return respuesta;
    }
  } catch (error) {
    console.error("Error analizando la factura en OPEN IA:", error.message);
    return null;
  }
}
module.exports = transcribeImage;
