function getDescuentoGeneral(comprobante, tipo) {
    if (tipo === 'CHEQUE') {
        return 1.8 * comprobante.monto / 100;
    } else if (tipo === 'TRANSFERENCIA') {
        return 2 * comprobante.monto / 100;
}}

module.exports = {getDescuentoGeneral};