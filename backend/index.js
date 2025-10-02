import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import fs from 'fs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

// Clave secreta para JWT (en producción debería estar en variable de entorno)
const JWT_SECRET = 'zoi-task-web-secret-key-2025';

// Middleware para verificar JWT (REQUERIDO - para rutas protegidas)
const verifyJWT = (req, res, next) => {
  console.log('🔐 verifyJWT middleware - Verificando autenticación para:', req.method, req.url);
  
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  console.log('📋 Auth header presente:', !!authHeader);
  console.log('🎫 Token extraído:', !!token);
  
  if (!token) {
    console.log('❌ verifyJWT - No hay token');
    return res.status(401).json({ 
      success: false, 
      error: 'Token de autenticación requerido',
      requiresAuth: true 
    });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('🚫 Token JWT inválido:', err.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido o expirado',
        requiresAuth: true 
      });
    }
    
    req.user = decoded; // Agregar info del usuario a la request
    console.log('✅ Usuario autenticado via JWT:', decoded.userId);
    next();
  });
};

// Middleware opcional para rutas que pueden beneficiarse de info de usuario
const optionalJWT = (req, res, next) => {
  console.log('🔓 optionalJWT middleware - Verificando token opcional para:', req.method, req.url);
  
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('📋 Auth header presente:', !!authHeader);
  console.log('🎫 Token extraído:', !!token);
  
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.user = decoded; // Agregar info del usuario si el token es válido
        console.log('✅ optionalJWT - Token válido, usuario:', decoded.userId);
      } else {
        console.log('⚠️ optionalJWT - Token inválido, continuando sin usuario');
      }
    });
  } else {
    console.log('ℹ️ optionalJWT - Sin token, continuando sin usuario');
  }
  next(); // Continuar siempre, con o sin token
};

// Sistema de protección contra peticiones duplicadas
const activeRequests = new Map();

// Middleware para prevenir peticiones duplicadas
const preventDuplicateRequests = (req, res, next) => {
  // Solo aplicar a operaciones críticas (POST/PUT/DELETE)
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }
  
  // Crear clave única basada en método, URL y datos críticos
  const key = `${req.method}:${req.url}:${JSON.stringify(req.body)}`;
  
  if (activeRequests.has(key)) {
    console.log('🚫 Petición duplicada detectada y bloqueada:', key);
    return res.status(429).json({ error: 'Petición duplicada detectada. Espere unos segundos antes de volver a intentar.' });
  }
  
  // Marcar petición como activa
  activeRequests.set(key, Date.now());
  
  // Limpiar después de 30 segundos (tiempo máximo esperado para completar)
  setTimeout(() => {
    activeRequests.delete(key);
  }, 30000);
  
  // Limpiar al finalizar la respuesta
  res.on('finish', () => {
    activeRequests.delete(key);
  });
  
  next();
};

app.use(preventDuplicateRequests);

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
async function getInvernaderosDimensions(authClient) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
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
async function registrarHorasTrabajadas(authClient, trabajadoresAsignados, encargadoNombre, fechaActualizacion, tareaId, esTareaUrgente = false) {
  try {
    console.log('🔍 === REGISTRANDO HORAS TRABAJADAS ===');
    console.log('TareaId recibido:', tareaId);
    console.log('Trabajadores asignados:', trabajadoresAsignados?.length || 0);
    console.log('Encargado:', encargadoNombre);
    console.log('Fecha:', fechaActualizacion);
    console.log('Es tarea urgente (SIN cálculos):', esTareaUrgente);
    
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
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
      
      const rankingValue = tareaId ? String(tareaId) : '';
      
      // Para tareas urgentes: usar horas directas, para tareas normales: hacer cálculos si es necesario  
      let horasARegistrar = trabajadorAsignado.horas;
      
      if (esTareaUrgente) {
        console.log(`🚨 TAREA URGENTE - Horas directas: ${horasARegistrar} (SIN cálculos)`);
      } else {
        console.log(`📊 TAREA NORMAL - Horas a registrar: ${horasARegistrar}`);
      }
      
      const filaAInsertar = [
        fechaActualizacion,                    // Fecha
        encargadoNombre,                      // Grupo (nombre del encargado)
        trabajadorAsignado.trabajador.nombre, // Nombre del empleado
        horasARegistrar,                      // Tiempo (horas - directas si es urgente)
        rankingValue,                         // Ranking (ID de la tarea)
        trabajadorData.empresa || trabajadorAsignado.trabajador.empresa || '' // Empresa
      ];
      
      console.log('Fila a insertar:', filaAInsertar);
      filasAInsertar.push(filaAInsertar);
    });
    
    if (filasAInsertar.length === 0) {
      console.log('No hay trabajadores asignados para registrar');
      return;
    }
    
    // Insertar las filas en la hoja "Horas"
    console.log('📝 Enviando a Google Sheets:');
    console.log('- Hoja:', horasSheet.properties.title);
    console.log('- Rango:', `${horasSheet.properties.title}!A:F`);
    console.log('- Filas a insertar:', JSON.stringify(filasAInsertar, null, 2));
    
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
    
    if (!cabezal) {
      return res.status(400).json({ success: false, error: 'Cabezal requerido' });
    }
    
    console.log('Obteniendo invernaderos para cabezal:', cabezal);
    
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
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
    console.log('📋 Obteniendo todos los invernaderos');
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
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
app.get('/encargados', optionalJWT, async (req, res) => {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
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
app.get('/encargados/:grupo/:cabezal', optionalJWT, async (req, res) => {
  try {
    const { grupo, cabezal } = req.params;
    
    if (!grupo || !cabezal) {
      return res.status(400).json({ success: false, error: 'Grupo y cabezal requeridos' });
    }
    
    console.log('Obteniendo encargados para grupo:', grupo, 'y cabezal:', cabezal);
    
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
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
app.get('/encargados/:grupo', optionalJWT, async (req, res) => {
  try {
    const { grupo } = req.params;
    
    if (!grupo) {
      return res.status(400).json({ success: false, error: 'Grupo requerido' });
    }
    
    console.log('Obteniendo encargados para grupo:', grupo);
    
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
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
app.get('/tipos-tarea/:grupo', optionalJWT, async (req, res) => {
  try {
    const { grupo } = req.params;
    
    if (!grupo) {
      return res.status(400).json({ success: false, error: 'Grupo requerido' });
    }
    
    console.log('Obteniendo tipos de tarea para grupo:', grupo);
    
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
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
app.get('/tasks', optionalJWT, async (req, res) => {
  try {
    console.log('📋 GET /tasks - Usuario autenticado:', req.user ? req.user.userId : 'No autenticado');
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
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
        proceso: row[15] || 'No iniciado',             // P - ÚNICO campo de estado
        fecha_actualizacion: row[16] || ''             // Q
      };
      
      // Combinar mapeo dinámico con mapeo explícito (prioridad al explícito)
      const finalObj = { ...obj, ...mappedObj };
      
      // DEBUG: Mostrar todas las tareas para entender el problema
      console.log(`� BACKEND GET: Tarea ${finalObj.id} - encargado: "${finalObj.encargado_id}", superior: "${finalObj.nombre_superior}", proceso: "${finalObj.proceso}", progreso: "${finalObj.progreso}"`);
      
      // DEBUG: Buscar tareas urgentes
      if (finalObj.proceso === 'Por validar') {
        console.log(`🚨 BACKEND: Tarea urgente encontrada - ID: ${finalObj.id}, proceso: "${finalObj.proceso}", tipo: "${finalObj.tipo_tarea}"`);
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
      
      // jornales_reales se mantiene en horas tal como está almacenado (encargados ingresan horas directamente)
      
      return finalObj;
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
  console.log('🔐 POST /login - Petición recibida para usuario:', id);
  console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
  
  if (!id || !password) {
    console.log('❌ Faltan credenciales en la petición');
    return res.status(400).json({ success: false, error: 'Faltan credenciales' });
  }
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
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
      
      // Crear el objeto usuario
      const user = { id, rol, name, grupo_trabajo, cabezal };
      
      // Generar token JWT con duración de 24 horas
      const token = jwt.sign(
        {
          userId: id,
          name: name,
          rol: rol,
          grupo_trabajo: grupo_trabajo,
          cabezal: cabezal,
          nombre_completo: name
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      console.log('Login correcto:', user);
      console.log('Token JWT generado para usuario:', id);
      
      return res.json({ 
        success: true, 
        token: token,
        user: user,
        // Mantener compatibilidad con frontend actual
        id, rol, name, grupo_trabajo, cabezal 
      });
    } else {
      console.log('ID o contraseña incorrectos');
      return res.json({ success: false });
    }
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para verificar token JWT
app.post('/verify-token', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.json({ success: false, error: 'Token no proporcionado' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.json({ success: false, error: 'Token inválido o expirado' });
    }
    
    // Token válido - devolver información del usuario
    return res.json({ 
      success: true, 
      user: {
        id: decoded.userId,
        name: decoded.name,
        rol: decoded.rol,
        grupo_trabajo: decoded.grupo_trabajo,
        cabezal: decoded.cabezal,
        nombre_completo: decoded.nombre_completo
      }
    });
  });
});

// Endpoint para obtener información de un usuario por ID
app.get('/user/:id', optionalJWT, async (req, res) => {
  const { id } = req.params;
  console.log('Obteniendo información del usuario:', id);
  
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID de usuario requerido' });
  }

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
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
app.post('/tasks', verifyJWT, async (req, res) => {
  try {
    console.log('✅ POST /tasks - Usuario autenticado:', req.user?.userId);
    console.log('📦 Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

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
      const horasKilos = Number(req.body.horas_kilos) || 0; // 0=Hectáreas, 1=Kilos
      
      // Para tareas urgentes: detectar usando múltiples criterios
      // CREATE: usa es_tarea_urgente flag
      // UPDATE: detecta por características (hora_jornal=0 Y jornales_reales > 0)
      const horasOriginales = Number(rows[rowIndex][3]) || 0; // Columna D original
      const jornalesOriginales = Number(rows[rowIndex][6]) || 0; // Columna G original
      
      const esTareaUrgente = req.body.es_tarea_urgente === true || 
                            (horaJornal === 0 && jornalesOriginales > 0 && jornalesOriginales === horasOriginales);
      let estimacionHoras;
      
      if (esTareaUrgente) {
        // Mantener las horas originales (no las calculadas del frontend)
        estimacionHoras = Number(rows[rowIndex][3]) || 0; // Columna D original
        console.log(`🚨 TAREA URGENTE - Preservando horas originales: ${estimacionHoras}`);
      } else {
        // Tareas normales: usar valores calculados del frontend
        estimacionHoras = Number(req.body.estimacion_horas) || 0;
        console.log(`📊 TAREA NORMAL - Usando horas calculadas: ${estimacionHoras}`);
      }
      
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
        esTareaUrgente ? Number(rows[rowIndex][6]) || 0 : Number(req.body.jornales_reales) || 0,  // G: preservar jornales_reales originales para urgentes
        req.body.fecha_limite,                         // H: fecha_limite
        req.body.encargado_id,                         // I: encargado_id
        req.body.descripcion,                          // J: descripcion
        req.body.nombre_superior || '',                // K: nombre_superior
        req.body.fecha_inicio || '',                   // L: fecha_inicio
        req.body.fecha_fin || '',                      // M: fecha_fin
        Number(req.body.desarrollo_actual) || 0,      // N: desarrollo_actual
        req.body.dimension_total || '0',               // O: dimension_total
        req.body.proceso || 'No iniciado',             // P: proceso (ÚNICO campo de estado)
        req.body.fecha_actualizacion || ''             // Q: fecha_actualizacion (se mantiene el valor existente al editar)
      ];
      
      console.log('🔄 Actualizando tarea con proceso:', req.body.proceso);
      console.log('📊 Fila completa a actualizar:', updatedRow);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tareasSheet.properties.title}!A${rowIndex + 1}:Q${rowIndex + 1}`, // Volvemos a columna Q (17 columnas)
        valueInputOption: 'RAW',
        resource: { values: [updatedRow] }
      });
      
      console.log('✅ Validación completada - tarea actualizada:', idToUpdate);
        console.log('� === TAREA URGENTE DETECTADA - REGISTRANDO HORAS ===');
        console.log('�📝 Registrando horas para tarea urgente validada (SIN cálculos de división)');
        console.log('🚨 Es tarea urgente - NO se harán cálculos de 6h/8h');

      console.log('✅ Validación completada - tarea actualizada:', idToUpdate);
      return res.json({ result: 'success', updated: idToUpdate });
    }

    // UPDATE PROGRESS (update progress percentage and hectares)
    if (req.body && req.body.action === 'update-progress' && req.body.id) {
      console.log('📊 === INICIANDO UPDATE-PROGRESS ===');
      console.log('Body completo recibido:', JSON.stringify(req.body, null, 2));
      
      const idToUpdate = String(req.body.id);
      console.log('ID de tarea a actualizar:', idToUpdate);
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
        await registrarHorasTrabajadas(auth, req.body.trabajadores_asignados, encargadoNombre, fechaActual, idToUpdate, false);
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
      
      // 1. Eliminar tarea de la hoja "Tareas"
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

      // 2. Buscar y eliminar filas relacionadas en la hoja "Horas"
      const horasSheet = spreadsheetMeta.data.sheets.find(s =>
        s.properties && (s.properties.title === 'Horas' || s.properties.title === 'horas')
      );
      
      let batchRequests = [
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
      ];

      if (horasSheet) {
        console.log('🔍 Buscando registros de horas para eliminar (tarea ID:', idToDelete, ')');
        const horasResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${horasSheet.properties.title}!A:H`
        });
        
        const horasRows = horasResponse.data.values || [];
        if (horasRows.length > 1) {
          const horasHeaders = horasRows[0];
          const rankingIndex = horasHeaders.findIndex(h => h && h.toLowerCase().includes('ranking'));
          
          if (rankingIndex !== -1) {
            // Encontrar todas las filas que coinciden con el ID de la tarea (en orden inverso para eliminar correctamente)
            const filasAEliminar = [];
            for (let i = horasRows.length - 1; i >= 1; i--) {
              const row = horasRows[i];
              if (row[rankingIndex] && String(row[rankingIndex]) === idToDelete) {
                filasAEliminar.push(i);
                console.log(`✅ Encontrada fila de horas a eliminar: ${i + 1} (${row[2] || 'Sin nombre'} - ${row[rankingIndex]})`);
              }
            }
            
            // Agregar requests de eliminación para cada fila (en orden inverso)
            filasAEliminar.forEach(rowIdx => {
              batchRequests.push({
                deleteDimension: {
                  range: {
                    sheetId: horasSheet.properties.sheetId,
                    dimension: 'ROWS',
                    startIndex: rowIdx,
                    endIndex: rowIdx + 1
                  }
                }
              });
            });
            
            console.log(`📊 Total filas de horas a eliminar: ${filasAEliminar.length}`);
          } else {
            console.log('⚠️ No se encontró la columna Ranking en la hoja Horas');
          }
        }
      } else {
        console.log('⚠️ No se encontró la hoja Horas');
      }

      // Ejecutar todas las eliminaciones en una sola operación batch
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: batchRequests
        }
      });
      
      console.log('✅ Tarea y registros de horas eliminados:', idToDelete);
      return res.json({ result: 'success', deleted: idToDelete });
    }

    // CREATE (default: batch create)
    const tareas = req.body.tareas;
    if (!Array.isArray(tareas) || tareas.length === 0) {
      console.log('No hay tareas para crear. Body recibido:', req.body);
      return res.status(400).json({ error: 'No hay tareas para crear.', body: req.body });
    }
    
    // Obtener dimensiones de invernaderos
    const dimensiones = await getInvernaderosDimensions(auth);
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
      console.log(`� proceso: "${tarea.proceso}" → "${tarea.proceso || 'No iniciado'}"`);
      console.log(`🚨 progreso: "${tarea.progreso}" → "${tarea.progreso || ''}"`);
      console.log(`�💾 Se guardará en columna E: ${horaJornal}, columna F: ${horasKilos}, columna D: ${estimacionHoras}`);
      
      // Detectar si es tarea urgente: usar flag específico enviado por el frontend
      const esTareaUrgente = tarea.es_tarea_urgente === true;
      const jornalesReales = esTareaUrgente ? estimacionHoras : 0; // Para urgentes: usar horas directas
      
      if (esTareaUrgente) {
        console.log(`🚨 TAREA URGENTE DETECTADA - nombre_superior: "${tarea.nombre_superior}", hora_jornal: 0`);
        console.log(`📊 Jornales reales = estimacion_horas: ${estimacionHoras} (SIN cálculos)`);
      } else {
        console.log(`📊 TAREA NORMAL - jornales_reales inicia en 0`);
      }
      
      newRows.push([
        tarea.id,                                    // A: id
        tarea.invernadero,                           // B: invernadero
        tarea.tipo_tarea,                            // C: tipo_tarea
        estimacionHoras,                             // D: estimacion_horas (ya calculado en frontend)
        horaJornal,                                  // E: hora_jornal (0=SIN cálculos para urgentes, 1=8hrs)
        horasKilos,                                  // F: horas_kilos (0=Hectáreas, 1=Kilos)
        jornalesReales,                              // G: jornales_reales (0 para normales, horas directas para urgentes)
        tarea.fecha_limite,                          // H: fecha_limite
        tarea.encargado_id,                          // I: encargado_id
        tarea.descripcion,                           // J: descripcion
        tarea.nombre_superior || '',                 // K: nombre_superior (CLAVE para detección)
        '',                                          // L: fecha_inicio (vacía al crear)
        '',                                          // M: fecha_fin (vacía al crear)
        0,                                           // N: desarrollo_actual (inicia en 0)
        dimensionTotalSeleccionada,                  // O: dimension_total (seleccionada por el usuario)
        tarea.proceso || 'No iniciado',              // P: proceso (respeta valor del frontend)
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
    
    // Registrar trabajadores para tareas urgentes DESPUÉS de crear la tarea
    for (let i = 0; i < tareas.length; i++) {
      const tarea = tareas[i];
      const horaJornal = Number(tarea.hora_jornal) || 0;
      const esTareaUrgente = tarea.nombre_superior && horaJornal === 0;
      
      if (esTareaUrgente && tarea.trabajadores_asignados && tarea.trabajadores_asignados.length > 0) {
        const tareaId = newRows[i][0]; // ID de la tarea recién creada
        const encargadoNombre = tarea.encargado_nombre || tarea.nombre_superior || 'Encargado';
        const fechaActual = new Date().toLocaleDateString('es-ES');
        
        console.log(`🔥 === REGISTRANDO TRABAJADORES PARA TAREA URGENTE ${tareaId} ===`);
        console.log('👥 Trabajadores recibidos:', JSON.stringify(tarea.trabajadores_asignados, null, 2));
        console.log('👤 Encargado:', encargadoNombre);
        console.log('📅 Fecha:', fechaActual);
        
        await registrarHorasTrabajadas(
          auth, 
          tarea.trabajadores_asignados, 
          encargadoNombre, 
          fechaActual, 
          tareaId, 
          true // es tarea urgente
        );
        
        console.log(`✅ Trabajadores registrados para tarea urgente ${tareaId}`);
      }
    }
    
    return res.json({ result: 'success', ids: newRows.map(r => r[0]) });
  } catch (err) {
    console.error('Error en /tasks (POST):', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para aceptar una tarea (encargado)
app.post('/tasks/:id/accept', verifyJWT, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'ID de tarea requerido' });
    }
    
    console.log('✅ POST /tasks/:id/accept - Usuario:', req.user?.userId, 'Tarea:', taskId);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
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

// Endpoint para completar tarea directamente (actualizar progreso al 100% y completar en una sola operación)
app.post('/tasks/:id/complete-direct', verifyJWT, async (req, res) => {
  console.log('🎯 ENDPOINT /tasks/:id/complete-direct ALCANZADO');
  console.log('📋 Task ID recibido:', req.params.id);
  console.log('📦 Body recibido:', JSON.stringify(req.body, null, 2));
  
  try {
    const taskId = req.params.id;
    
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'ID de tarea requerido' });
    }
    
    console.log('✅ POST /tasks/:id/complete-direct - Usuario:', req.user?.userId, 'Tarea:', taskId);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('=== COMPLETAR TAREA DIRECTAMENTE ===');
    console.log('Task ID:', taskId);
    console.log('Datos recibidos:', req.body);
    
    // Buscar la hoja de tareas
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
    const rowIndex = rows.findIndex((row, idx) => idx > 0 && String(row[0]) === String(taskId));
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const currentRow = rows[rowIndex];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fechaActual = new Date().toLocaleDateString('es-ES'); // Formato DD/MM/YYYY
    
    // Asegurar que el array tenga suficientes elementos
    while (currentRow.length < 17) {
      currentRow.push('');
    }
    
    // PASO 1: Actualizar progreso al 100% si se proporcionan datos
    if (req.body.progreso !== undefined || req.body.desarrollo_actual !== undefined || req.body.jornales_reales !== undefined) {
      // Buscar índices de columnas
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
      
      // Actualizar jornales_reales si se proporciona
      if (req.body.jornales_reales !== undefined) {
        const jornalesCol = jornalesRealesIndex >= 0 ? jornalesRealesIndex : 6;
        currentRow[jornalesCol] = Number(req.body.jornales_reales) || 0;
      }
      
      // Actualizar desarrollo_actual si se proporciona
      if (req.body.desarrollo_actual !== undefined) {
        const desarrolloCol = desarrolloActualIndex >= 0 ? desarrolloActualIndex : 13;
        currentRow[desarrolloCol] = Number(req.body.desarrollo_actual) || 0;
      }
      
      // Actualizar progreso (siempre al 100% al completar)
      if (progresoIndex >= 0) {
        currentRow[progresoIndex] = req.body.progreso || 100;
      }
    }
    
    // PASO 2: Completar la tarea
    currentRow[12] = today; // fecha_fin (columna M)
    currentRow[15] = 'Terminada'; // proceso (columna P)
    currentRow[16] = fechaActual; // fecha_actualizacion (columna Q)
    
    // Actualizar toda la fila de una vez
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A${rowIndex + 1}:Q${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [currentRow] }
    });
    
    // PASO 3: Registrar horas trabajadas UNA SOLA VEZ
    if (req.body.trabajadores_asignados && req.body.trabajadores_asignados.length > 0) {
      const encargadoNombre = req.body.encargado_nombre || 'Encargado';
      await registrarHorasTrabajadas(auth, req.body.trabajadores_asignados, encargadoNombre, fechaActual, taskId, false);
    }
    
    console.log('Tarea completada directamente:', taskId, 'fecha_fin:', today, 'fecha_actualizacion:', fechaActual);
    res.json({ result: 'success', completed: taskId, fecha_actualizacion: fechaActual });
    
  } catch (err) {
    console.error('Error completando tarea directamente:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para terminar una tarea (encargado)
app.post('/tasks/:id/complete', verifyJWT, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'ID de tarea requerido' });
    }
    
    console.log('✅ POST /tasks/:id/complete - Usuario:', req.user?.userId, 'Tarea:', taskId);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
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
      await registrarHorasTrabajadas(auth, req.body.trabajadores_asignados, encargadoNombre, fechaActual, taskId, false);
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
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
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

// � Endpoint para obtener trabajadores de una tarea específica desde la hoja "Horas"
app.get('/trabajadores-tarea/:taskId', optionalJWT, async (req, res) => {
  const { taskId } = req.params;
  console.log('📋 GET /trabajadores-tarea/:taskId - Obteniendo trabajadores de tarea:', taskId);
  
  if (!taskId) {
    return res.status(400).json({ success: false, error: 'ID de tarea requerido' });
  }
  
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Buscar la hoja "Horas" dinámicamente
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const horasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Horas' || s.properties.title === 'horas')
    );
    
    if (!horasSheet) {
      return res.status(404).json({ error: 'No se encontró la hoja de Horas' });
    }
    
    // Obtener datos de la hoja de horas
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${horasSheet.properties.title}!A:H`
    });

    const rows = result.data.values;
    if (!rows || rows.length <= 1) {
      return res.json([]);
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    console.log('🔍 Headers disponibles:', headers);
    
    // Buscar índices de las columnas necesarias con búsqueda más flexible
    const rankingIndex = headers.findIndex(h => h && h.toLowerCase().includes('ranking'));
    const trabajadorIndex = headers.findIndex(h => h && (
      h.toLowerCase().includes('trabajador') || 
      h.toLowerCase().includes('nombre') || 
      h.toLowerCase().includes('empleado')
    ));
    const horasIndex = headers.findIndex(h => h && (
      h.toLowerCase().includes('horas') || 
      h.toLowerCase().includes('tiempo') || 
      h.toLowerCase().includes('hora')
    ));
    const fechaIndex = headers.findIndex(h => h && h.toLowerCase().includes('fecha'));
    
    console.log('📊 Índices encontrados:', { rankingIndex, trabajadorIndex, horasIndex, fechaIndex });
    
    if (rankingIndex === -1) {
      console.log('❌ No se encontró la columna Ranking en la hoja Horas');
      return res.json([]);
    }
    
    if (trabajadorIndex === -1 || horasIndex === -1) {
      console.log('❌ No se encontraron las columnas de trabajador o horas en la hoja Horas');
      return res.json([]);
    }

    // Filtrar registros que coincidan con el taskId en la columna Ranking
    const taskId = req.params.taskId;
    const trabajadoresData = [];
    
    dataRows.forEach(row => {
      if (row[rankingIndex] && row[rankingIndex].toString() === taskId.toString()) {
        trabajadoresData.push({
          trabajador: row[trabajadorIndex] || '',
          horas: parseFloat(row[horasIndex]) || 0,
          fecha: row[fechaIndex] || ''
        });
      }
    });
    
    // Agrupar por trabajador y sumar horas
    const trabajadoresAgrupados = {};
    trabajadoresData.forEach(registro => {
      if (registro.trabajador) {
        if (!trabajadoresAgrupados[registro.trabajador]) {
          trabajadoresAgrupados[registro.trabajador] = {
            nombre: registro.trabajador,
            horasTotal: 0,
            registros: []
          };
        }
        trabajadoresAgrupados[registro.trabajador].horasTotal += registro.horas;
        trabajadoresAgrupados[registro.trabajador].registros.push({
          horas: registro.horas,
          fecha: registro.fecha
        });
      }
    });
    
    // Convertir a array y ordenar por horas totales
    const resultado = Object.values(trabajadoresAgrupados)
      .sort((a, b) => b.horasTotal - a.horasTotal);
    
    console.log(`✅ Encontrados ${resultado.length} trabajadores para tarea ${taskId}`);
    res.json(resultado);
    
  } catch (error) {
    console.error('❌ Error obteniendo trabajadores de tarea:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// �🔍 Health check endpoint para Docker
app.get('/health', (req, res) => {
  console.log('🩺 Health check request received from:', req.ip || req.connection.remoteAddress);
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'ZOI Task Web Backend',
    port: PORT || 3000
  });
});

// 🏪 GET géneros de confección para usuarios de ALMACÉN
app.get('/generos-confecc', optionalJWT, async (req, res) => {
  console.log('📡', new Date().toISOString(), '- GET /generos-confecc from', req.ip || req.connection.remoteAddress);
  
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Buscar la hoja TiposTareas dinámicamente
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tipoTareasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'TiposTareas' || s.properties.title === 'TipoTareas' || s.properties.title === 'tiposTareas' || s.properties.title === 'Tipos Tareas')
    );
    
    if (!tipoTareasSheet) {
      console.log('❌ No se encontró la hoja TiposTareas');
      return res.status(404).json({ error: 'No se encontró la hoja TiposTareas' });
    }
    
    console.log('✅ Hoja encontrada:', tipoTareasSheet.properties.title);
    
    // Obtener datos de las columnas H e I (nombre_confecc, codigo_confecc)
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tipoTareasSheet.properties.title}!H:I`
    });

    const rows = result.data.values || [];
    console.log(`📊 Total filas en columnas H:I: ${rows.length}`);
    console.log(`📊 Primeras 5 filas:`, rows.slice(0, 5));
    
    const generosSet = new Set();
    
    // Procesar filas (saltando el header si existe)
    rows.slice(1).forEach((row, index) => {
      const nombreConfecc = row[0]?.trim(); // Columna H
      const codigoConfecc = row[1]?.trim(); // Columna I
      
      if (index < 10) { // Log primeras 10 filas para debug
        console.log(`📊 Fila ${index + 2}:`, {
          H_nombre_confecc: nombreConfecc,
          I_codigo_confecc: codigoConfecc
        });
      }
      
      // Crear texto combinado: "Código (Nombre)" o solo el que esté disponible
      if (codigoConfecc && nombreConfecc) {
        // Ambas columnas tienen datos: "COD123 (Camisetas polo)"
        generosSet.add(`${codigoConfecc} (${nombreConfecc})`);
      } else if (codigoConfecc) {
        // Solo código disponible: "COD123"
        generosSet.add(codigoConfecc);
      } else if (nombreConfecc) {
        // Solo nombre disponible: "Camisetas polo"
        generosSet.add(nombreConfecc);
      }
    });
    
    // Convertir a array y ordenar
    const generos = Array.from(generosSet).sort();
    
    console.log(`✅ Encontrados ${generos.length} géneros de confección:`, generos);
    res.json(generos);
    
  } catch (error) {
    console.error('❌ Error obteniendo géneros de confección:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on 0.0.0.0:${PORT}`);
  console.log(`� JWT Authentication: ENABLED (24h tokens)`);
  console.log(`🛡️  Protected endpoints: /tasks (POST), /tasks/:id/* (POST)`);
  console.log(`�🔍 Health check disponible en:`);
  console.log(`   - Localmente: http://localhost:${PORT}/health`);
  console.log(`   - Desde la red: http://192.168.0.85:${PORT}/health`);
  console.log(`📡 Endpoints principales:`);
  console.log(`   - POST /login - Autenticación con JWT`);
  console.log(`   - POST /verify-token - Verificar token válido`);
  console.log(`   - GET /tasks - Obtener tareas (opcional JWT)`);
  console.log(`   - POST /tasks - Crear/actualizar tareas (requiere JWT)`);
});





