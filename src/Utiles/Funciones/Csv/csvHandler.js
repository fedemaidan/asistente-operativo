const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const csv = require("csv-parser");
const { Readable } = require("stream");

function convertToDateString(dateStr) {
  try {
    // Limpiar la cadena de fecha
    const cleanDateStr = dateStr.toString().trim();

    // Si ya está en formato DD/MM/YYYY, devolverlo tal como está
    if (cleanDateStr.includes("/") && cleanDateStr.split("/").length === 3) {
      const parts = cleanDateStr.split("/");
      if (
        parts[0].length <= 2 &&
        parts[1].length <= 2 &&
        parts[2].length === 4
      ) {
        return cleanDateStr; // Ya está en formato DD/MM/YYYY
      }
    }

    // Crear la fecha a partir del string
    let date;
    if (cleanDateStr.includes("-")) {
      // Formato YYYY-MM-DD o DD-MM-YYYY
      date = new Date(cleanDateStr);
    } else if (cleanDateStr.includes("/")) {
      // Formato DD/MM/YYYY o MM/DD/YYYY
      date = new Date(cleanDateStr);
    } else {
      date = new Date(cleanDateStr);
    }

    // Verificar que la fecha sea válida
    if (isNaN(date.getTime())) {
      console.warn(`Fecha inválida: ${dateStr}`);
      return dateStr; // Devolver el valor original si no se puede convertir
    }

    // Convertir a formato DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0"); // +1 porque getMonth() va de 0-11
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (error) {
    console.warn(`Error convirtiendo fecha ${dateStr}:`, error);
    return dateStr; // Devolver el valor original si hay error
  }
}

function convertToExcelTime(timeStr) {
  try {
    // Limpiar la cadena de tiempo
    const cleanTimeStr = timeStr.toString().trim();

    // Si ya es un número decimal, asumimos que ya está en formato Excel
    if (!isNaN(cleanTimeStr) && cleanTimeStr.includes(".")) {
      return Number(cleanTimeStr);
    }

    // Remover los dos puntos finales si existen (ej: "17:00:" -> "17:00")
    const normalizedTime = cleanTimeStr.replace(/:$/, "");

    // Separar horas y minutos
    const timeParts = normalizedTime.split(":");
    if (timeParts.length < 2) {
      console.warn(`Formato de hora inválido: ${timeStr}`);
      return timeStr; // Devolver el valor original si no se puede convertir
    }

    const hours = Number(timeParts[0]);
    const minutes = Number(timeParts[1]);
    const seconds = timeParts[2] ? Number(timeParts[2]) : 0;

    // Verificar que los valores sean válidos
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      console.warn(`Valores de tiempo inválidos: ${timeStr}`);
      return timeStr;
    }

    // Excel time is fraction of 24 hours
    return (hours + minutes / 60 + seconds / 3600) / 24;
  } catch (error) {
    console.warn(`Error convirtiendo hora ${timeStr}:`, error);
    return timeStr; // Devolver el valor original si hay error
  }
}

async function parseCsvToJson(docMessage) {
  try {
    const buffer = await downloadMediaMessage(
      { message: { documentMessage: docMessage } },
      "buffer"
    );

    return new Promise((resolve, reject) => {
      const results = [];
      const readableStream = Readable.from(buffer.toString());

      readableStream
        .pipe(
          csv({
            separator: ";",
            mapValues: ({ header, value }) => {
              // Eliminar comillas dobles al inicio y final si existen
              return value.replace(/^"|"$/g, "");
            },
          })
        )
        .on("data", (data) => {
          const parsedData = {};
          for (const [key, value] of Object.entries(data)) {
            // Eliminar BOM y comillas del nombre de la columna
            const cleanKey = key.replace(/^\uFEFF/, "").replace(/^"|"$/g, "");

            let finalValue = value;

            switch (cleanKey) {
              case "diaCrea":
                finalValue = convertToDateString(value);
                break;
              case "horaCrea":
                finalValue = convertToExcelTime(value);
                break;
              case "cuit":
                // Convertir CUIT a número sin guiones
                finalValue = value ? Number(value.replace(/\D/g, "")) : null;
                break;
              case "credito":
              case "debito":
              case "saldo":
              case "capitalCalculo":
              case "idTicket":
              case "idMov":
                // Convertir valores numéricos
                finalValue = value ? Number(value) : 0;
                break;
              case "porcAplic":
                // Mantener porcAplic como string como en el ejemplo
                finalValue = value ? value.toString() : "0";
                break;
              default:
                // Para numCuenta, nombreCuenta y textoAgrupa mantener como string
                finalValue = value;
            }

            parsedData[cleanKey] = finalValue;
          }
          results.push(parsedData);
        })
        .on("end", () => {
          resolve({
            success: true,
            data: results,
            fileName: docMessage.title,
          });
        })
        .on("error", (error) => {
          console.error("Error procesando archivo CSV:", error.message);
          reject({ success: false, error: error.message });
        });
    });
  } catch (error) {
    console.error("Error procesando archivo CSV:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  parseCsvToJson,
};
