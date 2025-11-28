require("dotenv").config();
const mongoose = require("mongoose");
const Movimiento = require("../src/models/movimiento.model");
const ConversorMonedaService = require("../src/Utiles/monedasService/ConversorMonedasService");
const DolarService = require("../src/Utiles/monedasService/dolarService");

async function conectarMongo() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    "mongodb://127.0.0.1:27017/asistente-operativo";
  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB || undefined,
  });
}

async function desconectarMongo() {
  try {
    await mongoose.disconnect();
  } catch (_) {}
}

function round2(n) {
  const num = Number(n || 0);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

// Cache local por día del valor del dólar BLUE_VENTA
const dolarPorDiaCache = new Map(); // key: 'YYYY-MM-DD' -> Number(valor BLUE_VENTA)

async function obtenerDolarBlueVentaEnDia(fecha) {
  const fechaObj = fecha ? new Date(fecha) : new Date();
  const fechaStr = fechaObj.toISOString().split("T")[0];
  if (dolarPorDiaCache.has(fechaStr)) return dolarPorDiaCache.get(fechaStr);
  const valor = await DolarService.dameValorDelDolarEnFecha(fechaStr, "BLUE_VENTA");
  if (valor != null) dolarPorDiaCache.set(fechaStr, Number(valor));
  return valor;
}

async function calcularMontoDolarBalance(mov) {
  try {
    const sign = mov?.type === "EGRESO" ? -1 : 1;
    if (mov?.moneda === "USD") {
      const usdBlue = Number(mov?.total?.usdBlue || 0);
      return round2(usdBlue * sign);
    }
    if (mov?.moneda === "ARS") {
      const ars = Number(mov?.total?.ars || 0);
      const valorDolar = await obtenerDolarBlueVentaEnDia(mov?.fechaFactura);
      if (!valorDolar) return 0;
      const usd = (ars / Number(valorDolar)) * sign;
      return round2(usd);
    }
    // Si por alguna razón viene otra moneda, devolver 0
    return 0;
  } catch (err) {
    console.error(
      `Error calculando montoDolarBalance para movimiento ${mov?._id}:`,
      err?.message || err
    );
    return 0;
  }
}

async function migrarMontoDolaresBalance({ batchSize = 500 } = {}) {
  await conectarMongo();
  console.log("Iniciando migración de montoDolarBalance...");

  let procesados = 0;
  let actualizados = 0;
  let errores = 0;
  const bulkOps = [];

  const cursor = Movimiento.find({}, null, { lean: true }).cursor();
  for await (const mov of cursor) {
    procesados += 1;
    try {
      const nuevoValor = await calcularMontoDolarBalance(mov);
      // Reescribir SIEMPRE, aunque sea igual
      bulkOps.push({
        updateOne: {
          filter: { _id: mov._id },
          update: { $set: { montoDolarBalance: nuevoValor } },
        },
      });
      if (bulkOps.length >= batchSize) {
        const res = await Movimiento.bulkWrite(bulkOps, { ordered: false });
        actualizados += (res?.modifiedCount || 0) + (res?.upsertedCount || 0);
        bulkOps.length = 0;
        console.log(
          `Procesados: ${procesados} | Actualizados (parcial): ${actualizados}`
        );
      }
    } catch (e) {
      errores += 1;
      console.error(
        `Error procesando movimiento ${mov?._id}:`,
        e?.message || e
      );
    }
  }

  if (bulkOps.length > 0) {
    const res = await Movimiento.bulkWrite(bulkOps, { ordered: false });
    actualizados += (res?.modifiedCount || 0) + (res?.upsertedCount || 0);
  }

  console.log("Migración finalizada.");
  console.log(
    `Resumen -> Procesados: ${procesados} | Actualizados: ${actualizados} | Errores: ${errores}`
  );

  await desconectarMongo();
}

async function main() {
  try {
    await migrarMontoDolaresBalance();
  } catch (err) {
    console.error("Error en la migración:", err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrarMontoDolaresBalance };

