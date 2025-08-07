const axios = require("axios");
const getDolarOficialBancoNacion = require("./dolarOficialBNA");

const DolarService = {
  cache: null,
  lastFetchTime: null,
  CACHE_DURATION_MS: 30 * 60 * 1000, // 30 minutos

  async obtenerValoresDolar() {
    const now = Date.now();

    if (this.cache && now - this.lastFetchTime < this.CACHE_DURATION_MS) {
      // Si los datos están en caché y no expiraron, devolvémoslos
      return this.cache;
    }

    try {
      const response = await axios.get(
        "https://api.bluelytics.com.ar/v2/latest"
      );
      const data = response.data;

      const oficialBNA = await getDolarOficialBancoNacion();

      const valores = {
        oficial: {
          compra: data.oficial.value_buy,
          venta: oficialBNA,
          promedio: data.oficial.value_avg,
        },
        blue: {
          compra: data.blue.value_buy,
          venta: data.blue.value_sell,
          promedio: data.blue.value_avg,
        },
        oficial_euro: {
          compra: data.oficial_euro.value_buy,
          venta: data.oficial_euro.value_sell,
          promedio: data.oficial_euro.value_avg,
        },
        blue_euro: {
          compra: data.blue_euro.value_buy,
          venta: data.blue_euro.value_sell,
          promedio: data.blue_euro.value_avg,
        },
        ultima_actualizacion: data.last_update,
      };

      // Actualizamos el caché
      this.cache = valores;
      this.lastFetchTime = now;

      return valores;
    } catch (error) {
      console.error("Error al obtener los valores del dólar:", error);
      // Si hay error y hay cache previa, devolvemos eso como fallback
      if (this.cache) return this.cache;
      throw error;
    }
  },

  async dameValorDelDolar(dolar_conf) {
    const dolares = await this.obtenerValoresDolar();

    switch (dolar_conf) {
      case "OFICIAL_COMPRA":
        return dolares.oficial.compra;
      case "OFICIAL_VENTA":
        return dolares.oficial.venta;
      case "OFICIAL_MEDIO":
        return dolares.oficial.promedio;
      case "BLUE_COMPRA":
        return dolares.blue.compra;
      case "BLUE_VENTA":
        return dolares.blue.venta;
      case "BLUE_MEDIO":
        return dolares.blue.promedio;
      case "MANUAL":
        return 0;
    }
  },
};

module.exports = DolarService;
