const CACService = require('./CACService');
const DolarService = require('./dolarService');

const ConversorMonedaService = {
  async convertir({ monto, moneda_origen, moneda_destino, fecha, tipo_dolar = 'BLUE_VENTA' }) {
    if (!moneda_origen || !moneda_destino || monto == null) {
      console.log('Faltan datos para convertir moneda:', {
        monto,
        moneda_origen,
        moneda_destino,
        fecha,
        tipo_dolar})
      throw new Error('Faltan datos para convertir moneda');
    }

    if (moneda_origen === moneda_destino) {
      return {
        monto_convertido: parseFloat(monto),
        detalle: 'Moneda origen y destino iguales'
      };
    }

    const fechaObj = new Date(fecha || new Date());
    const fechaStr = fechaObj.toISOString().split('T')[0];
    const fechaAAAAMM = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}`;

    let monto_convertido;

    // CASOS POSIBLES
    if (moneda_destino === 'USD') {
      const valorDolar = await DolarService.dameValorDelDolarEnFecha(fechaStr, tipo_dolar);
      if (!valorDolar) throw new Error('No se encontró valor del dólar');
      if (moneda_origen === 'ARS') monto_convertido = monto / valorDolar;
      if (moneda_origen === 'CAC') {
        const indiceCAC = await CACService.dameIndiceParaFechaDeUsoReal(fechaAAAAMM);
        if (!indiceCAC?.valor) throw new Error('No se encontró índice CAC');
        const montoEnPesos = monto * indiceCAC.valor;
        monto_convertido = montoEnPesos / valorDolar;
      }
    } else if (moneda_destino === 'ARS') {
      if (moneda_origen === 'USD') {
        const valorDolar = await DolarService.dameValorDelDolarEnFecha(fechaStr, tipo_dolar);
        if (!valorDolar) throw new Error('No se encontró valor del dólar');
        monto_convertido = monto * valorDolar;
      }
      if (moneda_origen === 'CAC') {
        const indiceCAC = await CACService.dameIndiceParaFechaDeUsoReal(fechaAAAAMM);
        if (!indiceCAC?.valor) throw new Error('No se encontró índice CAC');
        monto_convertido = monto * indiceCAC.valor;
      }
    } else if (moneda_destino === 'CAC') {
      const indiceCAC = await CACService.dameIndiceParaFechaDeUsoReal(fechaAAAAMM);
      if (!indiceCAC?.valor) throw new Error('No se encontró índice CAC');

      if (moneda_origen === 'ARS') {
        monto_convertido = monto / indiceCAC.valor;
      }
      if (moneda_origen === 'USD') {
        const valorDolar = await DolarService.dameValorDelDolarEnFecha(fechaStr, tipo_dolar);
        if (!valorDolar) throw new Error('No se encontró valor del dólar');
        const montoEnPesos = monto * valorDolar;
        monto_convertido = montoEnPesos / indiceCAC.valor;
      }
    }

    if (monto_convertido == null) {
      throw new Error(`Conversión de ${moneda_origen} a ${moneda_destino} no soportada`);
    }

    return {
      monto_convertido: parseFloat(monto_convertido.toFixed(2)),
      detalle: `Conversión de ${moneda_origen} a ${moneda_destino}`,
    };
  }
};

module.exports = ConversorMonedaService;
