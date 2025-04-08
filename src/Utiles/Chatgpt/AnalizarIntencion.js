const { getByChatGpt4o } = require("./Base");
const FlowManager = require("../../FlowControl/FlowManager");

const opciones = [
  {
    accion: "Confirmar datos",
    descripcion:
      "Necesito analizar los datos del usuario. Numero de transferencia, monto, nombre, apellido, CUIT, fecha y hora.",
    data: {
      numero_comprobante: "numero de comprobante de la transferencia",
      monto:
        "monto de la transferencia. No debe incluir ningun signo de pesos ni comas. Solo el numero",
      moneda:
        "moneda de la transferencia. Ejemplo: Pesos, Dolares, etc. Si no indica la moeneda, se asume que es pesos",
      fecha: "fecha de la transferencia, en formato dd/mm/yyyy",
      hora: "hora de la transferencia",
      nombre: "nombre de origen",
      apellido: "apellido de origen",
      cuit: "cuit de origen",
    },
  },
];

// Servicio para analizar la intención del mensaje
const analizarIntencion = async (message, sender) => {
  try {
    const opcionesTxt = JSON.stringify(opciones);
    prompt = `
Como bot de un sistema de control de gastos, quiero quiero analizar la intención del usuario y ejecutar la acción adecuada para gestionar correctamente las operaciones posibles.

Formato de respuesta: Devuelve únicamente un JSON con los datos cargados, sin incluir explicaciones adicionales.

El usuario dice: "${message}"

Tienes estas acciones posibles debes analizar la palabra clave del usuario: ${opcionesTxt}.
`;
    console.log(prompt);

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
    return "desconocido"; // Intención predeterminada en caso de error
  }
};

module.exports = { analizarIntencion };

/*
        esto se logra mediante hojas de ruta sin embargo cada usuario cuenta con flujos diferentes.
*/
