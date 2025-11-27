require("dotenv").config();
const mongoose = require("mongoose");
const ClienteController = require("../src/controllers/clienteController");
const {
  updateSheetWithBatchDelete,
} = require("../src/Utiles/GoogleServices/General");

async function conectarMongo() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    "mongodb://127.0.0.1:27017/asistente-operativo";
  await mongoose.connect(uri);
}

async function desconectarMongo() {
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
}

async function exportarClientesASheetAlternativo(spreadsheetId) {
  try {
    const SHEET_NAME = "Clientes";

    // Filtro: activos cuando existe el campo, o registros sin 'active'
    const resp = await ClienteController.getAll({}, "", {
      filter: { $or: [{ active: true }, { active: { $exists: false } }] },
    });
    if (!resp?.success) {
      return { success: false, error: resp?.error || "No se pudieron obtener los clientes" };
    }
    const clientes = Array.isArray(resp.data) ? resp.data : [];

    const dataRows = clientes.map((c) => {
      const nombre = c?.nombre || "";
      const descuento = c?.descuento != null ? Number(c.descuento) : 0;
      const ccActivas = Array.isArray(c?.ccActivas) ? c.ccActivas.join(", ") : "";
      return [nombre, descuento, ccActivas];
    });

    await updateSheetWithBatchDelete(
      spreadsheetId,
      `${SHEET_NAME}!A2:C10000`,
      dataRows,
      3
    );

    return { success: true, count: dataRows.length };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { exportarClientesASheetAlternativo };

async function main() {
  const sheetId = process.argv[2] || process.env.EXPORT_SHEET_ID;
  if (!sheetId || typeof sheetId !== "string" || sheetId.trim() === "") {
    console.error(
      "Sheet ID no provisto. Ejecutá: node dev_tools/exportarClientesAlternativo.js <SHEET_ID> o seteá EXPORT_SHEET_ID."
    );
    process.exitCode = 1;
    return;
  }
  try {
    await conectarMongo();
    console.log(`Usando Sheet ID: ${sheetId}`);
    console.log("Exportando Clientes (alternativo)...");
    const res = await exportarClientesASheetAlternativo(sheetId);
    if (res?.success) {
      console.log(`✓ Clientes exportados: ${res.count}`);
    } else {
      console.warn("✗ Error exportando clientes:", res?.error || "desconocido");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Error en exportación de clientes (alternativo):", error);
    process.exitCode = 1;
  } finally {
    await desconectarMongo();
  }
}

if (require.main === module) {
  main();
}


