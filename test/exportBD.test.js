const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const { setupDB, teardownDB, clearDB, getMemoryUri } = require("./setupMongo");
const Movimiento = require("../src/models/movimiento.model");
const CuentaPendiente = require("../src/models/cuentaPendiente.model");

require("dotenv").config({ path: path.join(__dirname, "../../.env") });
require("dotenv").config();

const SPREADSHEET_ID = "1d-4tHPvdxYx61QZQY6FG3wxRyNyrFRuFGyZG7-riGNM";

const SHEETS = ["Clientes", "Comprobantes", "Pagos", "Entregas"];

async function cleanupSheets(spreadsheetId) {
  const cleanupScript = path.join(__dirname, "../dev_tools/cleanupSheets.js");
  await runNodeScript(cleanupScript, [spreadsheetId, ...SHEETS]);
}

function round2(n) {
  return Math.round(Number(n || 0));
}

function expectEqual2(a, b, msg) {
  expect(round2(a)).toBe(round2(b));
}

async function aggregateMovimientosNative(db) {
  const coll = db.collection("movimientos");
  const cursor = coll.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: null,
        ars: { $sum: { $ifNull: ["$total.ars", 0] } },
        usdBlue: { $sum: { $ifNull: ["$total.usdBlue", 0] } },
        usdOficial: { $sum: { $ifNull: ["$total.usdOficial", 0] } },
      },
    },
  ]);
  const arr = await cursor.toArray();
  const doc = arr[0] || { ars: 0, usdBlue: 0, usdOficial: 0 };
  return { ars: doc.ars || 0, usdBlue: doc.usdBlue || 0, usdOficial: doc.usdOficial || 0 };
}

async function aggregateCuentasPendientesNative(db) {
  const coll = db.collection("cuentapendientes");
  const cursor = coll.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: null,
        subARS: { $sum: { $ifNull: ["$subTotal.ars", 0] } },
        subBlue: { $sum: { $ifNull: ["$subTotal.usdBlue", 0] } },
        subOf: { $sum: { $ifNull: ["$subTotal.usdOficial", 0] } },
        totARS: { $sum: { $ifNull: ["$montoTotal.ars", 0] } },
        totBlue: { $sum: { $ifNull: ["$montoTotal.usdBlue", 0] } },
        totOf: { $sum: { $ifNull: ["$montoTotal.usdOficial", 0] } },
      },
    },
  ]);
  const arr = await cursor.toArray();
  const d = arr[0] || {
    subARS: 0,
    subBlue: 0,
    subOf: 0,
    totARS: 0,
    totBlue: 0,
    totOf: 0,
  };
  return d;
}

async function aggregateMovimientosDestino() {
  const res = await Movimiento.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: null,
        ars: { $sum: { $ifNull: ["$total.ars", 0] } },
        usdBlue: { $sum: { $ifNull: ["$total.usdBlue", 0] } },
        usdOficial: { $sum: { $ifNull: ["$total.usdOficial", 0] } },
      },
    },
  ]);
  const d = res[0] || { ars: 0, usdBlue: 0, usdOficial: 0 };
  return { ars: d.ars || 0, usdBlue: d.usdBlue || 0, usdOficial: d.usdOficial || 0 };
}

async function aggregateCuentasPendientesDestino() {
  const res = await CuentaPendiente.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: null,
        subARS: { $sum: { $ifNull: ["$subTotal.ars", 0] } },
        subBlue: { $sum: { $ifNull: ["$subTotal.usdBlue", 0] } },
        subOf: { $sum: { $ifNull: ["$subTotal.usdOficial", 0] } },
        totARS: { $sum: { $ifNull: ["$montoTotal.ars", 0] } },
        totBlue: { $sum: { $ifNull: ["$montoTotal.usdBlue", 0] } },
        totOf: { $sum: { $ifNull: ["$montoTotal.usdOficial", 0] } },
      },
    },
  ]);
  const d = res[0] || {
    subARS: 0,
    subBlue: 0,
    subOf: 0,
    totARS: 0,
    totBlue: 0,
    totOf: 0,
  };
  return d;
}

async function aggregateMovimientosNativePorTipo(db, tipo) {
  const coll = db.collection("movimientos");
  const cursor = coll.aggregate([
    { $match: { active: true, type: tipo } },
    {
      $group: {
        _id: null,
        ars: { $sum: { $ifNull: ["$total.ars", 0] } },
        usdBlue: { $sum: { $ifNull: ["$total.usdBlue", 0] } },
        usdOficial: { $sum: { $ifNull: ["$total.usdOficial", 0] } },
      },
    },
  ]);
  const arr = await cursor.toArray();
  const doc = arr[0] || { ars: 0, usdBlue: 0, usdOficial: 0 };
  return { ars: doc.ars || 0, usdBlue: doc.usdBlue || 0, usdOficial: doc.usdOficial || 0 };
}

async function aggregateMovimientosDestinoPorTipo(tipo) {
  const res = await Movimiento.aggregate([
    { $match: { active: true, type: tipo } },
    {
      $group: {
        _id: null,
        ars: { $sum: { $ifNull: ["$total.ars", 0] } },
        usdBlue: { $sum: { $ifNull: ["$total.usdBlue", 0] } },
        usdOficial: { $sum: { $ifNull: ["$total.usdOficial", 0] } },
      },
    },
  ]);
  const d = res[0] || { ars: 0, usdBlue: 0, usdOficial: 0 };
  return { ars: d.ars || 0, usdBlue: d.usdBlue || 0, usdOficial: d.usdOficial || 0 };
}

function runNodeScript(scriptPath, args = [], extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ code, out, err });
      else reject(new Error(`Script exited with code ${code}\n${out}\n${err}`));
    });
  });
}

describe("Exportar/Importar BD a Google Sheets y reimportar a Mongo en memoria", () => {
  let originConn;

  beforeAll(async () => {
    // BD destino (memoria)
    await setupDB();
    if (Movimiento.syncIndexes) await Movimiento.syncIndexes();
    if (CuentaPendiente.syncIndexes) await CuentaPendiente.syncIndexes();
  }, 120000);

  afterAll(async () => {
    await teardownDB();
    if (originConn) {
      try {
        await originConn.close();
      } catch (_) {}
    }
  });

  afterEach(async () => {
    await clearDB();
  });

  test(
    "exporta desde origen a Sheets, importa a memoria y compara totales",
    async () => {
      const mongoUriOrigen =
        process.env.MONGO_URI || "mongodb://localhost:27017/celulandia-test";

      await cleanupSheets(SPREADSHEET_ID);

      originConn = await mongoose.createConnection(mongoUriOrigen).asPromise();
      const originDb = originConn.db;

      // Totales por tipo (MOVIMIENTOS)
      const origenMovIngresos = await aggregateMovimientosNativePorTipo(
        originDb,
        "INGRESO"
      );

      const origenMovEgresos = await aggregateMovimientosNativePorTipo(
        originDb,
        "EGRESO"
      );


      // Totales CP (para mantener validación existente)
      const origenCP = await aggregateCuentasPendientesNative(originDb);

      // Exportación BD origen -> Sheets
      const exportScript = path.join(
        __dirname,
        "../dev_tools/exportarMasivo.js"
      );
      const resExport = await runNodeScript(exportScript, [SPREADSHEET_ID], {
        MONGO_URI: mongoUriOrigen,
      });
      if (resExport?.out) console.log("[Export stdout]", resExport.out);

      // Importación Sheets -> BD en memoria
      const importScript = path.join(
        __dirname,
        "../dev_tools/importarMasivo.js"
      );
      const memoryUri = getMemoryUri();
      await runNodeScript(importScript, [SPREADSHEET_ID], {
        MONGO_URI: memoryUri,
        MONGO_DB: "test-db",
      });

      // Totales por tipo en destino (MOVIMIENTOS)
      const destinoMovIngresos = await aggregateMovimientosDestinoPorTipo(
        "INGRESO"
      );

      const destinoMovEgresos = await aggregateMovimientosDestinoPorTipo(
        "EGRESO"
      );
      // Totales CP en destino (validación existente)
      const destinoCP = await aggregateCuentasPendientesDestino();

      console.log("origenMovIngresos", origenMovIngresos);
      console.log("destinoMovIngresos", destinoMovIngresos);
      console.log("origenMovEgresos", origenMovEgresos);
      console.log("destinoMovEgresos", destinoMovEgresos);
      console.log("origenCP", origenCP);
      console.log("destinoCP", destinoCP);

      // Comparaciones de MOVIMIENTOS separadas por tipo
      expectEqual2(
        destinoMovIngresos.ars,
        origenMovIngresos.ars,
        "Movimiento INGRESO total.ars"
      );
      expectEqual2(
        destinoMovIngresos.usdBlue,
        origenMovIngresos.usdBlue,
        "Movimiento INGRESO total.usdBlue"
      );
      expectEqual2(
        destinoMovIngresos.usdOficial,
        origenMovIngresos.usdOficial,
        "Movimiento INGRESO total.usdOficial"
      );

      expectEqual2(
        destinoMovEgresos.ars,
        origenMovEgresos.ars,
        "Movimiento EGRESO total.ars"
      );
      expectEqual2(
        destinoMovEgresos.usdBlue,
        origenMovEgresos.usdBlue,
        "Movimiento EGRESO total.usdBlue"
      );
      expectEqual2(
        destinoMovEgresos.usdOficial,
        origenMovEgresos.usdOficial,
        "Movimiento EGRESO total.usdOficial"
      );

      // Comparaciones de CUENTAS PENDIENTES (se mantienen)
      expectEqual2(destinoCP.subARS, origenCP.subARS, "CP subTotal.ars");
      expectEqual2(destinoCP.subBlue, origenCP.subBlue, "CP subTotal.usdBlue");
      expectEqual2(
        destinoCP.subOf,
        origenCP.subOf,
        "CP subTotal.usdOficial"
      );

      expectEqual2(destinoCP.totARS, origenCP.totARS, "CP montoTotal.ars");
      expectEqual2(
        destinoCP.totBlue,
        origenCP.totBlue,
        "CP montoTotal.usdBlue"
      );
      expectEqual2(
        destinoCP.totOf,
        origenCP.totOf,
        "CP montoTotal.usdOficial"
      );

      // Counts comparación (active: true)
      const origenMovCount = await originDb
        .collection("movimientos")
        .countDocuments({ active: true, type: { $in: ["INGRESO", "EGRESO"] } });
      const origenCPCount = await originDb
        .collection("cuentapendientes")
        .countDocuments({ active: true });
      const destinoMovCount = await Movimiento.countDocuments({
        active: true,
        type: { $in: ["INGRESO", "EGRESO"] },
      });
      const destinoCPCount = await CuentaPendiente.countDocuments({
        active: true,
      });

      console.log("origenMovCount", origenMovCount);
      console.log("destinoMovCount", destinoMovCount);
      console.log("origenCPCount", origenCPCount);
      console.log("destinoCPCount", destinoCPCount);

      expect(destinoMovCount).toBe(origenMovCount);
      expect(destinoCPCount).toBe(origenCPCount);
    },
    180000
  );

  test(
    "exporta/importa y valida que las cantidades (active: true) coinciden entre origen y destino",
    async () => {
      const mongoUriOrigen =
        process.env.MONGO_URI || "mongodb://localhost:27017/celulandia-test";

      await cleanupSheets(SPREADSHEET_ID);

      const originConn2 = await mongoose
        .createConnection(mongoUriOrigen)
        .asPromise();
      const originDb2 = originConn2.db;

      const origenMovCount = await originDb2
        .collection("movimientos")
        .countDocuments({ active: true, type: { $in: ["INGRESO", "EGRESO"] } });
      const origenCPCount = await originDb2
        .collection("cuentapendientes")
        .countDocuments({ active: true });

      const exportScript = path.join(
        __dirname,
        "../dev_tools/exportarMasivo.js"
      );
      await runNodeScript(exportScript, [SPREADSHEET_ID], {
        MONGO_URI: mongoUriOrigen,
      });

      const importScript = path.join(
        __dirname,
        "../dev_tools/importarMasivo.js"
      );
      const memoryUri = getMemoryUri();
      await runNodeScript(importScript, [SPREADSHEET_ID], {
        MONGO_URI: memoryUri,
        MONGO_DB: "test-db",
      });

      const destinoMovCount = await Movimiento.countDocuments({
        active: true,
        type: { $in: ["INGRESO", "EGRESO"] },
      });
      const destinoCPCount = await CuentaPendiente.countDocuments({
        active: true,
      });

      expect(destinoMovCount).toBe(origenMovCount);
      expect(destinoCPCount).toBe(origenCPCount);

      await originConn2.close();
    },
    180000
  );
});


