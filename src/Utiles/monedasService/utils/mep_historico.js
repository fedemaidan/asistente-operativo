require('dotenv').config();
const axios = require('axios');
const { db } = require('../../../../utils/firebaseUtils');



const DOLAR_HISTORIAL_REF = db.collection('dolar_historial');

async function upsertMEP(fecha, cierre) {
  const ref = DOLAR_HISTORIAL_REF.doc(fecha);
  await ref.set(
    {
      mep: {
        compra: null,
        venta: null,
        promedio: cierre,
      },
    },
    { merge: true }
  );
}

async function main() {
  try {
    const url = 'https://clasico.rava.com/lib/restapi/v3/publico/cotizaciones/historicos';

    const body = new URLSearchParams({
      access_token: '726db4733ec0b6e02169cd4c20fd6a82878b7dd7', // token público de Rava
      especie: 'DOLAR MEP',
      fecha_inicio: '2025-01-01',
      fecha_fin: '2025-09-28',
    });

    const { data } = await axios.post(url, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      },
    });

    if (!data || !Array.isArray(data.body)) {
      console.error('❌ Respuesta inesperada:', data);
      process.exit(1);
    }

    let updates = 0;
    for (const row of data.body) {
      const fecha = row.fecha; // YYYY-MM-DD
      const cierre = Number(row.cierre);
      if (!fecha || !Number.isFinite(cierre)) continue;

      await upsertMEP(fecha, cierre);
      updates++;
    }

    console.log(`✅ Backfill MEP (solo promedio) OK. Filas importadas: ${updates}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en backfill:', err);
    process.exit(1);
  }
}

main();
