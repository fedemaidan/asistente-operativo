require("dotenv").config();
const { google } = require("googleapis");

async function getSheetsClient() {
  const credsRaw = process.env.GOOGLE_CREDENTIALS;
  if (!credsRaw) {
    throw new Error(
      "GOOGLE_CREDENTIALS no está definido. Coloca el JSON stringify en .env"
    );
  }
  const credentials = JSON.parse(credsRaw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  return google.sheets({ version: "v4", auth });
}

async function getSpreadsheetSheets(sheetsClient, spreadsheetId) {
  const resp = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const list = resp.data?.sheets || [];
  return list.map((s) => s.properties);
}

async function deleteSheetIfExists(sheetsClient, spreadsheetId, title) {
  const props = await getSpreadsheetSheets(sheetsClient, spreadsheetId);
  const found = props.find((p) => p.title === title);
  if (!found) return;
  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteSheet: {
            sheetId: found.sheetId,
          },
        },
      ],
    },
  });
}

async function main() {
  const spreadsheetId = process.argv[2];
  const names = process.argv.slice(3);
  if (!spreadsheetId) {
    console.error("Uso: node cleanupSheets.js <spreadsheetId> [sheetName...]");
    process.exit(1);
  }
  const sheets = await getSheetsClient();
  const targets =
    names.length > 0 ? names : ["Clientes", "Comprobantes", "Pagos", "Entregas"];
  for (const name of targets) {
    await deleteSheetIfExists(sheets, spreadsheetId, name);
  }
  console.log("Cleanup de sheets completado:", targets.join(", "));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}


