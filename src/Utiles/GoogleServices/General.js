require("dotenv").config(); // Cargar variables de entorno desde el archivo .env
const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS), // Parsear las credenciales desde la variable de entorno
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

const rowInit = 1;

async function checkEditPermissions(fileId, userEmail) {
  try {
    // Obtiene los permisos del archivo
    const permissions = await drive.permissions.list({
      fileId: fileId,
      fields: "permissions(emailAddress, role)",
    });

    // Busca un permiso que coincida con el correo electrónico del usuario y que tenga un rol de 'writer' o 'owner'
    const hasPermission = permissions.data.permissions.some(
      (permission) =>
        permission.emailAddress === userEmail &&
        (permission.role === "writer" || permission.role === "owner")
    );

    return hasPermission;
  } catch (err) {
    console.error("Error checking permissions:", err);
    return false;
  }
}

// Función para añadir una fila, creando la hoja si es necesario
async function addRow(sheetId, values, range) {
  // Extraer el nombre de la hoja desde el rango (asumiendo formato 'SheetName!A1:B1')
  const sheetName = range.split("!")[0];

  try {
    // Verificar si la hoja ya existe
    const sheetExists = await checkIfSheetExists(sheetId, sheetName);

    // Si no existe, crear una nueva hoja
    if (!sheetExists) {
      await createSheet(sheetId, sheetName);
    }

    // Obtener la última fila ocupada para asegurar que no haya desfase
    const lastRow = await getLastRow(sheetId, sheetName);

    // Ajustar el rango para la siguiente fila disponible
    const newRange = `${sheetName}!A${lastRow + 1}:Z${lastRow + 1}`;

    // Añadir la fila al rango dado
    const request = {
      spreadsheetId: sheetId,
      range: newRange,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [values],
      },
    };

    await sheets.spreadsheets.values.append(request);
    console.log("Row added.");
  } catch (err) {
    console.error("Failed to add row:", err);
  }
}

async function getLastRow(sheetId, sheetName) {
  const request = {
    spreadsheetId: sheetId,
    range: `${sheetName}!A:A`, // Obtiene la columna A
  };
  const response = await sheets.spreadsheets.values.get(request);
  const rows = response.data.values || [];

  // Si no hay filas, devolver 1 para empezar desde la segunda fila
  return rows.length === 0 ? 1 : rows.length;
}

// Función para verificar si una hoja existe
async function checkIfSheetExists(sheetId, sheetName) {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: "sheets.properties",
    });

    // Revisar si alguna hoja tiene el nombre dado
    return response.data.sheets.some(
      (sheet) => sheet.properties.title === sheetName
    );
  } catch (err) {
    console.error("Failed to check if sheet exists:", err);
    return false;
  }
}

// Función para crear una hoja

async function createSheet(sheetId, sheetName) {
  const request = {
    spreadsheetId: sheetId,
    resource: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  };

  try {
    await sheets.spreadsheets.batchUpdate(request);
    console.log(`Sheet "${sheetName}" created.`);
  } catch (err) {
    console.error("Failed to create sheet:", err);
  }
}

async function updateRow(sheetId, values, range, posIdColumn, idValue) {
  console.log(sheetId, values, range, posIdColumn, idValue);
  const readRequest = {
    spreadsheetId: sheetId,
    range: range,
  };
  const response = await sheets.spreadsheets.values.get(readRequest);
  const rowIdx = response.data.values.findIndex(
    (row) => row[posIdColumn] == idValue
  );
  const writeRange = `${range.split("!")[0]}!A${rowIdx + rowInit}`;

  const writeRequest = {
    spreadsheetId: sheetId,
    range: writeRange,
    valueInputOption: "USER_ENTERED",
    resource: { values: [values] },
  };
  await sheets.spreadsheets.values.update(writeRequest);
  console.log("Row updated.");
}

async function updateSheetWithBatchDelete(
  sheetId,
  range,
  values,
  columnStatus
) {
  try {
    // Sanitizar los datos
    const cleanedRows = values.map((row) =>
      row.map(
        (item) => (Array.isArray(item) ? item.join(", ") : item) // Convertir cualquier array a string
      )
    );
    // Leer los valores actuales de la hoja completa para obtener la cantidad de filas existentes
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    const existingValues = readResponse.data.values || [];
    const existingRowCount = existingValues.length;

    // Número de filas proporcionadas en la nueva actualización
    const newRowCount = cleanedRows.length;

    // Si hay filas existentes que no están en los nuevos valores, actualizamos la columna F a "BATCH_DELETED"
    if (newRowCount < existingRowCount) {
      for (let i = newRowCount; i < existingRowCount; i++) {
        existingValues[i][columnStatus] = "BATCH_DELETED";
      }
    }

    // Combinar los valores nuevos con los existentes modificados
    const updatedValues = [
      ...cleanedRows,
      ...existingValues.slice(newRowCount),
    ];

    // Preparar la solicitud de actualización
    const updateRequest = {
      spreadsheetId: sheetId,
      range: range, // Asumiendo que queremos actualizar de A a F
      valueInputOption: "USER_ENTERED",
      resource: {
        values: updatedValues,
      },
    };

    // Llamar a la API de Google Sheets para actualizar el rango con los nuevos valores
    await sheets.spreadsheets.values.update(updateRequest);
    console.log('Sheet updated with new values and "BATCH_DELETED".');
  } catch (err) {
    console.error("Failed to update sheet:", err);
  }
}

/**
 * Clona un archivo de Google Sheets.
 * @param {string} fileId - El ID del archivo a clonar.
 * @param {string} newTitle - El título del nuevo archivo clonado.
 * @returns {Promise<object|null>} - Retorna los detalles del archivo clonado o null si falla.
 */
async function cloneGoogleSheet(fileId, newTitle, folderId) {
  try {
    const request = {
      fileId: fileId,
      resource: {
        name: newTitle,
        parents: [folderId],
      },
    };

    const response = await drive.files.copy(request);
    console.log("File cloned successfully");
    return response.data;
  } catch (err) {
    console.error("Failed to clone file:", err);
    return null;
  }
}

module.exports = {
  updateSheetWithBatchDelete,
  checkEditPermissions,
  updateRow,
  createSheet,
  checkIfSheetExists,
  addRow,
  cloneGoogleSheet,
};
