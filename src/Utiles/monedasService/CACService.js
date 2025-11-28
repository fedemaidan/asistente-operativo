require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { db } = require('../../services/fireBaseUtils');
const path = require('path');
const csv = require('csv-parser');
const fs = require('fs');

const CAC_URL = 'https://www.camarco.org.ar/indice-cac/';


const CACService = {
  async scrapearIndiceCACDesdeWeb() {
    try {
      const { data: html } = await axios.get(CAC_URL);
      const $ = cheerio.load(html);

      const indices = {};

      $('table tbody tr').each((i, row) => {
        const celdas = $(row).find('td');
        const fecha = $(celdas[0]).text().trim();
        const valorStr = $(celdas[1]).text().replace('.', '').replace(',', '.').trim();

        if (fecha && valorStr) {
          const valor = parseFloat(valorStr);

          const [mesNombre, anio] = fecha.split(' ');
          const meses = {
            enero: '01', febrero: '02', marzo: '03', abril: '04',
            mayo: '05', junio: '06', julio: '07', agosto: '08',
            septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
          };

          const mes = meses[mesNombre.toLowerCase()];
          if (mes && anio) {
            const fechaFormateada = `${anio}-${mes}`;
            indices[fechaFormateada] = {
              general: valor
            };
          }
        }
      });

      return indices;
    } catch (err) {
      console.error('❌ Error al scrapear la web de CAC:', err);
      return {};
    }
  },

  async scrapearConSubindices() {
    try {
      const { data: html } = await axios.get('https://www.miobra.com.ar/indicador-cac');
      const $ = cheerio.load(html);
  
      const indices = {};
  
      // Buscamos filas de índice mensual en la tabla
      $('table tbody tr').each((i, row) => {
        const cols = $(row).find('td');
        const fechaRaw = $(cols[0]).text().trim();  // Ej: Abril 2025
        const general = parseFloat($(cols[1]).text().replace('.', '').replace(',', '.'));
        const materiales = parseFloat($(cols[2]).text().replace('.', '').replace(',', '.'));
        const manoObra = parseFloat($(cols[3]).text().replace('.', '').replace(',', '.'));
  
        const [mesNombre, anio] = fechaRaw.split(' ');
        const meses = { enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05',
                        junio:'06', julio:'07', agosto:'08', septiembre:'09',
                        octubre:'10', noviembre:'11', diciembre:'12' };
        const mes = meses[mesNombre.toLowerCase()];
        if (!mes || !anio) return;
  
        const fecha = `${anio}-${mes}`;
        indices[fecha] = { general, materiales, mano_obra: manoObra };
      });
  
      return indices;
    } catch (err) {
      console.error('❌ Error al scrapear Mi Obra subíndices CAC:', err);
      return {};
    }
  },

  async guardarIndiceCAC(fechaAAAAMM, valor) {
    try {
      await db.collection('cac_indices').doc(fechaAAAAMM).set({ general: valor }, { merge: true });
      console.log(`Índice CAC guardado para ${fechaAAAAMM}: ${valor}`);
      return true;
    } catch (err) {
      console.error('Error al guardar el índice CAC:', err);
      return false;
    }
  },

  async dameIndiceEnFecha(fechaAAAAMM) {
    try {
      const docRef = db.collection('cac_indices').doc(fechaAAAAMM);
      const doc = await docRef.get();
  
      if (!doc.exists) {
        console.warn(`⚠️ No se encontró índice CAC en Firebase para ${fechaAAAAMM}.`);
        return null;
      }
  
      const datos = doc.data();
  
      if (datos.general) {
        return { fuente: 'general', valor: datos.general };
      }
  
      if (datos.mano_obra || datos.materiales) {
        console.warn(`⚠️ No hay índice general en ${fechaAAAAMM}, pero hay subíndices.`);
        return {
          fuente: 'subindices',
          mano_obra: datos.mano_obra || null,
          materiales: datos.materiales || null
        };
      }
  
      console.warn(`⚠️ Documento vacío para ${fechaAAAAMM}`);
      return null;
    } catch (err) {
      console.error('Error al obtener el índice CAC:', err);
      return null;
    }
  },
  
  async obtenerUltimoIndiceCAC() {
    try {
      const snapshot = await db.collection('cac_indices').orderBy('__name__', 'desc').limit(1).get();
      console.log(`Último índice CAC encontrado: ${snapshot.size} documentos.`);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
          fecha: doc.id,
          fuente: data.general ? 'general' : 'subindices',
          valor: data.general || null,
          mano_obra: data.mano_obra || null,
          materiales: data.materiales || null
        };
      }
      return null;
    } catch (err) {
      console.error('Error al obtener el último índice CAC:', err);
      return null;
    }
  },

  async calcularVariacion(fechaInicio, fechaFin) {
    try {
      const inicio = await this.dameIndiceEnFecha(fechaInicio);
      const fin = await this.dameIndiceEnFecha(fechaFin);

      if (inicio?.valor && fin?.valor) {
        const variacion = ((fin.valor - inicio.valor) / inicio.valor) * 100;
        return { fechaInicio, valorInicio: inicio.valor, fechaFin, valorFin: fin.valor, variacion };
      }

      console.warn(`⚠️ No se pudo calcular la variación entre ${fechaInicio} y ${fechaFin}`);
      return null;
    } catch (err) {
      console.error('Error al calcular la variación del índice CAC:', err);
      return null;
    }
  },
  
  async dameIndiceParaFechaDeUsoReal(fechaStr = null) {
    const fechaBase = fechaStr ? new Date(fechaStr) : new Date();

    // Restamos 2 meses a la fecha
    const mesAtrasado = new Date(fechaBase);
    mesAtrasado.setMonth(mesAtrasado.getMonth() - 2);

    const yyyy = mesAtrasado.getFullYear();
    const mm = String(mesAtrasado.getMonth() + 1).padStart(2, '0'); // getMonth() es base 0

    const fechaAAAAMM = `${yyyy}-${mm}`;

    const indice = await this.dameIndiceEnFecha(fechaAAAAMM);

    if (!indice) {

      
    }

    return {
      ...indice,
      fecha_utilizada: fechaAAAAMM
    };
  },
  
  async  importarTodosDesde2020() {
    try {
        const filePath = path.join(__dirname, 'util_data/cac_data.csv');
        const ref = db.collection('cac_indices');
        const batch = db.batch();

        const rows = [];

        await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => rows.push(row))
            .on('end', resolve)
            .on('error', reject);
        });

        for (const row of rows) {
        const { fecha, indice_general, materiales, mano_obra } = row;
        const [anio] = fecha.split('-');
        if (parseInt(anio) >= 2022) {
            const docRef = ref.doc(fecha);
            batch.set(docRef, {
            general: parseFloat(indice_general),
            materiales: parseFloat(materiales),
            mano_obra: parseFloat(mano_obra),
            }, { merge: true });
        }
        }

        await batch.commit();
        console.log('✅ Índices CAC desde cac_data.csv importados correctamente.');
    } catch (err) {
        console.error('❌ Error al importar desde cac_data.csv:', err);
    }
}}

module.exports = CACService;