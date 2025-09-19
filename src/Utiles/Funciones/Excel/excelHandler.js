const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const XLSX = require("xlsx");

async function parseExcelToJson(docMessage) {
  console.log("dockMessage", docMessage);
  if (docMessage && typeof docMessage === "object" && "data" in docMessage) {
    return {
      success: true,
      data: docMessage.data,
      fileName: docMessage.fileName,
    };
  }

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
    console.log("error", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  parseExcelToJson,
};
