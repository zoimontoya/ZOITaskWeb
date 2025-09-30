import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

// Middleware para logging de todas las peticiones
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url} from ${req.ip || req.connection.remoteAddress}`);
  next();
});

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '1EEZlootxR63QHicF2cQ5GDmzQJ31V22fE202LXkufc4';

// 🔒 Configuración segura de credenciales de Google
const getGoogleAuth = () => {
  // Opción 1: Variables de entorno (Docker/Producción)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      console.log('✅ Usando credenciales de Google desde variables de entorno');
      return new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: SCOPES,
      });
    } catch (error) {
      console.error('❌ Error al parsear credenciales de entorno:', error.message);
      throw new Error('Credenciales de entorno inválidas');
    }
  }
  
  // Opción 2: Archivo local (Desarrollo)
  const SERVICE_ACCOUNT_FILE = './service-account.json';
  if (fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.log('✅ Usando credenciales de Google desde archivo local');
    return new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: SCOPES,
    });
  }
  
  throw new Error('❌ No se encontraron credenciales de Google. Configure GOOGLE_SERVICE_ACCOUNT_JSON o coloque service-account.json');
};

// Autenticación con Google (segura)
const auth = getGoogleAuth();

// Función auxiliar para obtener dimensiones de invernaderos
async function getInvernaderosDimensions(client) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Invernaderos',
      valueRenderOption: 'UNFORMATTED_VALUE', // Mantener valores sin formato para precisión decimal
      dateTimeRenderOption: 'FORMATTED_STRING'
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('❌ No hay datos en la hoja Invernaderos');
      return {};
    }
    
    const headers = rows[0];
    
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
    
    if (nameIdx === -1 || dimensionIdxAlt === -1) {
      console.log('❌ No se encontraron las columnas necesarias');
      return {};
    }
    
    const dimensions = {};
    rows.slice(1).forEach((row, index) => {
      const nombreInvernadero = row[nameIdx];
      const valorDimension = row[dimensionIdxAlt];
      
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
        
        if (dimensionValue > 0) {
          dimensions[nombreInvernadero] = dimensionValue;
        }
      }
    });
    
    return dimensions;
  } catch (err) {
    console.error('Error obteniendo dimensiones:', err);
    return {};
  }
}

// Función auxiliar para registrar horas trabajadas en la hoja "Horas"
async function registrarHorasTrabajadas(client, trabajadoresAsignados, encargadoNombre, fechaActualizacion) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Buscar la hoja "Horas"
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const horasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Horas' || s.properties.title === 'horas')
    );
    
    if (!horasSheet) {
      console.log('⚠️ No se encontró la hoja "Horas"');
      return;
    }
    
    // Obtener datos de trabajadores para conseguir las empresas
    const trabajadoresResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Trabajadores',
      valueRenderOption: 'FORMATTED_VALUE'
    });
    
    const trabajadoresRows = trabajadoresResponse.data.values;
    const trabajadoresMap = {};
    
    if (trabajadoresRows && trabajadoresRows.length > 1) {
      const trabajadoresHeaders = trabajadoresRows[0];
      const codigoIdx = trabajadoresHeaders.findIndex(h => h && h.toLowerCase().includes('codigo'));
      const empresaIdx = trabajadoresHeaders.findIndex(h => h && h.toLowerCase().includes('empresa'));
      
      trabajadoresRows.slice(1).forEach(row => {
        if (row[codigoIdx]) {
          trabajadoresMap[row[codigoIdx]] = {
            empresa: row[empresaIdx] || ''
          };
        }
      });
    }
    
    // Preparar las filas a insertar (una por trabajador)
    const filasAInsertar = [];
    
    trabajadoresAsignados.forEach(trabajadorAsignado => {
      const trabajadorData = trabajadoresMap[trabajadorAsignado.trabajador.codigo] || {};
      
      filasAInsertar.push([
        fechaActualizacion,                    // Fecha
        encargadoNombre,                      // Grupo (nombre del encargado)
        trabajadorAsignado.trabajador.nombre, // Nombre del empleado
        trabajadorAsignado.horas,             // Tiempo (horas)
        '',                                   // Ranking (vacío)
        trabajadorData.empresa || trabajadorAsignado.trabajador.empresa || '' // Empresa
      ]);
    });
    
    if (filasAInsertar.length === 0) {
      console.log('No hay trabajadores asignados para registrar');
      return;
    }
    
    // Insertar las filas en la hoja "Horas"
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${horasSheet.properties.title}!A:F`, // Columnas: Fecha, Grupo, Nombre, Tiempo, Ranking, Empresa
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: filasAInsertar
      }
    });
    
    console.log(`✅ Registradas ${filasAInsertar.length} filas de horas trabajadas en la hoja "Horas"`);
    
  } catch (err) {
    console.error('❌ Error registrando horas trabajadas:', err);
  }
}

// Endpoint para obtener invernaderos filtrados por cabezal
app.get('/invernaderos/:cabezal', async (req, res) => {
  try {
    const { cabezal } = req.params;
    console.log('Obteniendo invernaderos para cabezal:', cabezal);
    
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Invernaderos',
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No hay filas en Invernaderos');
      return res.json({ cabezales: [] });
    }

    const headers = rows[0];
    console.log('Headers en Invernaderos:', headers);

    const nameIdx = headers.findIndex(h => 
      h && (h.toLowerCase().includes('nombre') || h.toLowerCase().includes('name'))
    );
    
    const cabezalIdx = headers.findIndex(h => 
      h && h.toLowerCase().includes('cabezal')
    );
    
    const dimensionIdx = headers.findIndex(h => 
      h && h.toLowerCase().includes('dimension')
    );

    if (nameIdx === -1) {
      console.log('No se encontró columna de nombre en Invernaderos');
      return res.status(500).json({ error: 'No se encontró columna de nombre' });
    }

    console.log(`Índices: nombre=${nameIdx}, cabezal=${cabezalIdx}, dimensiones=${dimensionIdx}`);
    
    // Filtrar invernaderos por cabezal específico
    const invernaderos = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cabezalValue = cabezalIdx !== -1 ? row[cabezalIdx] : 'Sin Cabezal';
      
      // Solo incluir si coincide con el cabezal solicitado
      if (String(cabezalValue).toUpperCase() === cabezal.toUpperCase()) {
        const nombreInvernadero = row[nameIdx];
        if (nombreInvernadero && nombreInvernadero.trim()) {
          const valorDimension = dimensionIdx !== -1 ? row[dimensionIdx] : null;
          
          // Procesar dimensión manejando formato europeo (coma decimal)
          let dimensionValue = 0;
          if (valorDimension !== undefined && valorDimension !== '') {
            if (typeof valorDimension === 'number') {
              dimensionValue = valorDimension;
            } else if (typeof valorDimension === 'string') {
              // Convertir formato europeo (28,084) a formato americano (28.084) para parseFloat
              const europeanFormatted = valorDimension.replace(',', '.');
              const cleanValue = europeanFormatted.replace(/[^\d.-]/g, '');
              dimensionValue = parseFloat(cleanValue) || 0;
            }
          }
          
          invernaderos.push({
            nombre: nombreInvernadero.trim(),
            dimensiones: dimensionValue.toString()
          });
        }
      }
    }

    // Crear estructura de cabezal único
    const result = {
      cabezales: [{
        nombre: cabezal,
        invernaderos: invernaderos.sort((a, b) => a.nombre.localeCompare(b.nombre))
      }]
    };

    console.log(`Invernaderos encontrados para ${cabezal}:`, invernaderos.length);
    console.log('Dimensiones procesadas:', invernaderos.map(inv => `${inv.nombre}: ${inv.dimensiones}`));
    res.json(result);
  } catch (err) {
    console.error('Error en /invernaderos filtrados:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para obtener invernaderos agrupados por cabezal (mantener para compatibilidad)
app.get('/invernaderos', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Invernaderos',
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ cabezales: [] });
    }
    
    const headers = rows[0];
    console.log('Headers de Invernaderos:', headers);
    
    // Buscar índices de columnas
    const nameIdx = headers.findIndex(h => 
      h && (h.toLowerCase().includes('nombre') || h.toLowerCase().includes('invernadero'))
    );
    const cabezalIdx = headers.findIndex(h => 
      h && h.toLowerCase().includes('cabezal')
    );
    let dimensionIdx = headers.findIndex(h => 
      h && h.toLowerCase().trim() === 'dimensiones'
    );
    if (dimensionIdx === -1) {
      dimensionIdx = headers.findIndex(h => 
        h && h.toLowerCase().trim() === 'dimesiones'
      );
    }
    if (dimensionIdx === -1) {
      dimensionIdx = headers.findIndex(h => 
        h && (h.toLowerCase().includes('dimension') || h.toLowerCase().includes('dimesion'))
      );
    }
    
    if (nameIdx === -1) {
      return res.status(500).json({ error: 'No se encontró la columna de nombre del invernadero' });
    }
    
    console.log(`Índices: nombre=${nameIdx}, cabezal=${cabezalIdx}, dimensiones=${dimensionIdx}`);
    
    // Procesar datos y agrupar por cabezal
    const cabezalesMap = new Map();
    
    rows.slice(1).forEach((row, index) => {
      const nombreInvernadero = row[nameIdx];
      const cabezal = cabezalIdx !== -1 ? row[cabezalIdx] : 'Sin Cabezal';
      const valorDimension = dimensionIdx !== -1 ? row[dimensionIdx] : null;
      
      if (nombreInvernadero) {
        // Procesar dimensión manejando formato europeo (coma decimal)
        let dimensionValue = 0;
        if (valorDimension !== undefined && valorDimension !== '') {
          if (typeof valorDimension === 'number') {
            dimensionValue = valorDimension;
          } else if (typeof valorDimension === 'string') {
            // Convertir formato europeo (28,084) a formato americano (28.084) para parseFloat
            const europeanFormatted = valorDimension.replace(',', '.');
            const cleanValue = europeanFormatted.replace(/[^\d.-]/g, '');
            dimensionValue = parseFloat(cleanValue) || 0;
          }
        }
        
        // Agrupar por cabezal
        if (!cabezalesMap.has(cabezal)) {
          cabezalesMap.set(cabezal, {
            nombre: cabezal,
            invernaderos: []
          });
        }
        
        cabezalesMap.get(cabezal).invernaderos.push({
          nombre: nombreInvernadero,
          dimensiones: dimensionValue.toString()
        });
      }
    });
    
    // Convertir Map a array y ordenar
    const cabezales = Array.from(cabezalesMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Ordenar invernaderos dentro de cada cabezal
    cabezales.forEach(cabezal => {
      cabezal.invernaderos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    });
    
    console.log(`Invernaderos agrupados: ${cabezales.length} cabezales`);
    res.json({ cabezales });
    
  } catch (err) {
    console.error('Error en /invernaderos:', err);
    res.status(500).json({ error: err.message });
  }
});

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

// Obtener encargados filtrados por grupo de trabajo y cabezal
app.get('/encargados/:grupo/:cabezal', async (req, res) => {
  try {
    const { grupo, cabezal } = req.params;
    console.log('Obteniendo encargados para grupo:', grupo, 'y cabezal:', cabezal);
    
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
    const idxGrupo = headers.findIndex(h => h.toLowerCase().includes('grupo'));
    const idxCabezal = headers.findIndex(h => h.toLowerCase().includes('cabezal'));
    
    if (idxRol === -1 || idxId === -1 || idxName === -1 || idxGrupo === -1 || idxCabezal === -1) {
      console.log('Faltan columnas necesarias en Usuarios');
      return res.status(500).json({ error: 'Faltan columnas necesarias' });
    }
    
    const encargados = rows.slice(1)
      .filter(row => 
        row[idxRol] && 
        String(row[idxRol]).toLowerCase() === 'encargado' &&
        row[idxGrupo] &&
        String(row[idxGrupo]).toUpperCase() === grupo.toUpperCase() &&
        row[idxCabezal] &&
        String(row[idxCabezal]).toUpperCase() === cabezal.toUpperCase()
      )
      .map(row => ({
        id: row[idxId],
        name: row[idxName],
        rol: row[idxRol],
        grupo_trabajo: row[idxGrupo],
        cabezal: row[idxCabezal]
      }));
    
    console.log(`Encargados encontrados para ${grupo}/${cabezal}:`, encargados.length);
    res.json(encargados);
  } catch (err) {
    console.error('Error en /encargados filtrados:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mantener endpoint anterior para compatibilidad (solo por grupo)
app.get('/encargados/:grupo', async (req, res) => {
  try {
    const { grupo } = req.params;
    console.log('Obteniendo encargados para grupo:', grupo);
    
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
    const idxGrupo = headers.findIndex(h => h.toLowerCase().includes('grupo'));
    
    if (idxRol === -1 || idxId === -1 || idxName === -1 || idxGrupo === -1) {
      console.log('Faltan columnas necesarias en Usuarios');
      return res.status(500).json({ error: 'Faltan columnas necesarias' });
    }
    
    const encargados = rows.slice(1)
      .filter(row => 
        row[idxRol] && 
        String(row[idxRol]).toLowerCase() === 'encargado' &&
        row[idxGrupo] &&
        String(row[idxGrupo]).toUpperCase() === grupo.toUpperCase()
      )
      .map(row => ({
        id: row[idxId],
        name: row[idxName],
        rol: row[idxRol],
        grupo_trabajo: row[idxGrupo]
      }));
    
    console.log(`Encargados encontrados para ${grupo}:`, encargados.length);
    res.json(encargados);
  } catch (err) {
    console.error('Error en /encargados filtrados:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener tipos de tarea filtrados por grupo de trabajo
app.get('/tipos-tarea/:grupo', async (req, res) => {
  try {
    const { grupo } = req.params;
    console.log('Obteniendo tipos de tarea para grupo:', grupo);
    
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TiposTareas',
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No hay tipos de tarea en la hoja');
      return res.json([]);
    }
    
    // Asumiendo estructura: grupo_trabajo | familia | tipo | subtipo | tarea_nombre | jornal_unidad
    const headers = rows[0];
    const idxGrupo = headers.findIndex(h => h.toLowerCase().includes('grupo'));
    const idxFamilia = headers.findIndex(h => h.toLowerCase().includes('familia'));
    const idxTipo = headers.findIndex(h => h.toLowerCase().includes('tipo'));
    const idxSubtipo = headers.findIndex(h => h.toLowerCase().includes('subtipo'));
    const idxNombre = headers.findIndex(h => h.toLowerCase().includes('tarea_nombre'));
    const idxJornal = headers.findIndex(h => h.toLowerCase().includes('jornal_unidad'));
    
    console.log('Índices encontrados:', { idxGrupo, idxFamilia, idxTipo, idxSubtipo, idxNombre, idxJornal });
    
    const tiposTarea = rows.slice(1)
      .filter(row => row[idxGrupo] && String(row[idxGrupo]).toUpperCase() === grupo.toUpperCase())
      .map(row => ({
        grupo_trabajo: row[idxGrupo] || '',
        familia: row[idxFamilia] || '',
        tipo: row[idxTipo] || '',
        subtipo: row[idxSubtipo] || '',
        tarea_nombre: row[idxNombre] || '',
        jornal_unidad: row[idxJornal] || ''
      }));
    
    console.log(`Tipos de tarea encontrados para ${grupo}:`, tiposTarea.length);
    res.json(tiposTarea);
  } catch (err) {
    console.error('Error en /tipos-tarea:', err);
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
      valueRenderOption: 'FORMATTED_VALUE', // Volver a formato original
      dateTimeRenderOption: 'FORMATTED_STRING'
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
      
      // MAPEO EXPLICITO DE COLUMNAS BASADO EN POSICIÓN
      // Basándose en el orden definido en la creación de tareas:
      // A=id, B=invernadero, C=tipo_tarea, D=estimacion_horas, E=hora_jornal, etc.
      const mappedObj = {
        id: row[0] || '',                              // A
        invernadero: row[1] || '',                     // B  
        tipo_tarea: row[2] || '',                      // C
        estimacion_horas: row[3] || '',                // D
        hora_jornal: (row[4] !== undefined && row[4] !== '') ? row[4] : '0',  // E - CAMPO CLAVE (por defecto 0 = 6h)
        horas_kilos: Number(row[5]) || 0,              // F - Convertir a número (0=Hectáreas, 1=Kilos)
        jornales_reales: row[6] || '0',                // G
        fecha_limite: row[7] || '',                    // H
        encargado_id: row[8] || '',                    // I
        descripcion: row[9] || '',                     // J
        nombre_superior: row[10] || '',                // K
        fecha_inicio: row[11] || '',                   // L
        fecha_fin: row[12] || '',                      // M
        desarrollo_actual: row[13] || '',              // N
        dimension_total: row[14] || '',                // O
        proceso: row[15] || 'No iniciado',             // P
        fecha_actualizacion: row[16] || ''             // Q - Nueva columna para fecha de actualización
      };
      
      // Combinar mapeo dinámico con mapeo explícito (prioridad al explícito)
      const finalObj = { ...obj, ...mappedObj };
      
      // DEBUG: Mostrar información básica para la primera tarea
      if (row[0] === rows[1]?.[0]) { // Solo para la primera fila de datos
        console.log('=== BACKEND: Leyendo tareas ===');
        console.log(`Primera tarea - ID: ${finalObj.id}, estimacion_horas: ${finalObj.estimacion_horas}, hora_jornal: ${finalObj.hora_jornal}`);
        console.log('===============================');
      }
      
      // DEBUG: Buscar diferentes nombres posibles para la columna de estado
      const estadoPosible = finalObj.proceso || finalObj.progreso || finalObj.estado || finalObj.Proceso || finalObj.Progreso || finalObj.Estado || '';
      
      // Asegurar que tenga todos los campos necesarios con valores por defecto
      finalObj.proceso = estadoPosible || 'No iniciado';
      finalObj.nombre_superior = finalObj.nombre_superior || '';
      finalObj.fecha_inicio = finalObj.fecha_inicio || '';
      finalObj.fecha_fin = finalObj.fecha_fin || '';
      
      // Procesar desarrollo_actual para convertir formato europeo (coma) a americano (punto)
      let desarrolloValue = finalObj.desarrollo_actual || '';
      if (desarrolloValue && typeof desarrolloValue === 'string') {
        desarrolloValue = desarrolloValue.replace(',', '.');
        finalObj.desarrollo_actual = parseFloat(desarrolloValue) || 0;
      } else {
        finalObj.desarrollo_actual = parseFloat(desarrolloValue) || 0;
      }
      
      // Procesar dimension_total para convertir formato europeo (coma) a americano (punto)
      let dimensionValue = finalObj.dimension_total || '';
      if (dimensionValue && typeof dimensionValue === 'string') {
        // Convertir coma decimal europea a punto decimal americano
        dimensionValue = dimensionValue.replace(',', '.');
        finalObj.dimension_total = parseFloat(dimensionValue) || 0;
      } else {
        finalObj.dimension_total = parseFloat(dimensionValue) || 0;
      }
      
      // SIMPLIFICADO: Solo devolver los valores tal como están almacenados
      // La conversión se hace en el frontend
      finalObj.estimacion_horas = Number(finalObj.estimacion_horas) || 0;
      finalObj.hora_jornal = Number(finalObj.hora_jornal) || 0;
      
      return finalObj;
      
      // jornales_reales se mantiene en horas tal como está almacenado (encargados ingresan horas directamente)
      
      return obj;
    });
    
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
    const idxGrupo = headers.findIndex(h => h.toLowerCase().includes('grupo'));
    const idxCabezal = headers.findIndex(h => h.toLowerCase().includes('cabezal'));
    console.log('Índices:', { idxId, idxPassword, idxRol, idxName, idxGrupo, idxCabezal });
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
      const grupo_trabajo = idxGrupo !== -1 ? userRow[idxGrupo] : undefined;
      const cabezal = idxCabezal !== -1 ? userRow[idxCabezal] : undefined;
      console.log('Login correcto:', { id, rol, name, grupo_trabajo, cabezal });
      return res.json({ success: true, id, rol, name, grupo_trabajo, cabezal });
    } else {
      console.log('ID o contraseña incorrectos');
      return res.json({ success: false });
    }
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para obtener información de un usuario por ID
app.get('/user/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Obteniendo información del usuario:', id);
  
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID de usuario requerido' });
  }

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No hay usuarios en la hoja' });
    }

    const headers = rows[0];
    const idxId = headers.findIndex(h => h.toLowerCase() === 'id');
    const idxName = headers.findIndex(h => h.toLowerCase() === 'name');
    const idxRol = headers.findIndex(h => h.toLowerCase() === 'rol');

    if (idxId === -1) {
      return res.status(500).json({ success: false, error: 'Falta columna id en la hoja Usuarios' });
    }

    const userRow = rows.slice(1).find(row => String(row[idxId]) === String(id));

    if (userRow) {
      const userData = {
        id: userRow[idxId],
        name: idxName !== -1 ? userRow[idxName] : id,
        rol: idxRol !== -1 ? userRow[idxRol] : undefined
      };
      console.log('Usuario encontrado:', userData);
      return res.json({ success: true, user: userData });
    } else {
      console.log('Usuario no encontrado:', id);
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
  } catch (err) {
    console.error('Error al obtener usuario:', err);
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
      // SIMPLIFICADO: Solo almacenar los valores que vienen del frontend (ya calculados)
      const horaJornal = Number(req.body.hora_jornal) || 0;
      const estimacionHoras = Number(req.body.estimacion_horas) || 0; // Ya viene calculado del frontend
      const horasKilos = Number(req.body.horas_kilos) || 0; // 0=Hectáreas, 1=Kilos
      
      console.log(`✏️ === BACKEND: EDITANDO TAREA ID: ${idToUpdate} ===`);
      console.log(`📦 Body recibido:`, req.body);
      console.log(`🏷️ hora_jornal: "${req.body.hora_jornal}" → ${horaJornal} (${horaJornal === 1 ? '8h' : '6h'}/jornal)`);
      console.log(`📊 horas_kilos: "${req.body.horas_kilos}" → ${horasKilos} (${horasKilos === 1 ? 'KILOS' : 'HECTÁREAS'})`);
      console.log(`⏰ estimacion_horas: "${req.body.estimacion_horas}" → ${estimacionHoras} horas totales`);
      console.log(`💾 Se actualizará columna E: ${horaJornal}, columna F: ${horasKilos}, columna D: ${estimacionHoras}`);
      
      const updatedRow = [
        idToUpdate,                                    // A: id
        req.body.invernadero,                          // B: invernadero
        req.body.tipo_tarea,                           // C: tipo_tarea
        estimacionHoras,                               // D: estimacion_horas (ya calculado en frontend)
        horaJornal,                                    // E: hora_jornal (0=6hrs, 1=8hrs)
        horasKilos,                                    // F: horas_kilos (0=Hectáreas, 1=Kilos)
        Number(req.body.jornales_reales) || 0,        // G: jornales_reales (encargados ingresan horas directamente)
        req.body.fecha_limite,                         // H: fecha_limite
        req.body.encargado_id,                         // I: encargado_id
        req.body.descripcion,                          // J: descripcion
        req.body.nombre_superior || '',                // K: nombre_superior
        req.body.fecha_inicio || '',                   // L: fecha_inicio
        req.body.fecha_fin || '',                      // M: fecha_fin
        Number(req.body.desarrollo_actual) || 0,      // N: desarrollo_actual
        req.body.dimension_total || '0',               // O: dimension_total
        req.body.proceso || 'No iniciado',             // P: proceso
        req.body.fecha_actualizacion || ''             // Q: fecha_actualizacion (se mantiene el valor existente al editar)
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tareasSheet.properties.title}!A${rowIndex + 1}:Q${rowIndex + 1}`, // Actualizado a columna Q (17 columnas)
        valueInputOption: 'RAW',
        resource: { values: [updatedRow] }
      });
      console.log('Tarea actualizada:', idToUpdate);
      return res.json({ result: 'success', updated: idToUpdate });
    }

    // UPDATE PROGRESS (update progress percentage and hectares)
    if (req.body && req.body.action === 'update-progress' && req.body.id) {
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
      const headers = rows[0] || [];
      const rowIndex = rows.findIndex((row, idx) => idx > 0 && String(row[0]) === idToUpdate);
      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
      }

      // Buscar índices de las columnas con búsqueda más flexible
      const jornalesRealesIndex = headers.findIndex(h => 
        h && (h.toLowerCase().includes('jornales_reales') || 
              h.toLowerCase().includes('jornales reales') ||
              h.toLowerCase() === 'jornales_reales')
      );
      const desarrolloActualIndex = headers.findIndex(h => 
        h && (h.toLowerCase().includes('desarrollo_actual') || 
              h.toLowerCase().includes('desarrollo actual') ||
              h.toLowerCase() === 'desarrollo_actual')
      );
      const progresoIndex = headers.findIndex(h => 
        h && (h.toLowerCase() === 'progreso' || 
              h.toLowerCase().includes('progreso'))
      );
      
      console.log('=== DIAGNÓSTICO ACTUALIZACIÓN PROGRESO ===');
      console.log('Headers completos:', headers);
      console.log('Número total de columnas:', headers.length);
      console.log('Índices encontrados:', { jornalesRealesIndex, desarrolloActualIndex, progresoIndex });
      console.log('Fila actual antes de actualizar:', rows[rowIndex]);
      console.log('Datos recibidos:', { 
        id: req.body.id, 
        progreso: req.body.progreso, 
        desarrollo_actual: req.body.desarrollo_actual, 
        jornales_reales: req.body.jornales_reales 
      });

      // Actualizar jornales_reales (columna G por defecto si no se encuentra)
      const jornalesCol = jornalesRealesIndex >= 0 ? jornalesRealesIndex : 6; // Columna G = índice 6
      const jornalesColLetter = String.fromCharCode(65 + jornalesCol);
      
      if (req.body.jornales_reales !== undefined) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${tareasSheet.properties.title}!${jornalesColLetter}${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[Number(req.body.jornales_reales) || 0]] }
        });
      }

      // Actualizar desarrollo_actual (hectáreas) - columna N por defecto si no se encuentra  
      const desarrolloCol = desarrolloActualIndex >= 0 ? desarrolloActualIndex : 13; // Columna N = índice 13
      const desarrolloColLetter = String.fromCharCode(65 + desarrolloCol);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tareasSheet.properties.title}!${desarrolloColLetter}${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [[Number(req.body.desarrollo_actual) || 0]] }
      });

      // Actualizar progreso (porcentaje) si existe la columna
      if (progresoIndex >= 0) {
        const progresoColLetter = String.fromCharCode(65 + progresoIndex);
        console.log(`Actualizando progreso en columna ${progresoColLetter} con valor: ${req.body.progreso}`);
        
        // Para tareas de kilos, mantener el valor como string, para hectáreas convertir a número
        let progresoValue;
        if (req.body.progreso === 'Iniciada' || req.body.progreso === 'No iniciado' || req.body.progreso === 'Terminada') {
          progresoValue = req.body.progreso; // Mantener como string
        } else {
          progresoValue = Number(req.body.progreso) || 0; // Convertir a número para porcentajes
        }
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${tareasSheet.properties.title}!${progresoColLetter}${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[progresoValue]] }
        });
      } else {
        console.log('⚠️ ADVERTENCIA: No se encontró la columna "progreso" en las cabeceras');
        console.log('Columnas disponibles:', headers.map((h, i) => `${String.fromCharCode(65 + i)}: ${h}`));
      }

      // Actualizar fecha_actualizacion (columna Q - posición 16) - SOLO para tracking, sin restricciones
      const fechaActualizacionIndex = headers.findIndex(h => 
        h && (h.toLowerCase().includes('fecha_actualizacion') || 
              h.toLowerCase().includes('fecha actualizacion') ||
              h.toLowerCase() === 'fecha_actualizacion')
      );
      
      const fechaActualizacionCol = fechaActualizacionIndex >= 0 ? fechaActualizacionIndex : 16; // Columna Q = índice 16
      const fechaActualizacionColLetter = String.fromCharCode(65 + fechaActualizacionCol);
      const fechaActual = new Date().toLocaleDateString('es-ES'); // Formato DD/MM/YYYY
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tareasSheet.properties.title}!${fechaActualizacionColLetter}${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [[fechaActual]] }
      });

      // Registrar horas trabajadas si hay trabajadores asignados
      if (req.body.trabajadores_asignados && req.body.trabajadores_asignados.length > 0) {
        const encargadoNombre = req.body.encargado_nombre || 'Encargado'; // Obtener el nombre del encargado que actualiza
        await registrarHorasTrabajadas(client, req.body.trabajadores_asignados, encargadoNombre, fechaActual);
      }

      console.log('Progreso actualizado para tarea:', idToUpdate, 'porcentaje:', req.body.progreso, 'hectáreas:', req.body.desarrollo_actual, 'jornales_reales:', req.body.jornales_reales, 'fecha_actualizacion:', fechaActual);
      return res.json({ 
        result: 'success', 
        updated: idToUpdate, 
        progress: req.body.progreso, 
        hectares: req.body.desarrollo_actual,
        jornales_reales: req.body.jornales_reales,
        fecha_actualizacion: fechaActual
      });
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
      
      // Usar el dimension_total que viene del frontend (seleccionado por el usuario)
      const dimensionTotalSeleccionada = Number(tarea.dimension_total) || 0;
      
      // SIMPLIFICADO: Solo almacenar los valores que vienen del frontend (ya calculados)
      const horaJornal = Number(tarea.hora_jornal) || 0;
      const estimacionHoras = Number(tarea.estimacion_horas) || 0; // Ya viene calculado del frontend
      const horasKilos = Number(tarea.horas_kilos) || 0; // 0=Hectáreas, 1=Kilos
      
      console.log(`🔧 === BACKEND: CREANDO TAREA PARA "${tarea.invernadero}" ===`);
      console.log(`📦 Objeto tarea recibido:`, tarea);
      console.log(`🏷️ hora_jornal: "${tarea.hora_jornal}" → ${horaJornal} (${horaJornal === 1 ? '8h' : '6h'}/jornal)`);
      console.log(`📊 horas_kilos: "${tarea.horas_kilos}" → ${horasKilos} (${horasKilos === 1 ? 'KILOS' : 'HECTÁREAS'})`);
      console.log(`⏰ estimacion_horas: "${tarea.estimacion_horas}" → ${estimacionHoras} horas totales`);
      console.log(`📏 Dimensión: ${dimensionTotalSeleccionada} ${horasKilos === 1 ? 'kilos' : 'hectáreas'}`);
      console.log(`💾 Se guardará en columna E: ${horaJornal}, columna F: ${horasKilos}, columna D: ${estimacionHoras}`);
      
      newRows.push([
        tarea.id,                                    // A: id
        tarea.invernadero,                           // B: invernadero
        tarea.tipo_tarea,                            // C: tipo_tarea
        estimacionHoras,                             // D: estimacion_horas (ya calculado en frontend)
        horaJornal,                                  // E: hora_jornal (0=6hrs, 1=8hrs)
        horasKilos,                                  // F: horas_kilos (0=Hectáreas, 1=Kilos)
        0,                                           // G: jornales_reales (inicia en 0)
        tarea.fecha_limite,                          // H: fecha_limite
        tarea.encargado_id,                          // I: encargado_id
        tarea.descripcion,                           // J: descripcion
        tarea.nombre_superior || '',                 // K: nombre_superior
        '',                                          // L: fecha_inicio (vacía al crear)
        '',                                          // M: fecha_fin (vacía al crear)
        0,                                           // N: desarrollo_actual (inicia en 0)
        dimensionTotalSeleccionada,                  // O: dimension_total (seleccionada por el usuario)
        'No iniciado',                               // P: proceso (por defecto)
        ''                                           // Q: fecha_actualizacion (vacía al crear, se llenará al actualizar)
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
    
    // Asegurar que el array tenga suficientes elementos para la nueva estructura de 17 columnas
    while (currentRow.length < 17) {
      currentRow.push('');
    }
    
    // Actualizar fecha_inicio (columna L = índice 11) y proceso (columna P = índice 15)
    // NO actualizamos fecha_actualizacion aquí porque "aceptar" no es lo mismo que "actualizar progreso"
    currentRow[11] = today; // fecha_inicio (columna L)
    currentRow[15] = 'Iniciada'; // proceso (columna P)
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A${rowIndex + 1}:Q${rowIndex + 1}`, // Actualizado a columna Q (17 columnas)
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
    
    // Asegurar que el array tenga suficientes elementos para la nueva estructura de 17 columnas
    while (currentRow.length < 17) {
      currentRow.push('');
    }
    
    const fechaActual = new Date().toLocaleDateString('es-ES'); // Formato DD/MM/YYYY

    // Actualizar fecha_fin (columna M = índice 12), proceso (columna P = índice 15) y fecha_actualizacion (columna Q = índice 16)
    currentRow[12] = today; // fecha_fin (columna M) - YYYY-MM-DD
    currentRow[15] = 'Terminada'; // proceso (columna P)
    currentRow[16] = fechaActual; // fecha_actualizacion (columna Q) - DD/MM/YYYY - para tracking
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A${rowIndex + 1}:Q${rowIndex + 1}`, // Actualizado a columna Q (17 columnas)
      valueInputOption: 'RAW',
      resource: { values: [currentRow] }
    });
    
    // Registrar horas trabajadas si hay trabajadores asignados al completar
    if (req.body.trabajadores_asignados && req.body.trabajadores_asignados.length > 0) {
      const encargadoNombre = req.body.encargado_nombre || 'Encargado'; // Obtener el nombre del encargado que completa la tarea
      await registrarHorasTrabajadas(client, req.body.trabajadores_asignados, encargadoNombre, fechaActual);
    }
    
    console.log('Tarea completada:', taskId, 'fecha_fin:', today, 'fecha_actualizacion:', fechaActual);
    res.json({ result: 'success', completed: taskId, fecha_actualizacion: fechaActual });
  } catch (err) {
    console.error('Error completando tarea:', err);
    res.status(500).json({ error: err.message });
  }
});

// Arranque del servidor
// Endpoint para obtener trabajadores de la hoja "Trabajadores"
app.get('/trabajadores', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Buscar la hoja de Trabajadores
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const trabajadoresSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Trabajadores' || s.properties.title === 'trabajadores')
    );
    
    if (!trabajadoresSheet) {
      console.log('No se encontró la hoja de Trabajadores');
      return res.json([]);
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: trabajadoresSheet.properties.title,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });
    
    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      console.log('No hay trabajadores o solo hay cabeceras');
      return res.json([]);
    }
    
    // Convertir filas a objetos (saltando la primera fila que son cabeceras)
    const trabajadores = rows.slice(1).map(row => ({
      codigo: row[0] || '',           // A: codigo_trabajador
      nombre: row[1] || '',           // B: nombre_trabajador
      empresa: row[2] || ''           // C: empresa
    })).filter(t => t.codigo && t.nombre && t.empresa); // Solo trabajadores con código, nombre Y empresa
    
    console.log(`Trabajadores cargados: ${trabajadores.length}`);
    res.json(trabajadores);
  } catch (err) {
    console.error('Error en /trabajadores:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔍 Health check endpoint para Docker
app.get('/health', (req, res) => {
  console.log('🩺 Health check request received from:', req.ip || req.connection.remoteAddress);
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'ZOI Task Web Backend',
    port: PORT || 3000
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on 0.0.0.0:${PORT}`);
  console.log(`🔍 Health check disponible en:`);
  console.log(`   - Localmente: http://localhost:${PORT}/health`);
  console.log(`   - Desde la red: http://192.168.0.85:${PORT}/health`);
});





