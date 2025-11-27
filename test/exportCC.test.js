const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const {
  setupDB,
  teardownDB,
  clearDB,
  getMemoryUri,
} = require("./setupMongo");
const MovimientoController = require("../src/controllers/movimientoController");

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

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function debugClienteEnDb(db, nombre, tag) {
  const cli = await db.collection("clientes").findOne({
    nombre: { $regex: `^${escapeRegex(nombre)}$`, $options: "i" },
  });
  console.log(`[debug][${tag}] cliente:`, cli?._id, cli?.nombre);

  const movs = await db
    .collection("movimientos")
    .find({ active: true, clienteId: cli?._id })
    .project({ type: 1, cuentaCorriente: 1, total: 1 })
    .toArray();
  console.log(`[debug][${tag}] movs:`, movs);

  const cps = await db
    .collection("cuentapendientes")
    .find({ active: true, cliente: cli?._id })
    .project({ cc: 1, montoTotal: 1 })
    .toArray();
  console.log(`[debug][${tag}] cps:`, cps);
}

async function aggregateClientesTotalesOriginNative(db) {
  // 1) Cuentas Pendientes agrupadas por cliente (active: true)
  const cuentasColl = db.collection("cuentapendientes");
  const cuentasAgg = await cuentasColl
    .aggregate([
      { $match: { active: true, cliente: { $ne: null, $exists: true } } },
      {
        $group: {
          _id: "$cliente",
          totalARS: {
            $sum: { $cond: [{ $eq: ["$cc", "ARS"] }, "$montoTotal.ars", 0] },
          },
          totalUSDBlue: {
            $sum: {
              $cond: [{ $eq: ["$cc", "USD BLUE"] }, "$montoTotal.usdBlue", 0],
            },
          },
          totalUSDOficial: {
            $sum: {
              $cond: [
                { $eq: ["$cc", "USD OFICIAL"] },
                "$montoTotal.usdOficial",
                0,
              ],
            },
          },
          fechaUltimaEntrega: { $max: "$fechaCuenta" },
        },
      },
    ])
    .toArray();

  const cuentasMap = new Map();
  for (const c of cuentasAgg) {
    cuentasMap.set(String(c._id), {
      totalARS: c.totalARS || 0,
      totalUSDBlue: c.totalUSDBlue || 0,
      totalUSDOficial: c.totalUSDOficial || 0,
      fechaUltimaEntrega: c.fechaUltimaEntrega || null,
    });
  }

  // 2) Movimientos agrupados por clienteId (active: true)
  const movsColl = db.collection("movimientos");
  const movsAgg = await movsColl
    .aggregate([
      { $match: { active: true, clienteId: { $ne: null, $exists: true } } },
      {
        $group: {
          _id: "$clienteId",
          totalARS: {
            $sum: {
              $cond: [
                { $eq: ["$cuentaCorriente", "ARS"] },
                {
                  $cond: [
                    { $eq: ["$type", "INGRESO"] },
                    "$total.ars",
                    { $multiply: ["$total.ars", -1] },
                  ],
                },
                0,
              ],
            },
          },
          totalUSDBlue: {
            $sum: {
              $cond: [
                { $eq: ["$cuentaCorriente", "USD BLUE"] },
                {
                  $cond: [
                    { $eq: ["$type", "INGRESO"] },
                    "$total.usdBlue",
                    { $multiply: ["$total.usdBlue", -1] },
                  ],
                },
                0,
              ],
            },
          },
          totalUSDOficial: {
            $sum: {
              $cond: [
                { $eq: ["$cuentaCorriente", "USD OFICIAL"] },
                {
                  $cond: [
                    { $eq: ["$type", "INGRESO"] },
                    "$total.usdOficial",
                    { $multiply: ["$total.usdOficial", -1] },
                  ],
                },
                0,
              ],
            },
          },
          fechaUltimoPago: {
            $max: { $cond: [{ $eq: ["$type", "INGRESO"] }, "$fechaFactura", null] },
          },
        },
      },
    ])
    .toArray();

  const movsMap = new Map();
  for (const m of movsAgg) {
    movsMap.set(String(m._id), {
      totalARS: m.totalARS || 0,
      totalUSDBlue: m.totalUSDBlue || 0,
      totalUSDOficial: m.totalUSDOficial || 0,
      fechaUltimoPago: m.fechaUltimoPago || null,
    });
  }

  // 3) Lista de clientes
  const clientes = await db.collection("clientes").find({}).toArray();

  const clientesTotales = clientes.map((cliente) => {
    const clienteId = String(cliente._id);
    const cuenta = cuentasMap.get(clienteId) || {
      totalARS: 0,
      totalUSDBlue: 0,
      totalUSDOficial: 0,
      fechaUltimaEntrega: null,
    };
    const mov = movsMap.get(clienteId) || {
      totalARS: 0,
      totalUSDBlue: 0,
      totalUSDOficial: 0,
      fechaUltimoPago: null,
    };
    return {
      _id: cliente._id,
      cliente: cliente.nombre,
      ARS: (cuenta.totalARS || 0) + (mov.totalARS || 0),
      "USD BLUE": (cuenta.totalUSDBlue || 0) + (mov.totalUSDBlue || 0),
      "USD OFICIAL": (cuenta.totalUSDOficial || 0) + (mov.totalUSDOficial || 0),
      fechaUltimoPago: mov.fechaUltimoPago || null,
      fechaUltimaEntrega: cuenta.fechaUltimaEntrega || null,
    };
  });

  clientesTotales.sort((a, b) => String(a.cliente).localeCompare(String(b.cliente)));
  return clientesTotales;
}

describe("Exportar/Importar y comparar totales por cliente (CC)", () => {
  let originConn;

  beforeAll(async () => {
    // BD destino (memoria)
    await setupDB();
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
    "exporta desde origen a Sheets, importa a memoria y compara totales por cliente",
    async () => {
      const mongoUriOrigen =
        process.env.MONGO_URI || "mongodb://localhost:27017/celulandia-test";

      await cleanupSheets(SPREADSHEET_ID);

      originConn = await mongoose.createConnection(mongoUriOrigen).asPromise();
      const originDb = originConn.db;

      // Totales por cliente en origen (nativo)
      const origenClientesTotales = await aggregateClientesTotalesOriginNative(
        originDb
      );

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

      // Totales por cliente en destino usando el Controller
      const destinoResp = await MovimientoController.getClientesTotalesV2();
      expect(destinoResp?.success).toBe(true);
      const destinoClientesTotales = destinoResp.data || [];

      // Comparación por nombre de cliente
      const keyName = (s) => String(s || "").trim().toLowerCase();
      const origenMap = new Map(
        origenClientesTotales.map((c) => [keyName(c.cliente), c])
      );
      const destinoMap = new Map(
        destinoClientesTotales.map((c) => [keyName(c.cliente), c])
      );

      // Construir reportes de diferencias antes de asertar para loguear todo
      const onlyInOrigin = [];
      const onlyInDestino = [];
      const diffs = [];

      for (const name of origenMap.keys()) {
        if (!destinoMap.has(name)) {
          onlyInDestino.push({ cliente: origenMap.get(name).cliente });
        }
      }
      for (const name of destinoMap.keys()) {
        if (!origenMap.has(name)) {
          onlyInOrigin.push({ cliente: destinoMap.get(name).cliente });
        }
      }

      for (const [name, orig] of origenMap.entries()) {
        const dest = destinoMap.get(name);
        if (!dest) continue;

        const mismatchARS = round2(dest.ARS) !== round2(orig.ARS);
        const mismatchBlue =
          round2(dest["USD BLUE"]) !== round2(orig["USD BLUE"]);
        const mismatchOf =
          round2(dest["USD OFICIAL"]) !== round2(orig["USD OFICIAL"]);

        if (mismatchARS || mismatchBlue || mismatchOf) {
          diffs.push({
            cliente: orig.cliente,
            origen: {
              ARS: round2(orig.ARS),
              USD_BLUE: round2(orig["USD BLUE"]),
              USD_OFICIAL: round2(orig["USD OFICIAL"]),
            },
            destino: {
              ARS: round2(dest.ARS),
              USD_BLUE: round2(dest["USD BLUE"]),
              USD_OFICIAL: round2(dest["USD OFICIAL"]),
            },
          });
        }
      }

      if (onlyInOrigin.length || onlyInDestino.length || diffs.length) {
        console.log("[exportCC] Diferencias detectadas:", JSON.stringify({
          soloEnOrigen: onlyInOrigin,
          soloEnDestino: onlyInDestino,
          diferencias: diffs,
        }, null, 2));

        // Debug adicional: movimientos con clienteId null en destino
        const nullCount = await mongoose.connection.db
          .collection("movimientos")
          .countDocuments({ active: true, clienteId: null });
        console.log("[debug][destino] movimientos con clienteId null:", nullCount);

        // Debug por cliente para los primeros 10 con diferencias
        const sample = diffs.slice(0, 10);
        for (const d of sample) {
          const name = d.cliente;
          console.log(`\n[debug] === Cliente con diferencia: ${name} ===`);
          await debugClienteEnDb(originDb, name, "origen");
          await debugClienteEnDb(mongoose.connection.db, name, "destino");
        }
      }

      // Asserts finales
      expect(onlyInOrigin.length).toBe(0);
      expect(onlyInDestino.length).toBe(0);
      expect(diffs.length).toBe(0);

      await originConn.close();
      originConn = null;
    },
    180000
  );
});


