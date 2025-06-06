const { admin } = require('../services/firebase/firebaseUtils')

// Función auxiliar para formatear una fecha en el formato deseado
function formatearFecha(fecha) {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
  
    return `${year}-${month}-${day}`;
  }
  
function formatearFechaFirestore(fechaTimestamp) {
    console.log("Raw date input:", fechaTimestamp);
  
    // Si el valor ya es un objeto `Timestamp` de Firestore
    if (fechaTimestamp && typeof fechaTimestamp.toDate === 'function') {
      console.log("1")
      const fecha = fechaTimestamp.toDate();
      return formatearFecha(fecha);
    }
  
    // Si el valor es un número (segundos o milisegundos)
    if (typeof fechaTimestamp === 'number') {
      console.log("2")
      const fecha = new Date(fechaTimestamp * 1000); // Convierte a milisegundos
      return formatearFecha(fecha);
    }
  
    // Si el valor ya es un objeto `Date`
    if (fechaTimestamp instanceof Date) {
      console.log("3")
      return formatearFecha(fechaTimestamp);
    }
  
    console.log("4")
    // Por defecto, usa la fecha actual
    return formatearFecha(new Date());
  }

function getFechaFirestore(fecha) {
    let fechaFacturaDate;

    if (fecha) {
      const [year, month, day] = fecha.split('-').map(Number);
      fechaFacturaDate = new Date(year, month - 1, day);
    } else {
      fechaFacturaDate = new Date();
      console.log(fechaFacturaDate)
    }

    return fechaFacturaDate ? admin.firestore.Timestamp.fromDate(fechaFacturaDate) : null;
  }

module.exports = {getFechaFirestore, formatearFechaFirestore}