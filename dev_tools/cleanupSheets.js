require("dotenv").config();
const { google } = require("googleapis");

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function isQuota429(err) {
  const code = err?.code || err?.response?.status;
  const status = err?.status || err?.cause?.status;
  const message = err?.message || err?.cause?.message || "";
  return (
    code === 429 ||
    status === 429 ||
    status === "RESOURCE_EXHAUSTED" ||
    /quota/i.test(message) ||
    /Too Many Requests/i.test(message)
  );
}

async function withBackoff(fn, { retries = 6, baseMs = 500, maxMs = 10000 } = {}) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isQuota429(err)) {
        throw err;
      }
      const delay =
        Math.min(maxMs, baseMs * Math.pow(2, attempt)) *
        (0.6 + Math.random() * 0.8); // jitter 0.6x - 1.4x
      await sleep(delay);
      attempt += 1;
    }
  }
  throw lastErr;
}

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
  const resp = await withBackoff(() =>
    sheetsClient.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    })
  );
  const list = resp.data?.sheets || [];
  return list.map((s) => s.properties);
}

async function deleteSheetIfExists(sheetsClient, spreadsheetId, title) {
  const props = await getSpreadsheetSheets(sheetsClient, spreadsheetId);
  const found = props.find((p) => p.title === title);
  if (!found) return;
  await withBackoff(() =>
    sheetsClient.spreadsheets.batchUpdate({
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
    })
  );
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
    // pequeña pausa entre operaciones para no golpear el rate-limit
    await sleep(250);
  }
  console.log("Cleanup de sheets completado:", targets.join(", "));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}


