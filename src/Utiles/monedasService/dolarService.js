const axios = require('axios');
const { db } = require('../../services/fireBaseUtils');

const API_EVOLUTION_URL = 'https://api.bluelytics.com.ar/v2/evolution.json';
const API_LATEST_BLUELYTICS = 'https://api.bluelytics.com.ar/v2/latest';
const API_MEP_DOLARAPI = 'https://dolarapi.com/v1/dolares/bolsa'; // MEP (Dólar Bolsa)
const DOLAR_HISTORIAL_REF = db.collection('dolar_historial');

const DolarService = {
  // cache & config
  cache: null,
  lastFetchTime: null,
  CACHE_DURATION_MS: 30 * 60 * 1000,

  // ================= Utilidades =================
  formatearFecha(date) {
    return date.toISOString().split('T')[0];
  },

  async buscarEnFirebase(fechaStr, tipoDolar, campo) {
    campo = campo == 'medio' ? 'promedio' : campo;
    const doc = await DOLAR_HISTORIAL_REF.doc(fechaStr).get();
    if (doc.exists) {
      const datos = doc.data();
      return datos?.[tipoDolar]?.[campo] ?? null;
    }
    return null;
  },

  async guardarValorEnFirebase(fechaStr, tipoDolar, campo, valor) {
    await DOLAR_HISTORIAL_REF.doc(fechaStr).set({
      [tipoDolar]: { [campo]: valor }
    }, { merge: true });
  },

  // =============== Importadores (histórico Bluelytics) ===============
  async importarEvolucionDesdeAPI() {
    const res = await axios.get(API_EVOLUTION_URL);
    const data = res.data;

    const agrupado = {};
    for (const item of data) {
      const fecha = item.date; // yyyy-mm-dd
      if (!agrupado[fecha]) agrupado[fecha] = {};
      const fuente = (item.source || '').toLowerCase(); // oficial, blue, oficial_euro, blue_euro
      agrupado[fecha][fuente] = {
        compra: item.value_buy,
        venta: item.value_sell,
        promedio: (item.value_buy + item.value_sell) / 2
      };
    }

    // Guardamos todo en Firebase en batch
    const batch = db.batch();
    for (const [fecha, valores] of Object.entries(agrupado)) {
      const ref = DOLAR_HISTORIAL_REF.doc(fecha);
      batch.set(ref, valores, { merge: true });
    }
    await batch.commit();
    return agrupado;
  },

  // =============== Fetchers LIVE ===============
  async fetchBluelyticsLatest() {
    const { data } = await axios.get(API_LATEST_BLUELYTICS);
    return {
      oficial: {
        compra: data.oficial.value_buy,
        venta: data.oficial.value_sell,
        promedio: data.oficial.value_avg
      },
      blue: {
        compra: data.blue.value_buy,
        venta: data.blue.value_sell,
        promedio: data.blue.value_avg
      },
      oficial_euro: {
        compra: data.oficial_euro?.value_buy,
        venta: data.oficial_euro?.value_sell,
        promedio: data.oficial_euro?.value_avg
      },
      blue_euro: {
        compra: data.blue_euro?.value_buy,
        venta: data.blue_euro?.value_sell,
        promedio: data.blue_euro?.value_avg
      },
      ultima_actualizacion: data.last_update
    };
  },

  // MEP desde DolarApi.com (Dólar Bolsa)
  async fetchMepDolarApi() {
    const { data } = await axios.get(API_MEP_DOLARAPI);
    // data: { compra, venta, nombre:'bolsa', ... }
    const compra = Number(data.compra);
    const venta = Number(data.venta);
    return {
      mep: {
        compra,
        venta,
        promedio: (compra + venta) / 2
      },
      mep_updated_at: data.fechaActualizacion || null
    };
  },

  // =============== API pública del servicio ===============
  async obtenerValoresDolar() {
    const now = Date.now();
    if (this.cache && (now - this.lastFetchTime < this.CACHE_DURATION_MS)) {
      return this.cache;
    }

    try {
      // Pedimos en paralelo: bluelytics (oficial/blue) + MEP (DolarApi)
      const [bluelytics, mep] = await Promise.all([
        this.fetchBluelyticsLatest(),  // oficial/blue/...
        this.fetchMepDolarApi()        // mep
      ]);

      const valores = {
        ...bluelytics,
        ...mep // agrega { mep: {compra, venta, promedio} }
      };

      this.cache = valores;
      this.lastFetchTime = now;

      // Persistimos “hoy” en Firebase para facilitar históricos posteriores (incluye MEP)
      const hoyStr = this.formatearFecha(new Date());
      const batch = db.batch();
      const ref = DOLAR_HISTORIAL_REF.doc(hoyStr);
      const toSave = {
        oficial: bluelytics.oficial,
        blue: bluelytics.blue,
        mep: mep.mep
      };
      batch.set(ref, toSave, { merge: true });
      await batch.commit();

      return valores;

    } catch (error) {
      console.error('Error al obtener los valores del dólar:', error);
      if (this.cache) return this.cache;
      throw error;
    }
  },

  async dameValorDelDolar(dolar_conf) {
    const dolares = await this.obtenerValoresDolar();
    switch (dolar_conf) {
      case 'OFICIAL_COMPRA': return dolares.oficial.compra;
      case 'OFICIAL_VENTA': return dolares.oficial.venta;
      case 'OFICIAL_MEDIO': return dolares.oficial.promedio;
      case 'BLUE_COMPRA':   return dolares.blue.compra;
      case 'BLUE_VENTA':    return dolares.blue.venta;
      case 'BLUE_MEDIO':    return dolares.blue.promedio;

      // === NUEVO: MEP ===
      case 'MEP_COMPRA':    return dolares.mep.compra;
      case 'MEP_VENTA':     return dolares.mep.venta;
      case 'MEP_MEDIO':     return dolares.mep.promedio;

      case 'MANUAL':        return 0;
      default:              return undefined;
    }
  },

  async dameValorDelDolarEnFecha(fechaStr = null, tipo = 'BLUE_VENTA') {
    const hoy = new Date();
    const hoyStr = this.formatearFecha(hoy);
    const fechaBaseStr = fechaStr || hoyStr;

    const [tipoDolar, campo] = tipo.toLowerCase().split('_'); // ej: mep, venta

    // 1) Si es hoy → usar fuente “live”
    if (fechaBaseStr === hoyStr) {
      return this.dameValorDelDolar(tipo.toUpperCase());
    }
    console.log(fechaBaseStr, tipoDolar, campo);
    // 2) Buscar en Firebase (incluye MEP si lo persistimos previamente)
    const valorFirebase = await this.buscarEnFirebase(fechaBaseStr, tipoDolar, campo);
    if (valorFirebase !== null) return valorFirebase;

    // 3) Intentar importar evolución (solo oficial/blue; MEP no viene en Bluelytics)
    let datosAPI = {};
    if (tipoDolar !== 'mep') {
      try {
        datosAPI = await this.importarEvolucionDesdeAPI();
      } catch (err) {
        console.error('❌ Error al consultar evolución del dólar:', err);
      }
      const val = datosAPI?.[fechaBaseStr]?.[tipoDolar]?.[campo];
      if (val !== undefined) {
        await this.guardarValorEnFirebase(fechaBaseStr, tipoDolar, campo, val);
        return val;
      }
    }

    // 4) Retroceder hasta 10 días en Firebase (para MEP y resto si falla)
    const maxDiasRetroceso = 10;
    const fechaConsulta = new Date(fechaBaseStr);
    for (let i = 1; i <= maxDiasRetroceso; i++) {
      fechaConsulta.setDate(fechaConsulta.getDate() - 1);
      const prevStr = this.formatearFecha(fechaConsulta);
      const valAnt = await this.buscarEnFirebase(prevStr, tipoDolar, campo);
      if (valAnt !== null) {
        await this.guardarValorEnFirebase(fechaBaseStr, tipoDolar, campo, valAnt);
        return valAnt;
      }
    }

    console.warn(`⚠️ No se encontró valor de dólar (${tipo}) para ${fechaBaseStr} ni días anteriores`);
    return null;
  }
};

module.exports = DolarService;
