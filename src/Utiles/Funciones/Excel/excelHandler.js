const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const XLSX = require("xlsx");
const fs = require("fs");

function excelBufferToJson(buffer, fileNameFromSource) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  return {
    success: true,
    data: jsonData,
    fileName: fileNameFromSource || undefined,
  };
}

/**
 * Acepta múltiples tipos de entrada para parsear Excel a JSON:
 * - Objeto con { data, fileName } ya parseado (retorna tal cual)
 * - Buffer (contenido binario del Excel)
 * - Archivo de Multer (memoryStorage: { buffer, originalname }, diskStorage: { path, originalname })
 * - Objeto `documentMessage` de Baileys (se descarga con downloadMediaMessage)
 */
async function parseExcelToJson(input) {
  console.log("parseExcelToJson input keys:", input && Object.keys(input));

  // Caso 1: ya viene parseado (contrato previo)
  if (input && typeof input === "object" && "data" in input) {
    return {
      success: true,
      data: input.data,
      fileName: input.fileName,
    };
  }

  // Caso 2: es un Buffer directo
  if (Buffer.isBuffer(input)) {
    try {
      return excelBufferToJson(input);
    } catch (error) {
      console.error("Error procesando Buffer de Excel:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Caso 3: archivo Multer (memoryStorage o diskStorage)
  if (
    input &&
    typeof input === "object" &&
    ("buffer" in input || "path" in input)
  ) {
    try {
      const buffer = input.buffer || fs.readFileSync(input.path);
      const fileName = input.originalname || input.filename || input.title;
      const result = excelBufferToJson(buffer, fileName);
      return result;
    } catch (error) {
      console.error("Error procesando archivo Multer de Excel:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Caso 4: mensaje Baileys documentMessage
  try {
    const buffer = await downloadMediaMessage(
      { message: { documentMessage: input } },
      "buffer"
    );
    const fileName = input?.title || input?.fileName || undefined;
    return excelBufferToJson(buffer, fileName);
  } catch (error) {
    console.error(
      "Error procesando archivo Excel (Baileys/documentMessage):",
      error.message
    );
    console.log("error", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  parseExcelToJson,
  excelBufferToJson,
};
