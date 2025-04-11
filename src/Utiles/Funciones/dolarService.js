const axios = require("axios");

const DolarService = {
  // Obtener los valores de los distintos tipos de dólar
  async obtenerValoresDolar() {
    try {
      const response = await axios.get(
        "https://api.bluelytics.com.ar/v2/latest"
      );
      const data = response.data;

      // Extraer y retornar los valores relevantes
      const valores = {
        oficial: {
          compra: data.oficial.value_buy,
          venta: data.oficial.value_sell,
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

      console.log("Valores obtenidos:", valores);
      return valores;
    } catch (error) {
      console.error("Error al obtener los valores del dólar:", error);
      throw error;
    }
  },
  async dameValorDelDolar(dolar_conf) {
    //DEVOLVER EL DE VENTA
    const dolares = await this.obtenerValoresDolar();
    console.log(dolares);
    switch (dolar_conf) {
      case "USD_OFICIAL_COMPRA":
        return dolares.oficial.compra;
      case "USD_OFICIAL_VENTA":
        return dolares.oficial.venta;
      case "USD_OFICIAL_MEDIO":
        return dolares.oficial.promedio;
      case "USD_BLUE_COMPRA":
        return dolares.blue.compra;
      case "USD_BLUE_VENTA":
        return dolares.blue.venta;
      case "USD_BLUE_MEDIO":
        return dolares.blue.promedio;
      case "MANUAL":
        return 0;
    }
  },
};

module.exports = DolarService;
