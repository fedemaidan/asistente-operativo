require("dotenv").config();
const mongoose = require("mongoose");

const { exportarClientesASheet } = require("../src/backup/exportarClientes");
const { exportarComprobantesASheet } = require("../src/backup/exportarComprobantes");
const { exportarPagosASheet } = require("../src/backup/exportarPagos");
const { exportarEntregasASheet } = require("../src/backup/exportarEntregas");

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

async function exportarMasivo(sheetId) {
  if (!sheetId || typeof sheetId !== "string" || sheetId.trim() === "") {
    throw new Error(
      "Sheet ID no provisto. Pasá el ID por CLI o variable de entorno EXPORT_SHEET_ID."
    );
  }

  console.log(`Usando Sheet ID: ${sheetId}`);

  // 1) Clientes
  console.log("Exportando Clientes...");
  const resClientes = await exportarClientesASheet(sheetId);
  if (resClientes?.success) {
    console.log(`✓ Clientes exportados: ${resClientes.count}`);
  } else {
    console.warn("✗ Error exportando clientes:", resClientes?.error || "desconocido");
  }

  // 2) Comprobantes (INGRESOS activos)
  console.log("Exportando Comprobantes...");
  const resComprobantes = await exportarComprobantesASheet(sheetId);
  if (resComprobantes?.success) {
    console.log(`✓ Comprobantes exportados: ${resComprobantes.count}`);
  } else {
    console.warn(
      "✗ Error exportando comprobantes:",
      resComprobantes?.error || "desconocido"
    );
  }

  // 3) Pagos (EGRESOS)
  console.log("Exportando Pagos...");
  const resPagos = await exportarPagosASheet(sheetId);
  if (resPagos?.success) {
    console.log(`✓ Pagos exportados: ${resPagos.count}`);
  } else {
    console.warn("✗ Error exportando pagos:", resPagos?.error || "desconocido");
  }

  // 4) Entregas (Cuentas Pendientes)
  console.log("Exportando Entregas...");
  const resEntregas = await exportarEntregasASheet(sheetId);
  if (resEntregas?.success) {
    console.log(`✓ Entregas exportadas: ${resEntregas.count}`);
  } else {
    console.warn("✗ Error exportando entregas:", resEntregas?.error || "desconocido");
  }
}

async function main() {
  const sheetId = process.argv[2] || process.env.EXPORT_SHEET_ID;
  try {
    await conectarMongo();
    await exportarMasivo(sheetId);
  } catch (error) {
    console.error("Error en exportación masiva:", error);
    process.exitCode = 1;
  } finally {
    await desconectarMongo();
  }
}

if (require.main === module) {
  main();
}

module.exports = { exportarMasivo };
