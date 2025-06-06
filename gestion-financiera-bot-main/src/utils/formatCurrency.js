function formatCurrency(value, currency = 'ARS', locale = 'es-AR') {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
        }).format(value);
    }
    catch (e) {
        return false;
    }
}

module.exports = {formatCurrency}