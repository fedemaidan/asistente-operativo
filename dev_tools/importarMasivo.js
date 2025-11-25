require("dotenv").config();
const mongoose = require("mongoose");

const { importarClientesDesdeSheet } = require("../src/backup/importarClientes");
const { importarComprobantesDesdeSheet } = require("../src/backup/importarComprobantes");
const { importarPagosDesdeSheet } = require("../src/backup/importarPagos");
const { importarEntregasDesdeSheet } = require("../src/backup/importarEntregas");

async function conectarMongo() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    "mongodb://127.0.0.1:27017/asistente-operativo";
  await mongoose.connect(uri, { dbName: process.env.MONGO_DB || undefined });
}

async function desconectarMongo() {
  try {
    await mongoose.disconnect();
  } catch (_) {}
}

async function importarMasivo(sheetId) {
  if (!sheetId || typeof sheetId !== "string" || sheetId.trim() === "") {
    throw new Error(
      "Sheet ID no provisto. Pasá el ID por CLI o variable de entorno IMPORT_SHEET_ID."
    );
  }

  console.log(`Usando Sheet ID: ${sheetId}`);

  console.log("Importando Clientes...");
  const cliRes = await importarClientesDesdeSheet(sheetId);
  console.log(
    cliRes?.success ? `✓ Clientes importados: ${cliRes.count}` : `✗ Error: ${cliRes?.error}`
  );

  console.log("Importando Comprobantes (INGRESOS)...");
  const compRes = await importarComprobantesDesdeSheet(sheetId);
  console.log(
    compRes?.success ? `✓ Comprobantes importados: ${compRes.count}` : `✗ Error: ${compRes?.error}`
  );

  console.log("Importando Pagos (EGRESOS)...");
  const pagosRes = await importarPagosDesdeSheet(sheetId);
  console.log(
    pagosRes?.success ? `✓ Pagos importados: ${pagosRes.count}` : `✗ Error: ${pagosRes?.error}`
  );

  console.log("Importando Entregas (Cuentas Pendientes)...");
  const entRes = await importarEntregasDesdeSheet(sheetId);
  console.log(
    entRes?.success ? `✓ Entregas importadas: ${entRes.count}` : `✗ Error: ${entRes?.error}`
  );
}

async function main() {
  const sheetId = process.argv[2] || process.env.IMPORT_SHEET_ID;
  try {
    await conectarMongo();
    await importarMasivo(sheetId);
  } catch (error) {
    console.error("Error en importación masiva:", error);
    process.exitCode = 1;
  } finally {
    await desconectarMongo();
  }
}

if (require.main === module) {
  main();
}

module.exports = { importarMasivo };
