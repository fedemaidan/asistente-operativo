const { getByChatGpt4o } = require("./Base");
const { formatDateToDDMMYYYY } = require("../Funciones/HandleDates");


const opciones = [
  {
    accion: "Confirmar datos",
    descripcion: `Necesito analizar los datos del usuario. Numero de transferencia, monto, nombre, apellido, destino, CUIT, fecha y hora.
      Para obtener el destino debes usar el atributo nombre unicamente de una de las siguientes 2 opciones o no encontrado:
      [
        {
          "nombre": "ASOCIACION CONSULTORA MUTUAL",
          "cuit": "30-71108832-2",
          "cvu": "0000252500000001000054"
        },
        {
          "nombre": "ENSHOP SRL",
          "cuit": "30-71519047-4",
          "cvu": "0720044120000000414890"
        }, {
        "nombre": "SERCOB SA",
        "cuit": "30-70828227-4",
        "cvu": "0000133100000000568579"
        }
      ]
      En el caso de que falten algunos atributos, devolve un - en el campo correspondiente  
      `,
    data: {
      numero_comprobante: "numero de comprobante de la transferencia",
      monto:
        "monto de la transferencia. Pasamelo en formato float. Ejemplo: 1000.50",
      destino:
        "cuenta de destino. Puede ser una de las siguientes opciones: ASOCIACION CONSULTORA MUTUAL, ENSHOP SRL, SERCOB SA o NO ENCONTRADO",
      fecha:
        `fecha de la transferencia, en formato dd/mm/yyyy o devolve un - si no se encuentra. Tene en cuenta que la fecha de hoy es ${formatDateToDDMMYYYY(
          new Date()
        )}, por lo que la fecha de transferencia debe ser cercana a la fecha de hoy`,
      hora: "hora de la transferencia en formato HH:MM, si no podes obtener la hora devolve un - si no se encuentra",
    },
  },
];

// Servicio para analizar la intención del mensaje
const analizarIntencion = async (message, sender) => {
  try {
    const opcionesTxt = JSON.stringify(opciones);

    // Verificar si el mensaje es un objeto y convertirlo a string
    const messageStr =
      typeof message === "object" ? JSON.stringify(message) : message;

    prompt = `
Como bot de un sistema de control de gastos, quiero quiero analizar la intención del usuario y ejecutar la acción adecuada para gestionar correctamente las operaciones posibles.

Formato de respuesta: Devuelve únicamente un JSON con los datos cargados, sin incluir explicaciones adicionales.

El usuario dice: "${messageStr}"

Tienes estas acciones posibles debes analizar la palabra clave del usuario: ${opcionesTxt}.
`;

    const response = await getByChatGpt4o(prompt);
    const respuesta = JSON.parse(response);

    console.log(respuesta, response);

    if (respuesta.hasOwnProperty("json_data")) {
      return respuesta.json_data;
    } else {
      return respuesta;
    }
  } catch (error) {
    console.error("Error al analizar la intención:", error.message);
    return "desconocido";
  }
};

module.exports = { analizarIntencion };
