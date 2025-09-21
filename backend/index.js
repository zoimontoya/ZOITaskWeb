import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';

const app = express();
app.use(cors());
app.use(express.json());

const SERVICE_ACCOUNT_FILE = './service-account.json';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '1EEZlootxR63QHicF2cQ5GDmzQJ31V22fE202LXkufc4';

// Autenticación con Google
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: SCOPES,
});

// Función auxiliar para obtener dimensiones de invernaderos
async function getInvernaderosDimensions(client) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Intentar obtener todos los datos de la hoja
    console.log('=== OBTENIENDO DIMENSIONES DE INVERNADEROS ===');
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Invernaderos',
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('❌ No hay datos en la hoja Invernaderos');
      return {};
    }
    
    console.log(`📊 Se encontraron ${rows.length} filas en total`);
    const headers = rows[0];
    console.log('📋 Headers de Invernaderos:', headers);
    
    // Buscar columna de nombre del invernadero
    const nameIdx = headers.findIndex(h => 
      h && (h.toLowerCase().includes('nombre') || h.toLowerCase().includes('invernadero'))
    );
    
    // Buscar columna de dimensiones (exactamente "dimensiones")
    let dimensionIdx = headers.findIndex(h => 
      h && h.toLowerCase().trim() === 'dimensiones'
    );
    
    // Si no encuentra "dimensiones", buscar "dimesiones" (error ortográfico común)
    if (dimensionIdx === -1) {
      dimensionIdx = headers.findIndex(h => 
        h && h.toLowerCase().trim() === 'dimesiones'
      );
    }
    
    // Si no encuentra ninguna exacta, buscar cualquier cosa que contenga "dimension" o "dimesion"
    const dimensionIdxAlt = dimensionIdx === -1 ? headers.findIndex(h => 
      h && (h.toLowerCase().includes('dimension') || h.toLowerCase().includes('dimesion'))
    ) : dimensionIdx;
    
    console.log(`🔍 Índices encontrados - nombre: ${nameIdx} (${headers[nameIdx]}), dimensiones: ${dimensionIdxAlt} (${headers[dimensionIdxAlt]})`);
    
    if (nameIdx === -1 || dimensionIdxAlt === -1) {
      console.log('❌ No se encontraron las columnas necesarias');
      console.log('📋 Headers disponibles:', headers);
      return {};
    }
    
    const dimensions = {};
    rows.slice(1).forEach((row, index) => {
      const nombreInvernadero = row[nameIdx];
      const valorDimension = row[dimensionIdxAlt];
      
      console.log(`Fila ${index + 2}: Nombre="${nombreInvernadero}", Valor bruto="${valorDimension}", Tipo: ${typeof valorDimension}`);
      
      if (nombreInvernadero && valorDimension !== undefined && valorDimension !== '') {
        // Intentar convertir el valor a número de diferentes maneras
        let dimensionValue = 0;
        
        if (typeof valorDimension === 'number') {
          dimensionValue = valorDimension;
        } else if (typeof valorDimension === 'string') {
          // Eliminar caracteres no numéricos y convertir
          const cleanValue = valorDimension.replace(/[^\d.-]/g, '');
          dimensionValue = parseFloat(cleanValue) || 0;
        }
        
        dimensions[nombreInvernadero] = dimensionValue;
        console.log(`  -> Resultado final: ${dimensionValue}`);
      } else {
        console.log(`  -> Saltado (falta nombre o valor)`);
      }
    });
    
    console.log('✅ Mapa de dimensiones completo:');
    Object.entries(dimensions).forEach(([nombre, dimension]) => {
      console.log(`   "${nombre}" -> ${dimension}`);
    });
    console.log('=== FIN OBTENIENDO DIMENSIONES ===');
    
    return dimensions;
  } catch (err) {
    console.error('Error obteniendo dimensiones:', err);
    return {};
  }
}

// Endpoint para obtener encargados
app.get('/encargados', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios',
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No hay filas en Usuarios');
      return res.json([]);
    }
    const headers = rows[0];
    const idxRol = headers.findIndex(h => h.toLowerCase() === 'rol');
    const idxId = headers.findIndex(h => h.toLowerCase() === 'id');
    const idxName = headers.findIndex(h => h.toLowerCase() === 'name');
    if (idxRol === -1 || idxId === -1 || idxName === -1) {
      console.log('Faltan columnas rol, id o name');
      return res.status(500).json({ error: 'Faltan columnas rol, id o name' });
    }
    const encargados = rows.slice(1)
      .filter(row => row[idxRol] && String(row[idxRol]).toLowerCase() === 'encargado')
      .map(row => ({
        id: row[idxId],
        name: row[idxName],
        rol: row[idxRol]
      }));
    console.log('Encargados encontrados:', encargados.length);
    res.json(encargados);
  } catch (err) {
    console.error('Error en /encargados:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener todas las tareas
app.get('/tasks', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Buscar la hoja de Tareas (mayúscula o minúscula)
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tareasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Tareas' || s.properties.title === 'tareas')
    );
    
    if (!tareasSheet) {
      console.log('No se encontró la hoja de Tareas');
      return res.json([]);
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: tareasSheet.properties.title,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No hay filas en tareas');
      return res.json([]);
    }
    
    const headers = rows[0];
    const tasks = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i] || '');
      
      // Asegurar que tenga todos los campos necesarios con valores por defecto
      obj.proceso = obj.proceso || 'No iniciado';
      obj.nombre_superior = obj.nombre_superior || '';
      obj.fecha_inicio = obj.fecha_inicio || '';
      obj.fecha_fin = obj.fecha_fin || '';
      obj.desarrollo_actual = obj.desarrollo_actual || '';
      obj.dimension_total = obj.dimension_total || '';
      
      return obj;
    });
    
    console.log('Tareas encontradas:', tasks.length);
    console.log('Primeras 2 tareas con proceso:', tasks.slice(0, 2).map(t => ({ id: t.id, encargado_id: t.encargado_id, proceso: t.proceso })));
    res.json(tasks);
  } catch (err) {
    console.error('Error en /tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de login con logs detallados
app.post('/login', async (req, res) => {
  const { id, password } = req.body;
  console.log('Login recibido:', req.body);
  if (!id || !password) {
    console.log('Faltan credenciales');
    return res.status(400).json({ success: false, error: 'Faltan credenciales' });
  }
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios',
    });
    const rows = response.data.values;
    console.log('Filas leídas de Usuarios:', rows ? rows.length : 0);
    if (!rows || rows.length === 0) {
      console.log('No hay usuarios en la hoja');
      return res.status(500).json({ success: false, error: 'No hay usuarios' });
    }
    const headers = rows[0];
    console.log('Cabeceras:', headers);
    const idxId = headers.findIndex(h => h.toLowerCase() === 'id');
    const idxPassword = headers.findIndex(h => h.toLowerCase() === 'password');
    const idxRol = headers.findIndex(h => h.toLowerCase() === 'rol');
    const idxName = headers.findIndex(h => h.toLowerCase() === 'name');
    console.log('Índices:', { idxId, idxPassword, idxRol, idxName });
    if (idxId === -1 || idxPassword === -1) {
      console.log('Faltan columnas id/password');
      return res.status(500).json({ success: false, error: 'Faltan columnas id/password' });
    }
    const userRow = rows.slice(1).find(row => {
      return String(row[idxId]) === String(id) && String(row[idxPassword]) === String(password);
    });
    console.log('Fila encontrada:', userRow);
    if (userRow) {
      const rol = idxRol !== -1 ? userRow[idxRol] : undefined;
      const name = idxName !== -1 ? userRow[idxName] : id;
      console.log('Login correcto:', { id, rol, name });
      return res.json({ success: true, id, rol, name });
    } else {
      console.log('ID o contraseña incorrectos');
      return res.json({ success: false });
    }
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para crear varias tareas a la vez
app.post('/tasks', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // UPDATE (edit task)
    if (req.body && req.body.action === 'update' && req.body.id) {
      const idToUpdate = String(req.body.id);
      const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const tareasSheet = spreadsheetMeta.data.sheets.find(s =>
        s.properties && (s.properties.title === 'Tareas' || s.properties.title === 'tareas')
      );
      if (!tareasSheet) {
        return res.status(500).json({ error: 'No se encontró la hoja "Tareas" en el spreadsheet.' });
      }
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: tareasSheet.properties.title,
      });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row, idx) => idx > 0 && String(row[0]) === idToUpdate);
      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
      }
      const updatedRow = [
        idToUpdate,
        req.body.invernadero,
        req.body.tipo_tarea,
        Number(req.body.estimacion_horas) || 0,
        req.body.fecha_limite,
        req.body.encargado_id,
        req.body.descripcion,
        req.body.nombre_superior || '',
        req.body.fecha_inicio || '',
        req.body.fecha_fin || '',
        Number(req.body.desarrollo_actual) || 0,
        Number(req.body.dimension_total) || 0,
        req.body.proceso || 'No iniciado'
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tareasSheet.properties.title}!A${rowIndex + 1}:M${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [updatedRow] }
      });
      console.log('Tarea actualizada:', idToUpdate);
      return res.json({ result: 'success', updated: idToUpdate });
    }

    // DELETE (delete task)
    if (req.body && req.body.action === 'delete' && req.body.id) {
      const idToDelete = String(req.body.id);
      const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const tareasSheet = spreadsheetMeta.data.sheets.find(s =>
        s.properties && (s.properties.title === 'Tareas' || s.properties.title === 'tareas')
      );
      if (!tareasSheet) {
        return res.status(500).json({ error: 'No se encontró la hoja "Tareas" en el spreadsheet.' });
      }
      const tareasSheetId = tareasSheet.properties.sheetId;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: tareasSheet.properties.title,
      });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row, idx) => idx > 0 && String(row[0]) === idToDelete);
      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
      }
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: tareasSheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }
          ]
        }
      });
      console.log('Tarea borrada:', idToDelete);
      return res.json({ result: 'success', deleted: idToDelete });
    }

    // CREATE (default: batch create)
    const tareas = req.body.tareas;
    if (!Array.isArray(tareas) || tareas.length === 0) {
      console.log('No hay tareas para crear. Body recibido:', req.body);
      return res.status(400).json({ error: 'No hay tareas para crear.', body: req.body });
    }
    
    // Obtener dimensiones de invernaderos
    const dimensiones = await getInvernaderosDimensions(client);
    console.log('Dimensiones obtenidas en CREATE:', dimensiones);
    console.log('Tipo de dimensiones:', typeof dimensiones);
    console.log('Claves disponibles:', Object.keys(dimensiones));
    
    // Buscar la hoja de Tareas
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tareasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Tareas' || s.properties.title === 'tareas')
    );
    
    if (!tareasSheet) {
      return res.status(500).json({ error: 'No se encontró la hoja "Tareas"' });
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: tareasSheet.properties.title,
    });
    const rows = response.data.values || [];
    let lastId = 0;
    if (rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const idValue = parseInt(rows[i][0]);
        if (!isNaN(idValue) && idValue > lastId) lastId = idValue;
      }
    }
    const newRows = [];
    for (let i = 0; i < tareas.length; i++) {
      const tarea = tareas[i];
      tarea.id = ++lastId;
      const dimensionTotal = dimensiones[tarea.invernadero] || 0;
      console.log(`Creando tarea para invernadero "${tarea.invernadero}"`);
      console.log(`Dimensión encontrada: ${dimensionTotal}`);
      console.log(`Dimensiones disponibles:`, Object.keys(dimensiones));
      
      newRows.push([
        tarea.id,
        tarea.invernadero,
        tarea.tipo_tarea,
        Number(tarea.estimacion_horas) || 0,
        tarea.fecha_limite,
        tarea.encargado_id,
        tarea.descripcion,
        tarea.nombre_superior || '',
        '', // fecha_inicio (vacía al crear)
        '', // fecha_fin (vacía al crear)
        0,  // desarrollo_actual (inicia en 0)
        dimensionTotal, // dimension_total (obtenida de Invernaderos)
        'No iniciado' // proceso (por defecto)
      ]);
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: tareasSheet.properties.title,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: newRows }
    });
    console.log('Tareas creadas:', newRows.map(r => r[0]));
    return res.json({ result: 'success', ids: newRows.map(r => r[0]) });
  } catch (err) {
    console.error('Error en /tasks (POST):', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para aceptar una tarea (encargado)
app.post('/tasks/:id/accept', async (req, res) => {
  try {
    const taskId = req.params.id;
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tareasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Tareas' || s.properties.title === 'tareas')
    );
    
    if (!tareasSheet) {
      return res.status(500).json({ error: 'No se encontró la hoja "Tareas"' });
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: tareasSheet.properties.title,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row, idx) => idx > 0 && String(row[0]) === String(taskId));
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const currentRow = rows[rowIndex];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Actualizar fecha_inicio (columna I) y proceso (columna M) 
    currentRow[8] = today; // fecha_inicio
    currentRow[12] = 'Iniciada'; // proceso
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A${rowIndex + 1}:M${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [currentRow] }
    });
    
    console.log('Tarea aceptada:', taskId);
    res.json({ result: 'success', accepted: taskId });
  } catch (err) {
    console.error('Error aceptando tarea:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para terminar una tarea (encargado)
app.post('/tasks/:id/complete', async (req, res) => {
  try {
    const taskId = req.params.id;
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tareasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Tareas' || s.properties.title === 'tareas')
    );
    
    if (!tareasSheet) {
      return res.status(500).json({ error: 'No se encontró la hoja "Tareas"' });
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: tareasSheet.properties.title,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row, idx) => idx > 0 && String(row[0]) === String(taskId));
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const currentRow = rows[rowIndex];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Actualizar fecha_fin (columna J) y proceso (columna M)
    currentRow[9] = today; // fecha_fin
    currentRow[12] = 'Completada'; // proceso
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A${rowIndex + 1}:M${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [currentRow] }
    });
    
    console.log('Tarea completada:', taskId);
    res.json({ result: 'success', completed: taskId });
  } catch (err) {
    console.error('Error completando tarea:', err);
    res.status(500).json({ error: err.message });
  }
});

// Arranque del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});





