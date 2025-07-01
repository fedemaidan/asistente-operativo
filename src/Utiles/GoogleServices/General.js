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

async function addFormattedHeaders(spreadsheetId, sheetName, sheetId, headers) {
  try {
    const headerRequest = {
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
      valueInputOption: "RAW",
      resource: {
        values: [headers],
      },
    };

    await sheets.spreadsheets.values.update(headerRequest);

    const formatRequest = {
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: "CENTER",
                  verticalAlignment: "MIDDLE",
                  textFormat: {
                    bold: true,
                  },
                },
              },
              fields:
                "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)",
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headers.length,
              },
            },
          },
        ],
      },
    };

    await sheets.spreadsheets.batchUpdate(formatRequest);
    console.log(
      `Headers formateados para "${sheetName}" (fila 1 fija, sin color de fondo).`
    );
  } catch (err) {
    console.error("Error al formatear los headers:", err);
  }
}

async function createSheet(spreadsheetId, sheetName) {
  try {
    // 1. Create the sheet
    const createRequest = {
      spreadsheetId: spreadsheetId,
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

    const createResponse = await sheets.spreadsheets.batchUpdate(createRequest);
    console.log(`Sheet "${sheetName}" created.`);

    return createResponse.data.replies[0].addSheet.properties.sheetId;
  } catch (err) {
    console.error("Failed to create sheet:", err);
    return null;
  }
}

async function addRow(sheetId, values, range, headers = null) {
  const sheetName = range.split("!")[0];

  try {
    const sheetExists = await checkIfSheetExists(sheetId, sheetName);

    if (!sheetExists) {
      let sheetHeaders = headers;

      if (!sheetHeaders) {
        console.error(
          `Sheet "${sheetName}" does not exist and no headers provided.`
        );
        return;
      }

      const newSheetId = await createSheet(sheetId, sheetName);
      if (newSheetId) {
        await addFormattedHeaders(sheetId, sheetName, newSheetId, sheetHeaders);
      }
    }

    const lastRow = await getLastRow(sheetId, sheetName);

    const newRange = `${sheetName}!A${lastRow + 1}:Z${lastRow + 1}`;

    // Add the row to the given range
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

async function getRowsValues(sheetId, sheetName, range) {
  try {
    const sheetExists = await checkIfSheetExists(sheetId, sheetName);
    if (!sheetExists) {
      console.error(`Sheet "${sheetName}" does not exist`);
      return [];
    }

    const request = {
      spreadsheetId: sheetId,
      range: `${sheetName}!${range}`,
    };

    console.log(`Requesting range: ${sheetName}!${range}`);
    const response = await sheets.spreadsheets.values.get(request);

    const rows = response.data.values || [];
    return rows;
  } catch (error) {
    console.error("Error retrieving rows:", error);
    return [];
  }
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

async function updateRow(sheetId, values, range, posIdColumn, idValue) {
  const sheetName = range.split("!")[0];
  const sheetExists = await checkIfSheetExists(sheetId, sheetName);

  if (!sheetExists) {
    return { success: false, message: "Sheet does not exist" };
  }

  const readRequest = {
    spreadsheetId: sheetId,
    range: range,
  };
  const response = await sheets.spreadsheets.values.get(readRequest);
  const rowIdx = response.data.values.findIndex(
    (row) => row[posIdColumn] == idValue
  );

  if (rowIdx === -1 || rowIdx === undefined) {
    return { success: false, message: "Row not found" };
  }

  const writeRange = `${sheetName}!A${rowIdx + rowInit}`;

  const writeRequest = {
    spreadsheetId: sheetId,
    range: writeRange,
    valueInputOption: "USER_ENTERED",
    resource: { values: [values] },
  };
  await sheets.spreadsheets.values.update(writeRequest);
  return { success: true, message: "Row updated successfully" };
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
  getRowsValues,
  createSheet,
  checkIfSheetExists,
  addRow,
  cloneGoogleSheet,
  addFormattedHeaders,
  getLastRow,
};
