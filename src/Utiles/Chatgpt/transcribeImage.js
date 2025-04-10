const { getByChatgpt4Vision } = require("../Chatgpt/Base");

async function transcribeImage(imagePath) {
  try {
    prompt = `
Sos un experto transcribiendo imagenes. Vas a recibir una imagen de una factura o un comprobante de pago.

Devolve solo un json con el texto transcribido. En el caso de que falten algunos atributos, devolve un - en el campo correspondiente.
No incluyas explicaciones adicionales ni texto extra. Solo el JSON.

Para obtener el destino debes usar el atributo nombre unicamente de una de las siguientes 2 opciones:
[
  {
    "nombre": "ASOCIACION CONSULTURA MUTUAL",
    "cuit": "30-71108832-2",
    "cvu": "0000252500000001000054"
  },
  {
    "nombre": "ENSHOP SRL",
    "cuit": "30-71519047-4",
    "cbu": "0720044120000000414890"
  }
]

    {
        accion: "Confirmar datos",
        data:
        {
            numero_comprobante: "numero de comprobante de la transferencia",
            monto: "monto de la transferencia. Pasamelo en formato float. Ejemplo: 1000.50",
            destino: "cuenta de destino",            
            fecha: "Es la fecha del comprobante o de transferencia. Formato dd/mm/yyyy",  
            hora: "Es la hora del comprobante o de transferencia.",
            nombre: "Es el nombre de la persona que hizo la transferencia.",
            apellido: "Es el apellido de la persona que hizo la transferencia.",
            cuit: "Es el cuit de la persona que hizo la transferencia.",
        }
    }
`;

    // Consultar a OpenAI
    const response = await getByChatgpt4Vision([imagePath], prompt);

    const respuesta = JSON.parse(response);

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
