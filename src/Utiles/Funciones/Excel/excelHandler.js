const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const XLSX = require("xlsx");

async function parseExcelToJson(docMessage) {
  try {
    const buffer = await downloadMediaMessage(
      { message: { documentMessage: docMessage } },
      "buffer"
    );

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return {
      success: true,
      data: jsonData,
      fileName: docMessage.title,
    };
  } catch (error) {
    console.error("Error procesando archivo Excel:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  parseExcelToJson,
};
