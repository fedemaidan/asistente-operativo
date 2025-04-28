const { getByChatGpt4o } = require("./Base");

module.exports = async function getDatesFromExcel(fileName) {
  const prompt = `
  Analiza el siguiente nombre de archivo Excel: "${fileName}"
  
  Extrae las fechas de inicio y fin del período que representa, considerando diferentes posibles formatos.
  Las fechas suelen estar separadas por palabras como "al", "-", "a", o "_".
  
  También calcula:
  1. El número total de días entre las fechas (incluyendo ambos días)
  2. Si las fechas están en meses diferentes, considera los días reales de cada mes
  
  Responde ÚNICAMENTE con un JSON válido con este formato exacto:
  {
    "date1": "DD-MM",
    "date2": "DD-MM",
    "dateDiff": N
  }
  
  Si solo encuentras una fecha, asume que es un período de 1 día y usa la misma fecha para ambos campos.
  Si no puedes identificar fechas, responde: {"fecha1": "", "fecha2": "", "diasPeriodo": 15}
  `;

  try {
    const response = await getByChatGpt4o(prompt);
    const responseData = JSON.parse(response);

    return responseData;
  } catch (error) {
    console.error("Error al analizar fechas del archivo:", error);
    return {
      fecha1: "",
      fecha2: "",
      diasPeriodo: 15,
    };
  }
};
