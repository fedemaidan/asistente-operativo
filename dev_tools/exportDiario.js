require("dotenv").config();
const mongoose = require("mongoose");
const { google } = require("googleapis");

const { exportarMasivo } = require("./exportarMasivo");

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
  } catch (_) {}
}

function esFinDeSemana(fecha = new Date()) {
  const dia = fecha.getDay(); // 0 Domingo, 6 Sábado
  return dia === 0 || dia === 6;
}

function formatearNombreBackup(fecha = new Date()) {
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yy = String(fecha.getFullYear()).slice(-2);
  return `BACKUP ${dd}/${mm}/${yy}`;
}

function getGoogleAuth() {
  if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error(
      "GOOGLE_CREDENTIALS no configurado en variables de entorno."
    );
  }
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  return auth;
}

async function crearSpreadsheetEnCarpeta(folderId, title) {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    },
    fields: "id, name",
  });

  return res.data.id;
}

async function backupDiario() {
  // 1) No correr en fin de semana

  // 2) Obtener carpeta destino y crear Sheet "BACKUP dd/mm/yy"
  const folderId = process.env.BACKUP_FOLDER;
  if (!folderId || typeof folderId !== "string" || folderId.trim() === "") {
    throw new Error(
      "BACKUP_FOLDER no configurado. Definí la carpeta destino en .env."
    );
  }

  const nombre = formatearNombreBackup();
  console.log(`Creando Google Sheet para backup: "${nombre}" en carpeta ${folderId}`);
  const sheetId = await crearSpreadsheetEnCarpeta(folderId, nombre);
  console.log(`Sheet creado con ID: ${sheetId}`);

  // 3) Ejecutar exportMasivo hacia el Sheet
  console.log("Conectando a MongoDB...");
  await conectarMongo();
  try {
    console.log("Iniciando exportación masiva al Sheet creado...");
    await exportarMasivo(sheetId);
    console.log("Backup diario finalizado correctamente.");
  } finally {
    await desconectarMongo();
  }
}

async function main() {
  try {
    await backupDiario();
  } catch (err) {
    console.error("Error en backup diario:", err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { backupDiario };


