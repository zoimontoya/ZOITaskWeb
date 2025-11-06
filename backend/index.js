import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import fs from 'fs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

// Servicio de cache simple (para compatibilidad)
const cacheService = {
  cache: new Map(),
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Verificar si expiró
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  },
  
  set(key, value, ttlSeconds = 300) { // 5 minutos por defecto
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  },
  
  delete(key) {
    this.cache.delete(key);
  },
  
  invalidatePattern(pattern) {
    // Invalidar todas las claves que contengan el patrón
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
    console.log(`🗑️ Cache invalidado para patrón: ${pattern}`);
  },
  
  clear() {
    this.cache.clear();
    console.log('🗑️ Cache completamente limpiado');
  }
};

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
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1EEZlootxR63QHicF2cQ5GDmzQJ31V22fE202LXkufc4';
// ID de la hoja de técnicos - "SeguimientoEstadoFruta"
const TECHNICIAN_SPREADSHEET_ID = process.env.TECHNICIAN_SPREADSHEET_ID || '1I9mvuQRGx0Va3SAsBcNiI6ipybMI1EwCaSLMlXinBXM';

// Función auxiliar para formatear fechas al formato europeo DD/MM/YYYY
function formatDateToEuropean(date) {
  console.log(`🔧 formatDateToEuropean ENTRADA: "${date}" tipo: ${typeof date}`);
  
  if (!date) {
    console.log(`🔧 formatDateToEuropean SALIDA: fecha vacía`);
    return '';
  }
  
  let dateObj;
  if (typeof date === 'string') {
    // Si viene en formato YYYY-MM-DD, convertir correctamente
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log(`🔧 Detectado formato ISO: ${date}`);
      const parts = date.split('-');
      dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      console.log(`🔧 Parseado manualmente: año=${parts[0]}, mes=${parts[1]}, día=${parts[2]}`);
    } else if (date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      // Si ya viene en formato DD/MM/YYYY, devolverlo tal como está
      console.log(`🔧 Ya en formato europeo: ${date}`);
      return date;
    } else {
      console.log(`🔧 Formato desconocido, usando new Date(): ${date}`);
      dateObj = new Date(date);
    }
  } else {
    console.log(`🔧 Entrada es objeto Date: ${date}`);
    dateObj = new Date(date);
  }
  
  // Verificar que es una fecha válida
  if (isNaN(dateObj.getTime())) {
    console.error('❌ Fecha inválida en backend:', date);
    return '';
  }
  
  // Formato DD/MM/YYYY garantizado
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  
  const result = `${day}/${month}/${year}`;
  console.log(`📅 formatDateToEuropean RESULTADO: "${date}" → "${result}"`);
  return result;
}

// Función auxiliar para obtener fecha actual en formato europeo
function getCurrentEuropeanDate() {
  return formatDateToEuropean(new Date());
}

// Función para convertir fecha europea (DD/MM/YYYY) a formato ISO (YYYY-MM-DD) para JavaScript
function parseEuropeanDateToISO(europeanDate) {
  console.log(`🔄 parseEuropeanDateToISO ENTRADA: "${europeanDate}"`);
  
  if (!europeanDate || europeanDate === '') {
    console.log(`🔄 parseEuropeanDateToISO SALIDA: fecha vacía`);
    return '';
  }
  
  // Si ya está en formato ISO, devolverla como está
  if (String(europeanDate).match(/^\d{4}-\d{2}-\d{2}/)) {
    console.log(`🔄 parseEuropeanDateToISO YA ES ISO: ${europeanDate}`);
    return String(europeanDate);
  }
  
  // Buscar formato DD/MM/YYYY
  const europeanMatch = String(europeanDate).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (europeanMatch) {
    const [, day, month, year] = europeanMatch;
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    console.log(`🔄 parseEuropeanDateToISO CONVERSIÓN: ${europeanDate} → ${isoDate}`);
    return isoDate;
  }
  
  console.log(`🔄 parseEuropeanDateToISO NO CONVERTIBLE: ${europeanDate}`);
  return String(europeanDate);
}

// Función para parsear fecha en formato DD/MM/YYYY a objeto Date
function parseDateFromString(dateStr) {
  if (!dateStr || dateStr === '') {
    return new Date(0); // Fecha muy antigua para comparación
  }
  
  // Si es formato DD/MM/YYYY
  const match = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Fallback a parseo estándar
  return new Date(dateStr);
}

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

// Función auxiliar para obtener el ID más alto de ambas hojas: "Tareas" y "Trabajos"
async function getMaxIdFromBothSheets(sheets) {
  try {
    let maxId = 0;
    
    // Obtener metadatos del spreadsheet para encontrar ambas hojas
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    
    // Buscar hoja "Tareas"
    const tareasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Tareas' || s.properties.title === 'tareas')
    );
    
    // Buscar hoja "Trabajos"
    const trabajosSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Trabajos' || s.properties.title === 'trabajos')
    );
    
    console.log('🔍 Buscando ID máximo en hojas:');
    console.log(`- Tareas: ${tareasSheet ? 'Encontrada' : 'No encontrada'}`);
    console.log(`- Trabajos: ${trabajosSheet ? 'Encontrada' : 'No encontrada'}`);
    
    // Verificar IDs en hoja "Tareas"
    if (tareasSheet) {
      const tareasResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tareasSheet.properties.title}!A:A`, // Solo columna A (Código/ID)
      });
      
      const tareasRows = tareasResponse.data.values || [];
      console.log(`📋 Hoja "Tareas": ${tareasRows.length - 1} filas de datos`);
      
      if (tareasRows.length > 1) {
        for (let i = 1; i < tareasRows.length; i++) {
          const idValue = parseInt(tareasRows[i][0]);
          if (!isNaN(idValue) && idValue > maxId) {
            maxId = idValue;
            console.log(`📈 Nuevo ID máximo en Tareas: ${maxId}`);
          }
        }
      }
    }
    
    // Verificar IDs en hoja "Trabajos"
    if (trabajosSheet) {
      const trabajosResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${trabajosSheet.properties.title}!A:A`, // Solo columna A (Código/ID)
      });
      
      const trabajosRows = trabajosResponse.data.values || [];
      console.log(`💼 Hoja "Trabajos": ${trabajosRows.length - 1} filas de datos`);
      
      if (trabajosRows.length > 1) {
        for (let i = 1; i < trabajosRows.length; i++) {
          const idValue = parseInt(trabajosRows[i][0]);
          if (!isNaN(idValue) && idValue > maxId) {
            maxId = idValue;
            console.log(`📈 Nuevo ID máximo en Trabajos: ${maxId}`);
          }
        }
      }
    }
    
    console.log(`✅ ID máximo final encontrado: ${maxId}`);
    return maxId;
    
  } catch (err) {
    console.error('❌ Error obteniendo ID máximo de ambas hojas:', err);
    // Si hay error, intentar obtener solo de "Tareas" como fallback
    try {
      const tareasResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Tareas!A:A',
      });
      
      const rows = tareasResponse.data.values || [];
      let fallbackMaxId = 0;
      
      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const idValue = parseInt(rows[i][0]);
          if (!isNaN(idValue) && idValue > fallbackMaxId) fallbackMaxId = idValue;
        }
      }
      
      console.log(`🔄 Fallback - ID máximo desde solo "Tareas": ${fallbackMaxId}`);
      return fallbackMaxId;
      
    } catch (fallbackErr) {
      console.error('❌ Error en fallback también:', fallbackErr);
      return 0;
    }
  }
}

// Función auxiliar para validar horas trabajadas automáticamente
async function validarHorasAutomaticamente(authClient, taskId, tipoValidacion = 'completar') {
  try {
    console.log(`🔍 === VALIDANDO HORAS AUTOMÁTICAMENTE (${tipoValidacion.toUpperCase()}) ===`);
    console.log(`📋 Tarea ID: ${taskId}`);

    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // Buscar la hoja "Horas_PorValidar"
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const horasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Horas_PorValidar' || s.properties.title === 'horas_porvalidar')
    );
    
    if (!horasSheet) {
      console.log('⚠️ No se encontró la hoja "Horas_PorValidar" - saltando validación de horas');
      return { success: true, message: 'Sin horas que validar' };
    }
    
    // Obtener todas las filas de horas
    const horasResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${horasSheet.properties.title}!A:G`
    });
    
    const horasRows = horasResult.data.values || [];
    
    // Encontrar filas de la tarea específica que estén "No validada"
    const filasAActualizar = [];
    
    console.log(`🔍 DEBUG: Analizando ${horasRows.length} filas en Horas_PorValidar`);
    console.log(`🔍 DEBUG: Headers:`, horasRows[0]);
    
    horasRows.slice(1).forEach((row, index) => {
      const rowTaskId = row[4]?.toString().trim(); // Columna E - "Ranking" (Task ID) - CORREGIDO
      const estadoValidacion = row[6]?.toString().trim(); // Columna G - Estado validación
      
      // Debug: Log todas las filas de la tarea específica
      if (rowTaskId === taskId) {
        console.log(`🔍 DEBUG: Fila ${index + 2} de tarea ${taskId}:`, {
          taskId: rowTaskId,
          trabajador: row[1]?.toString().trim(), // Columna B
          fecha: row[2]?.toString().trim(), // Columna C
          estadoValidacion: estadoValidacion,
          filaCompleta: row
        });
      }
      
      if (rowTaskId === taskId && estadoValidacion === 'No validada') {
        filasAActualizar.push({
          rowIndex: index + 2, // +2 porque slice(1) y las filas son 1-indexed
          trabajador: row[1]?.toString().trim(),
          fecha: row[2]?.toString().trim(),
          horas: parseFloat(row[5]) || 0 // Columna F - horas totales
        });
      }
    });
    
    console.log(`📊 Encontradas ${filasAActualizar.length} filas de horas pendientes para tarea ${taskId}`);
    
    if (filasAActualizar.length > 0) {
      // Actualizar todas las horas a "Validada"
      const updates = filasAActualizar.map(fila => ({
        range: `${horasSheet.properties.title}!G${fila.rowIndex}`,
        values: [['Validada']]
      }));
      
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          valueInputOption: 'RAW',
          data: updates
        }
      });
      
      console.log(`✅ ${filasAActualizar.length} horas validadas automáticamente para tarea ${taskId}`);
      
      // Calcular estadísticas
      const totalHoras = filasAActualizar.reduce((sum, fila) => sum + fila.horas, 0);
      const trabajadoresUnicos = new Set(filasAActualizar.map(f => f.trabajador)).size;
      
      return {
        success: true,
        message: `${filasAActualizar.length} horas validadas automáticamente`,
        horasValidadas: filasAActualizar.length,
        totalHoras: totalHoras,
        trabajadores: trabajadoresUnicos
      };
    } else {
      console.log(`ℹ️ No hay horas pendientes de validación para tarea ${taskId}`);
      return { success: true, message: 'Sin horas pendientes que validar' };
    }
    
  } catch (error) {
    console.error('❌ Error validando horas automáticamente:', error);
    return { success: false, error: error.message };
  }
}

// Función auxiliar para registrar horas trabajadas en la hoja "Horas_PorValidar"
async function registrarHorasTrabajadas(authClient, trabajadoresAsignados, encargadoNombre, fechaActualizacion, tareaId, esTareaUrgente = false, esSuperior = false) {
  try {
    console.log('🔍 === REGISTRANDO HORAS TRABAJADAS ===');
    console.log('TareaId recibido:', tareaId);
    console.log('Trabajadores asignados:', trabajadoresAsignados?.length || 0);
    console.log('Encargado:', encargadoNombre);
    console.log('Fecha:', fechaActualizacion);
    console.log('Es tarea urgente (SIN cálculos):', esTareaUrgente);
    
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // Buscar la hoja "Horas_PorValidar"
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const horasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Horas_PorValidar' || s.properties.title === 'horas_porvalidar')
    );
    
    if (!horasSheet) {
      console.log('⚠️ No se encontró la hoja "Horas_PorValidar"');
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
      
      // Determinar el estado de validación (columna G)
      let estadoValidacion;
      if (esTareaUrgente) {
        // Si es tarea urgente de un superior, ya está validada
        // Si es tarea urgente de un encargado, no está validada aún
        if (esSuperior) {
          estadoValidacion = "Validada"; // Tareas urgentes de superiores auto-validadas
          console.log(`✅ TAREA URGENTE DE SUPERIOR - Horas auto-validadas`);
        } else {
          estadoValidacion = "No validada"; // Tareas urgentes de encargados requieren validación
          console.log(`⏳ TAREA URGENTE DE ENCARGADO - Horas pendientes de validación`);
        }
      } else {
        // Tareas normales se consideran validadas automáticamente
        estadoValidacion = "Validada";
      }
      
      const filaAInsertar = [
        fechaActualizacion,                    // A: Fecha
        encargadoNombre,                      // B: Grupo (nombre del encargado)
        trabajadorAsignado.trabajador.nombre, // C: Nombre del empleado
        horasARegistrar,                      // D: Tiempo (horas - directas si es urgente)
        rankingValue,                         // E: Ranking (ID de la tarea)
        trabajadorData.empresa || trabajadorAsignado.trabajador.empresa || '', // F: Empresa
        estadoValidacion                      // G: Estado de validación
      ];
      
      console.log('Fila a insertar:', filaAInsertar);
      filasAInsertar.push(filaAInsertar);
    });
    
    if (filasAInsertar.length === 0) {
      console.log('No hay trabajadores asignados para registrar');
      return;
    }
    
    // Insertar las filas en la hoja "Horas_PorValidar"
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
    
    console.log(`✅ Registradas ${filasAInsertar.length} filas de horas trabajadas en la hoja "Horas_PorValidar"`);
    
  } catch (err) {
    console.error('❌ Error registrando horas trabajadas:', err);
  }
}

// Endpoint para obtener invernaderos filtrados por cabezal (soporta múltiples cabezales separados por ;)
app.get('/invernaderos/:cabezal', async (req, res) => {
  try {
    const { cabezal } = req.params;
    
    if (!cabezal) {
      return res.status(400).json({ success: false, error: 'Cabezal requerido' });
    }
    
    // Parsear múltiples cabezales separados por punto y coma
    const cabezalesUsuario = cabezal.split(';').map(c => c.trim()).filter(c => c.length > 0);
    console.log('Obteniendo invernaderos para cabezales:', cabezalesUsuario);
    
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
    
    // Agrupar invernaderos por cabezal, incluyendo todos los cabezales del usuario
    const cabezalesMap = new Map();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cabezalValue = cabezalIdx !== -1 ? row[cabezalIdx] : 'Sin Cabezal';
      
      // Verificar si este cabezal está en la lista de cabezales del usuario
      const cabezalCoincide = cabezalesUsuario.some(userCabezal => 
        String(cabezalValue).toUpperCase() === userCabezal.toUpperCase()
      );
      
      if (cabezalCoincide) {
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
          
          // Agregar invernadero al cabezal correspondiente
          if (!cabezalesMap.has(String(cabezalValue))) {
            cabezalesMap.set(String(cabezalValue), {
              nombre: String(cabezalValue),
              invernaderos: []
            });
          }
          
          cabezalesMap.get(String(cabezalValue)).invernaderos.push({
            nombre: nombreInvernadero.trim(),
            dimensiones: dimensionValue.toString()
          });
        }
      }
    }

    // Convertir Map a array, ordenar invernaderos dentro de cada cabezal
    const cabezalesArray = Array.from(cabezalesMap.values()).map(cabezal => ({
      ...cabezal,
      invernaderos: cabezal.invernaderos.sort((a, b) => a.nombre.localeCompare(b.nombre))
    }));

    // Crear estructura de respuesta
    const result = {
      cabezales: cabezalesArray
    };

    console.log(`Invernaderos encontrados para cabezales [${cabezalesUsuario.join(', ')}]:`, cabezalesArray.reduce((total, c) => total + c.invernaderos.length, 0));
    console.log('Cabezales procesados:', cabezalesArray.map(c => `${c.nombre} (${c.invernaderos.length} invernaderos)`));
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

// Obtener encargados filtrados por grupo de trabajo y cabezal (soporta múltiples cabezales separados por ;)
app.get('/encargados/:grupo/:cabezal', optionalJWT, async (req, res) => {
  try {
    const { grupo, cabezal } = req.params;
    
    if (!grupo || !cabezal) {
      return res.status(400).json({ success: false, error: 'Grupo y cabezal requeridos' });
    }
    
    // Parsear múltiples cabezales separados por punto y coma
    const cabezalesUsuario = cabezal.split(';').map(c => c.trim()).filter(c => c.length > 0);
    console.log('Obteniendo encargados para grupo:', grupo, 'y cabezales:', cabezalesUsuario);
    
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
      .filter(row => {
        // Verificar rol de encargado
        if (!row[idxRol] || String(row[idxRol]).toLowerCase() !== 'encargado') {
          return false;
        }
        
        // Verificar grupo de trabajo
        if (!row[idxGrupo] || String(row[idxGrupo]).toUpperCase() !== grupo.toUpperCase()) {
          return false;
        }
        
        // Verificar que el cabezal del encargado coincida con alguno de los cabezales del usuario
        if (!row[idxCabezal]) {
          return false;
        }
        
        const cabezalEncargado = String(row[idxCabezal]);
        // Parsear cabezales del encargado (también puede tener múltiples)
        const cabezalesEncargado = cabezalEncargado.split(';').map(c => c.trim()).filter(c => c.length > 0);
        
        // Verificar si hay alguna coincidencia entre cabezales del usuario y del encargado
        return cabezalesUsuario.some(userCabezal => 
          cabezalesEncargado.some(encargadoCabezal => 
            userCabezal.toUpperCase() === encargadoCabezal.toUpperCase()
          )
        );
      })
      .map(row => ({
        id: row[idxId],
        name: row[idxName],
        rol: row[idxRol],
        grupo_trabajo: row[idxGrupo],
        cabezal: row[idxCabezal]
      }));
    
    console.log(`Encargados encontrados para ${grupo}/[${cabezalesUsuario.join(', ')}]:`, encargados.length);
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
    
    // Soportar múltiples grupos separados por ; tanto en el usuario como en el encargado
    const gruposUsuario = grupo.split(';').map(g => g.trim().toUpperCase()).filter(g => g.length > 0);
    const encargados = rows.slice(1)
      .filter(row => {
        if (!row[idxRol] || String(row[idxRol]).toLowerCase() !== 'encargado') return false;
        if (!row[idxGrupo]) return false;
        // El encargado puede tener varios grupos separados por ;
        const gruposEncargado = String(row[idxGrupo]).split(';').map(g => g.trim().toUpperCase()).filter(g => g.length > 0);
        // Coincide si al menos un grupo del usuario está en los grupos del encargado
        return gruposUsuario.some(grupoU => gruposEncargado.includes(grupoU));
      })
      .map(row => ({
        id: row[idxId],
        name: row[idxName],
        rol: row[idxRol],
        grupo_trabajo: row[idxGrupo]
      }));

    console.log(`Encargados encontrados para [${gruposUsuario.join(', ')}]:`, encargados.length);
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
    
    // Dividir grupos por ; para soportar múltiples grupos como "MANTENIMIENTO; TRANSPORTE"
    const gruposUsuario = grupo.split(';').map(g => g.trim().toUpperCase()).filter(g => g.length > 0);
    console.log('Obteniendo tipos de tarea para grupos:', gruposUsuario);
    
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
    
    // Debug: mostrar todos los grupos disponibles en la hoja
    const gruposDisponibles = [...new Set(rows.slice(1).map(row => row[idxGrupo]).filter(g => g))];
    console.log('🔍 Grupos disponibles en TiposTareas:', gruposDisponibles);
    console.log('🎯 Grupos buscados por el usuario:', gruposUsuario);
    
    const tiposTarea = rows.slice(1)
      .filter(row => {
        if (!row[idxGrupo]) return false;
        const grupoTarea = String(row[idxGrupo]).toUpperCase();
        const matched = gruposUsuario.includes(grupoTarea);
        if (matched) {
          console.log(`✅ Coincidencia encontrada: "${grupoTarea}" está en [${gruposUsuario.join(', ')}]`);
        }
        return matched;
      })
      .map(row => ({
        grupo_trabajo: row[idxGrupo] || '',
        familia: row[idxFamilia] || '',
        tipo: row[idxTipo] || '',
        subtipo: row[idxSubtipo] || '',
        tarea_nombre: row[idxNombre] || '',
        jornal_unidad: row[idxJornal] || ''
      }));
    
    console.log(`Tipos de tarea encontrados para grupos [${gruposUsuario.join(', ')}]:`, tiposTarea.length);
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
        fecha_limite: (() => {
          const originalDate = row[7] || '';
          console.log(`🔍 FECHA LIMITE ORIGINAL - Tarea ${row[0]}: "${originalDate}" (tipo: ${typeof originalDate})`);
          const convertedDate = parseEuropeanDateToISO(originalDate);
          console.log(`🔍 FECHA LIMITE CONVERTIDA - Tarea ${row[0]}: "${originalDate}" → "${convertedDate}"`);
          return convertedDate;
        })(),  // H - Convertir DD/MM/YYYY a YYYY-MM-DD para JavaScript
        encargado_id: row[8] || '',                    // I
        descripcion: row[9] || '',                     // J
        nombre_superior: row[10] || '',                // K
        fecha_inicio: parseEuropeanDateToISO(row[11]) || '',  // L - Convertir DD/MM/YYYY a YYYY-MM-DD
        fecha_fin: parseEuropeanDateToISO(row[12]) || '',     // M - Convertir DD/MM/YYYY a YYYY-MM-DD
        desarrollo_actual: row[13] || '',              // N
        dimension_total: row[14] || '',                // O
        proceso: row[15] || 'No iniciado',             // P - ÚNICO campo de estado
        fecha_actualizacion: row[16] || '',            // Q
        genero: row[17] || ''                          // R - Género para tareas ALMACEN-CONFECC
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
      // Procesar estimacion_horas para convertir formato europeo (coma) a americano (punto)
      let estimacionHorasValue = finalObj.estimacion_horas || '';
      if (estimacionHorasValue && typeof estimacionHorasValue === 'string') {
        estimacionHorasValue = estimacionHorasValue.replace(',', '.');
        finalObj.estimacion_horas = Number(estimacionHorasValue) || 0;
      } else {
        finalObj.estimacion_horas = Number(estimacionHorasValue) || 0;
      }
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
  const { id, password, username } = req.body;
  const userId = id || username; // Acepta tanto 'id' como 'username'
  console.log('🔐 POST /login - Petición recibida para usuario:', userId);
  console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
  
  if (!userId || !password) {
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
      return String(row[idxId]) === String(userId) && String(row[idxPassword]) === String(password);
    });
    console.log('Fila encontrada:', userRow);
    if (userRow) {
      const rol = idxRol !== -1 ? userRow[idxRol] : undefined;
      const name = idxName !== -1 ? userRow[idxName] : userId;
      const grupo_trabajo = idxGrupo !== -1 ? userRow[idxGrupo] : undefined;
      const cabezal = idxCabezal !== -1 ? userRow[idxCabezal] : undefined;
      
      // Crear el objeto usuario
      const user = { id: userId, rol, name, grupo_trabajo, cabezal };
      
      // Generar token JWT con duración de 24 horas
      const token = jwt.sign(
        {
          userId: userId,
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
      console.log('Token JWT generado para usuario:', userId);
      
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

// Endpoint de login para técnicos
app.post('/login-technician', async (req, res) => {
  const { id, password } = req.body;
  console.log('🔧 POST /login-technician - Petición recibida para técnico:', id);
  console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
  
  if (!id || !password) {
    console.log('❌ Faltan credenciales en la petición técnica');
    return res.status(400).json({ success: false, error: 'Faltan credenciales' });
  }

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Leer de la hoja de técnicos "SeguimientoEstadoFruta" -> pestaña "usuarios"
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'usuarios', // Pestaña de usuarios técnicos
    });

    const rows = response.data.values;
    console.log('🔧 Filas leídas de usuarios técnicos:', rows ? rows.length : 0);

    if (!rows || rows.length === 0) {
      console.log('❌ No hay usuarios técnicos en la hoja');
      return res.status(500).json({ success: false, error: 'No hay usuarios técnicos configurados' });
    }

    const headers = rows[0];
    console.log('🔧 Cabeceras técnicos:', headers);

    const idxId = headers.findIndex(h => h.toLowerCase() === 'id');
    const idxPassword = headers.findIndex(h => h.toLowerCase() === 'password' || h.toLowerCase() === 'contraseña');
    const idxName = headers.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'nombre');
    const idxRol = headers.findIndex(h => h.toLowerCase() === 'rol');

    console.log('🔧 Índices técnicos:', { idxId, idxPassword, idxName, idxRol });

    if (idxId === -1 || idxPassword === -1) {
      console.log('❌ Faltan columnas id/password en usuarios técnicos');
      return res.status(500).json({ success: false, error: 'Configuración incorrecta de usuarios técnicos' });
    }

    // Buscar usuario técnico
    const techUserRow = rows.slice(1).find(row => {
      return String(row[idxId]) === String(id) && String(row[idxPassword]) === String(password);
    });

    console.log('🔧 Fila técnico encontrada:', techUserRow);

    if (techUserRow) {
      const name = idxName !== -1 ? techUserRow[idxName] : id;
      const rol = idxRol !== -1 ? techUserRow[idxRol] : 'tecnico';

      // Crear el objeto usuario técnico
      const user = { 
        id: id, 
        name: name, 
        rol: rol,
        tipo: 'tecnico' // Identificador especial
      };

      // Generar token JWT con duración de 24 horas
      const token = jwt.sign(
        {
          userId: id,
          name: name,
          rol: rol,
          tipo: 'tecnico',
          nombre_completo: name
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log('✅ Login técnico correcto:', user);
      console.log('🎫 Token JWT técnico generado para:', id);

      return res.json({ 
        success: true, 
        token: token,
        user: user,
        message: 'Login técnico exitoso'
      });
    } else {
      console.log('❌ ID o contraseña incorrectos para técnico');
      return res.json({ success: false, message: 'Credenciales de técnico incorrectas' });
    }
  } catch (err) {
    console.error('❌ Error en /login-technician:', err);
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
      
      // Determinar jornales_reales a preservar
      const jornalesRealesOriginales = Number(rows[rowIndex][6]) || 0;
      const jornalesRealesRequest = req.body.jornales_reales !== undefined ? Number(req.body.jornales_reales) || 0 : null;
      const jornalesRealesFinales = esTareaUrgente ? jornalesRealesOriginales : (jornalesRealesRequest !== null ? jornalesRealesRequest : jornalesRealesOriginales);
      
      console.log(`🔧 === PRESERVANDO JORNALES REALES ===`);
      console.log(`📋 jornales_reales originales (BD): ${jornalesRealesOriginales}`);
      console.log(`📋 jornales_reales desde request: ${jornalesRealesRequest}`);
      console.log(`📋 jornales_reales finales: ${jornalesRealesFinales}`);
      console.log(`📋 Es tarea urgente: ${esTareaUrgente}`);
      
      // Preservar fecha_inicio existente si no se envía nueva
      const fechaInicioOriginal = rows[rowIndex][11] || ''; // Columna L (índice 11)
      const fechaInicioFinal = req.body.fecha_inicio ? formatDateToEuropean(req.body.fecha_inicio) : fechaInicioOriginal;
      
      console.log(`🔧 === PRESERVANDO FECHA_INICIO ===`);
      console.log(`📋 fecha_inicio original (BD): "${fechaInicioOriginal}"`);
      console.log(`📋 fecha_inicio desde request: "${req.body.fecha_inicio}"`);
      console.log(`📋 fecha_inicio final: "${fechaInicioFinal}"`);
      
      // Preservar fecha_actualizacion existente si no se envía nueva
      const fechaActualizacionOriginal = rows[rowIndex][16] || '';
      const fechaActualizacionFinal = req.body.fecha_actualizacion || fechaActualizacionOriginal;
      
      console.log(`🔧 === PRESERVANDO FECHA_ACTUALIZACION ===`);
      console.log(`📋 fecha_actualizacion original (BD): "${fechaActualizacionOriginal}"`);
      console.log(`📋 fecha_actualizacion desde request: "${req.body.fecha_actualizacion}"`);
      console.log(`📋 fecha_actualizacion final: "${fechaActualizacionFinal}"`);
      
      // Preservar género existente si no se envía nuevo
      const generoOriginal = rows[rowIndex][17] || ''; // Columna R (índice 17)
      const generoFinal = req.body.genero || generoOriginal;
      
      console.log(`🔧 === PRESERVANDO GÉNERO ===`);
      console.log(`📋 genero original (BD): "${generoOriginal}"`);
      console.log(`📋 genero desde request: "${req.body.genero}"`);
      console.log(`📋 genero final: "${generoFinal}"`);

      const updatedRow = [
        idToUpdate,                                    // A: id
        req.body.invernadero,                          // B: invernadero
        req.body.tipo_tarea,                           // C: tipo_tarea
        estimacionHoras,                               // D: estimacion_horas (ya calculado en frontend)
        horaJornal,                                    // E: hora_jornal (0=6hrs, 1=8hrs)
        horasKilos,                                    // F: horas_kilos (0=Hectáreas, 1=Kilos)
        jornalesRealesFinales,                         // G: jornales_reales (preservado en edición)
        formatDateToEuropean(req.body.fecha_limite),   // H: fecha_limite en formato DD/MM/YYYY
        req.body.encargado_id,                         // I: encargado_id
        req.body.descripcion,                          // J: descripcion
        req.body.nombre_superior || '',                // K: nombre_superior
        fechaInicioFinal,                              // L: fecha_inicio (preservar existente si no se envía)
        formatDateToEuropean(req.body.fecha_fin),      // M: fecha_fin en formato DD/MM/YYYY
        req.body.desarrollo_actual !== undefined ? parseFloat((parseFloat(req.body.desarrollo_actual) || 0).toFixed(3)) : (parseFloat(rows[rowIndex][13]) || 0),      // N: desarrollo_actual (preservar si no se envía)
        parseFloat((parseFloat(req.body.dimension_total) || 0).toFixed(3)),     // O: dimension_total (máximo 3 decimales)
        req.body.proceso || rows[rowIndex][15] || 'No iniciado',             // P: proceso (preservar el estado existente si no se envía)
        fechaActualizacionFinal,                       // Q: fecha_actualizacion (preservar el valor existente al editar)
        generoFinal                                    // R: genero (nuevo campo para tareas ALMACEN-CONFECC)
      ];
      
      console.log('🔄 Actualizando tarea con proceso:', req.body.proceso);
      console.log('📊 Fila completa a actualizar:', updatedRow);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tareasSheet.properties.title}!A${rowIndex + 1}:R${rowIndex + 1}`, // Actualizado a columna R (18 columnas)
        valueInputOption: 'RAW',
        resource: { values: [updatedRow] }
      });

      // Formatear la celda del invernadero como texto para preservar ceros
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              repeatCell: {
                range: {
                  sheetId: tareasSheet.properties.sheetId,
                  startRowIndex: rowIndex,
                  endRowIndex: rowIndex + 1,
                  startColumnIndex: 1, // Columna B (invernadero)
                  endColumnIndex: 2
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'TEXT'
                    }
                  }
                },
                fields: 'userEnteredFormat.numberFormat'
              }
            }]
          }
        });
      } catch (err) {
        console.log('⚠️ No se pudo formatear celda como texto:', err.message);
      }
      
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
        resource: { values: [[parseFloat((parseFloat(req.body.desarrollo_actual) || 0).toFixed(3))]] }
      });

      // Actualizar progreso (porcentaje) si existe la columna
      if (progresoIndex >= 0) {
        const progresoColLetter = String.fromCharCode(65 + progresoIndex);
        console.log(`Actualizando progreso en columna ${progresoColLetter} con valor: ${req.body.progreso}`);
        
        // Para tareas de kilos, mantener el valor como string, para hectáreas convertir a número
        let progresoValue;
        // Si la tarea es de kilos y no está terminada, poner 'Recolectando'
        const horasKilosCol = headers.findIndex(h => h && h.toLowerCase().includes('horas_kilos'));
        let isKilosTask = false;
        if (horasKilosCol >= 0 && rows[rowIndex][horasKilosCol] !== undefined) {
          isKilosTask = String(rows[rowIndex][horasKilosCol]).trim() === '1';
        } else if (req.body.horas_kilos !== undefined) {
          isKilosTask = String(req.body.horas_kilos).trim() === '1';
        }
        if (isKilosTask && req.body.progreso !== 'Terminada') {
          progresoValue = 'Recolectando';
        } else if (req.body.progreso === 'Iniciada' || req.body.progreso === 'No iniciado' || req.body.progreso === 'Terminada') {
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

      // 2. Buscar y eliminar filas relacionadas en la hoja "Horas_PorValidar"
      const horasSheet = spreadsheetMeta.data.sheets.find(s =>
        s.properties && (s.properties.title === 'Horas_PorValidar' || s.properties.title === 'horas_porvalidar')
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
    
    // Usar IDs del frontend si están disponibles, sino generar nuevos
    let lastId = await getMaxIdFromBothSheets(sheets);
    console.log(`📊 ID más alto encontrado en ambas hojas (Tareas + Trabajos): ${lastId}`);
    const newRows = [];
    for (let i = 0; i < tareas.length; i++) {
      const tarea = tareas[i];
      
      // PRIORIDAD 1: Usar ID generado por frontend si existe y es válido
      if (tarea.id && tarea.id !== '' && tarea.id !== 0) {
        console.log(`� USANDO ID del frontend: ${tarea.id} para tarea ${i + 1}/${tareas.length} (${tarea.invernadero})`);
      } else {
        // FALLBACK: Generar ID secuencial solo si no viene del frontend
        tarea.id = ++lastId;
        console.log(`🔄 GENERANDO ID secuencial: ${tarea.id} para tarea ${i + 1}/${tareas.length} (${tarea.invernadero})`);
      }
      
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
      
      console.log(`🚀 PREPARANDO FILA PARA GOOGLE SHEETS - tarea ID: ${tarea.id}`);
      console.log(`📅 FECHA ANTES DE CONVERSION: "${tarea.fecha_limite}"`);
      const fechaConvertida = formatDateToEuropean(tarea.fecha_limite);
      console.log(`📅 FECHA DESPUES DE CONVERSION: "${fechaConvertida}"`);
      
      const row = [
        tarea.id,                                    // A: id
        tarea.invernadero,                           // B: invernadero
        tarea.tipo_tarea,                            // C: tipo_tarea
        estimacionHoras,                             // D: estimacion_horas (ya calculado en frontend)
        horaJornal,                                  // E: hora_jornal (0=SIN cálculos para urgentes, 1=8hrs)
        horasKilos,                                  // F: horas_kilos (0=Hectáreas, 1=Kilos)
        jornalesReales,                              // G: jornales_reales (0 para normales, horas directas para urgentes)
        fechaConvertida,                             // H: fecha_limite en formato DD/MM/YYYY
        tarea.encargado_id,                          // I: encargado_id
        tarea.descripcion,                           // J: descripcion
        tarea.nombre_superior || '',                 // K: nombre_superior (CLAVE para detección)
        '',                                          // L: fecha_inicio (vacía al crear)
        '',                                          // M: fecha_fin (vacía al crear)
        esTareaUrgente ? parseFloat((parseFloat(tarea.desarrollo_actual || dimensionTotalSeleccionada) || 0).toFixed(3)) : 0, // N: desarrollo_actual (para urgentes = dimension_total)
        parseFloat((parseFloat(dimensionTotalSeleccionada) || 0).toFixed(3)), // O: dimension_total (máximo 3 decimales)
        tarea.proceso || 'No iniciado',              // P: proceso (respeta valor del frontend)
        '',                                          // Q: fecha_actualizacion (vacía al crear, se llenará al actualizar)
        tarea.genero || ''                           // R: genero (nuevo campo para tareas ALMACEN-CONFECC)
      ];
      
      // Si es tarea urgente creada por un superior (ya validada), rellenar fechas L, M y Q con fecha_limite
      if (esTareaUrgente && tarea.proceso && String(tarea.proceso).toLowerCase() === 'terminada') {
        // row indices: L=11, M=12, Q=16 (0-based indices 11,12,16)
        row[11] = fechaConvertida; // fecha_inicio (L)
        row[12] = fechaConvertida; // fecha_fin (M)
        row[16] = fechaConvertida; // fecha_actualizacion (Q)
        console.log(`🔧 Backend: rellenando fechas inicio/fin/actualizacion para tarea urgente ID ${tarea.id} con ${fechaConvertida}`);
      }
      
      console.log(`📋 FILA COMPLETA PREPARADA:`, row);
      console.log(`🏪 GÉNERO guardado en columna R (índice 17):`, tarea.genero || 'VACÍO');
      newRows.push(row);
    }
    
    // VALIDACIÓN FINAL: Verificar que no hay IDs duplicados en la hoja antes de insertar
    console.log('🔍 === VERIFICACIÓN ANTI-DUPLICADOS ===');
    const currentTasksResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A:A`
    });
    
    const existingIds = new Set();
    if (currentTasksResponse.data.values && currentTasksResponse.data.values.length > 1) {
      for (let i = 1; i < currentTasksResponse.data.values.length; i++) {
        const existingId = currentTasksResponse.data.values[i][0];
        if (existingId) existingIds.add(String(existingId));
      }
    }
    
    // Verificar cada nueva tarea
    const idsToCreate = newRows.map(row => String(row[0]));
    const duplicatedIds = idsToCreate.filter(id => existingIds.has(id));
    
    if (duplicatedIds.length > 0) {
      console.error('🚨 DUPLICADOS DETECTADOS EN BACKEND:', duplicatedIds);
      return res.status(409).json({ 
        error: 'IDs duplicados detectados', 
        duplicatedIds: duplicatedIds,
        message: 'Por favor, regenere las tareas. Si el problema persiste, contacte al administrador.'
      });
    }
    
    console.log(`✅ Verificación completada: ${idsToCreate.length} IDs únicos confirmados`);
    
    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: tareasSheet.properties.title,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: newRows }
    });

    // Formatear las celdas de invernadero como texto para preservar ceros
    if (newRows.length > 0) {
      try {
        const startRow = appendResult.data.updates.updatedRange.match(/(\d+)$/)[1] - newRows.length;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              repeatCell: {
                range: {
                  sheetId: tareasSheet.properties.sheetId,
                  startRowIndex: parseInt(startRow),
                  endRowIndex: parseInt(startRow) + newRows.length,
                  startColumnIndex: 1, // Columna B (invernadero)
                  endColumnIndex: 2
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'TEXT'
                    }
                  }
                },
                fields: 'userEnteredFormat.numberFormat'
              }
            }]
          }
        });
      } catch (err) {
        console.log('⚠️ No se pudo formatear celdas de invernadero como texto:', err.message);
      }
    }
    
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
          true, // es tarea urgente
          tarea.es_superior || false // es superior - AÑADIDO
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
    const estadoAnterior = currentRow[15] || ''; // proceso (columna P)
    const tipoTarea = currentRow[2] || ''; // tipo_tarea (columna C)
    const horasKilos = Number(currentRow[5]) || 0; // horas_kilos (columna F) - 1=almacén con kg
    const esAlmacen = horasKilos === 1;
    
    console.log('🏪 ACEPTANDO TAREA:', {
      taskId: taskId,
      tipoTarea: tipoTarea,
      horasKilos: horasKilos,
      esAlmacen: esAlmacen,
      estadoAnterior: estadoAnterior,
      fechaActual: getCurrentEuropeanDate()
    });
    
    // Asegurar que el array tenga suficientes elementos para la nueva estructura de 18 columnas (A-R)
    while (currentRow.length < 18) {
      currentRow.push('');
    }
    
    // Actualizar fecha_inicio (columna L = índice 11) y proceso (columna P = índice 15)
    currentRow[11] = getCurrentEuropeanDate(); // fecha_inicio (columna L) en formato DD/MM/YYYY
    currentRow[15] = 'Iniciada'; // proceso (columna P)
    
    if (esAlmacen) {
      console.log('✅ TAREA DE ALMACÉN ACEPTADA:', {
        tipoTarea: tipoTarea,
        fechaInicio: currentRow[11],
        nuevoEstado: currentRow[15]
      });
    }
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A${rowIndex + 1}:R${rowIndex + 1}`, // Actualizado a columna R (18 columnas)
      valueInputOption: 'RAW',
      resource: { values: [currentRow] }
    });
    
    // 🔄 FUSIÓN: Si la tarea estaba "Por validar", validar automáticamente las horas
    let resultadoValidacionHoras = null;
    console.log(`🔍 DEBUG: Verificando validación de horas para tarea ${taskId} (estado anterior: "${estadoAnterior}")`);
    
    if (estadoAnterior === 'Por validar') {
      console.log(`🚨 Tarea ${taskId} cambió de "Por validar" a "Iniciada" - validando horas automáticamente`);
      resultadoValidacionHoras = await validarHorasAutomaticamente(auth, taskId, 'aceptar');
    } else {
      console.log(`ℹ️ Tarea ${taskId} no tenía estado "Por validar" (era: "${estadoAnterior}") - validando horas de todos modos`);
      // Validar horas automáticamente sin importar el estado anterior para tareas urgentes
      resultadoValidacionHoras = await validarHorasAutomaticamente(auth, taskId, 'aceptar-sin-condicion');
    }
    
    // Invalidar caché relacionado
    if (cacheService) {
      cacheService.invalidatePattern('tasks');
      cacheService.invalidatePattern(`trabajadores-tarea:${taskId}`);
      console.log('🔄 Cache invalidado después de aceptar tarea');
    }
    
    console.log('Tarea aceptada:', taskId, 'estado anterior:', estadoAnterior);
    
    const respuesta = { 
      result: 'success', 
      accepted: taskId,
      estadoAnterior: estadoAnterior,
      estadoNuevo: 'Iniciada'
    };
    
    // Añadir información de validación de horas si ocurrió
    if (resultadoValidacionHoras) {
      respuesta.validacionHoras = resultadoValidacionHoras;
    }
    
    res.json(respuesta);
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
    
    // Asegurar que el array tenga suficientes elementos para 18 columnas (A-R)
    while (currentRow.length < 18) {
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
    currentRow[12] = getCurrentEuropeanDate(); // fecha_fin (columna M) en formato DD/MM/YYYY
    currentRow[15] = 'Terminada'; // proceso (columna P)
    currentRow[16] = fechaActual; // fecha_actualizacion (columna Q)
    
    // Actualizar toda la fila de una vez
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A${rowIndex + 1}:R${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [currentRow] }
    });
    
    // PASO 3: Registrar horas trabajadas UNA SOLA VEZ
    if (req.body.trabajadores_asignados && req.body.trabajadores_asignados.length > 0) {
      const encargadoNombre = req.body.encargado_nombre || 'Encargado';
      await registrarHorasTrabajadas(auth, req.body.trabajadores_asignados, encargadoNombre, fechaActual, taskId, false);
    }
    
    // 🔄 FUSIÓN: Validar automáticamente las horas al completar directamente
    console.log(`🚨 Tarea ${taskId} completada directamente - validando horas automáticamente`);
    const resultadoValidacionHoras = await validarHorasAutomaticamente(auth, taskId, 'completar-directo');
    
    // Invalidar caché relacionado
    if (cacheService) {
      cacheService.invalidatePattern('tasks');
      cacheService.invalidatePattern(`trabajadores-tarea:${taskId}`);
      console.log('🔄 Cache invalidado después de completar tarea directamente');
    }
    
    console.log('Tarea completada directamente:', taskId, 'fecha_fin:', today, 'fecha_actualizacion:', fechaActual);
    
    const respuesta = { 
      result: 'success', 
      completed: taskId, 
      fecha_actualizacion: fechaActual 
    };
    
    // Añadir información de validación de horas
    if (resultadoValidacionHoras) {
      respuesta.validacionHoras = resultadoValidacionHoras;
    }
    
    res.json(respuesta);
    
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
    
    // Asegurar que el array tenga suficientes elementos para la nueva estructura de 18 columnas
    while (currentRow.length < 18) {
      currentRow.push('');
    }
    
    const fechaActual = getCurrentEuropeanDate(); // Formato DD/MM/YYYY consistente

    // Actualizar fecha_inicio (columna L), fecha_fin (columna M), proceso (columna P) y fecha_actualizacion (columna Q)
    currentRow[11] = getCurrentEuropeanDate(); // fecha_inicio (columna L) en formato DD/MM/YYYY - AÑADIDO
    currentRow[12] = getCurrentEuropeanDate(); // fecha_fin (columna M) en formato DD/MM/YYYY
    currentRow[15] = 'Terminada'; // proceso (columna P)
    currentRow[16] = fechaActual; // fecha_actualizacion (columna Q) - DD/MM/YYYY - para tracking
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tareasSheet.properties.title}!A${rowIndex + 1}:R${rowIndex + 1}`, // Actualizado a columna R (18 columnas)
      valueInputOption: 'RAW',
      resource: { values: [currentRow] }
    });
    
    // Registrar horas trabajadas si hay trabajadores asignados al completar
    if (req.body.trabajadores_asignados && req.body.trabajadores_asignados.length > 0) {
      const encargadoNombre = req.body.encargado_nombre || 'Encargado'; // Obtener el nombre del encargado que completa la tarea
      await registrarHorasTrabajadas(auth, req.body.trabajadores_asignados, encargadoNombre, fechaActual, taskId, false);
    }
    
    // 🔄 FUSIÓN: Validar automáticamente las horas al completar la tarea
    console.log(`🚨 Tarea ${taskId} completada - validando horas automáticamente`);
    const resultadoValidacionHoras = await validarHorasAutomaticamente(auth, taskId, 'completar');
    
    // Invalidar caché relacionado
    if (cacheService) {
      cacheService.invalidatePattern('tasks');
      cacheService.invalidatePattern(`trabajadores-tarea:${taskId}`);
      console.log('🔄 Cache invalidado después de completar tarea');
    }
    
    console.log('Tarea completada:', taskId, 'fecha_fin:', today, 'fecha_actualizacion:', fechaActual);
    
    const respuesta = { 
      result: 'success', 
      completed: taskId, 
      fecha_actualizacion: fechaActual 
    };
    
    // Añadir información de validación de horas
    if (resultadoValidacionHoras) {
      respuesta.validacionHoras = resultadoValidacionHoras;
    }
    
    res.json(respuesta);
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

// 📋 Endpoint para obtener trabajadores de una tarea específica desde la hoja "Horas_PorValidar"
app.get('/trabajadores-tarea/:taskId', optionalJWT, async (req, res) => {
  const { taskId } = req.params;
  console.log('📋 GET /trabajadores-tarea/:taskId - Obteniendo trabajadores de tarea:', taskId);
  
  if (!taskId) {
    return res.status(400).json({ success: false, error: 'ID de tarea requerido' });
  }
  
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Buscar la hoja "Horas_PorValidar" dinámicamente
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const horasSheet = spreadsheetMeta.data.sheets.find(s =>
      s.properties && (s.properties.title === 'Horas_PorValidar' || s.properties.title === 'horas_porvalidar')
    );
    
    if (!horasSheet) {
      return res.status(404).json({ error: 'No se encontró la hoja de Horas_PorValidar' });
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
        const horasRaw = row[horasIndex];
        
        // Convertir coma decimal a punto decimal para parseFloat
        let horasStr = horasRaw ? horasRaw.toString().replace(',', '.') : '0';
        const horasParsed = parseFloat(horasStr) || 0;
        
        console.log(`🔍 Valor horas raw: "${horasRaw}" -> normalizado: "${horasStr}" -> parsed: ${horasParsed}`);
        
        trabajadoresData.push({
          trabajador: row[trabajadorIndex] || '',
          horas: horasParsed,
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
        // Usar precisión decimal para evitar errores de punto flotante
        const horasAnteriores = trabajadoresAgrupados[registro.trabajador].horasTotal;
        const horasNuevas = registro.horas;
        const horasTotal = Math.round((horasAnteriores + horasNuevas) * 100) / 100;
        trabajadoresAgrupados[registro.trabajador].horasTotal = horasTotal;
        
        console.log(`➕ ${registro.trabajador}: ${horasAnteriores} + ${horasNuevas} = ${horasTotal}`);
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

// =============================================
// ENDPOINTS DE CONSULTAS (Solo superiores)
// =============================================

// Endpoint para obtener lista de trabajadores
app.get('/trabajadores', verifyJWT, async (req, res) => {
  try {
    console.log('📊 Obteniendo lista de trabajadores...');
    
    // Verificar rol (solo superiores)
    if (req.user.rol !== 'superior') {
      return res.status(403).json({ error: 'Acceso denegado: solo superiores pueden consultar trabajadores' });
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Leer todas las horas de la hoja "Horas"
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Horas!A:D'
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json([]);
    }

    // Extraer trabajadores únicos de la columna C (índice 2)
    const trabajadoresSet = new Set();
    
    rows.slice(1).forEach(row => {
      const trabajador = row[2]; // Columna C
      if (trabajador && trabajador.trim()) {
        trabajadoresSet.add(trabajador.trim());
      }
    });

    const trabajadores = Array.from(trabajadoresSet).sort();
    
    console.log(`✅ Encontrados ${trabajadores.length} trabajadores únicos:`, trabajadores);
    res.json(trabajadores);

  } catch (error) {
    console.error('❌ Error obteniendo trabajadores:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para consultar horas trabajadas por trabajador
app.post('/consultas/horas-trabajador', verifyJWT, async (req, res) => {
  try {
    const { trabajador, mes, año } = req.body;
    
    console.log(`📊 Consultando horas para trabajador: ${trabajador}, mes: ${mes}, año: ${año}`);
    
    // Verificar rol (solo superiores)
    if (req.user.rol !== 'superior') {
      return res.status(403).json({ error: 'Acceso denegado: solo superiores pueden realizar consultas' });
    }

    // Validar parámetros
    if (!trabajador || !mes || !año) {
      return res.status(400).json({ error: 'Faltan parámetros: trabajador, mes y año son requeridos' });
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Leer todas las tareas de la hoja "Trabajos" para obtener invernaderos
    const trabajosResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Trabajos!A:Z'
    });

    const trabajosRows = trabajosResponse.data.values || [];
    console.log(`📋 Encontradas ${trabajosRows.length} filas en hoja Trabajos`);

    // Crear mapa de ID tarea -> información completa (invernadero + tarea)
    const tareaInfoMap = new Map();
    if (trabajosRows.length > 1) {
      // Índices según nuevas cabeceras de hoja "Trabajos"
      // Código, Fecha, Encargado, Inver CCoste, Actividad, Genero, Descrip Actividad, Resultado, Horas, FechaFinReal, FechaLimite, JornalesEstimados, desarrollo_ha, dimension_total
      const tareaIdCol = 0;         // Columna A (Código)
      const invernaderoCol = 3;     // Columna D (Inver CCoste = Invernadero)
      const tipoTareaCol = 4;       // Columna E (Actividad = Tipo de Tarea)

      trabajosRows.slice(1).forEach(row => {
        const tareaId = row[tareaIdCol] || '';
        const invernadero = row[invernaderoCol] || '';
        const tipoTarea = row[tipoTareaCol] || '';

        if (tareaId) {
          // Guardar información completa de la tarea
          tareaInfoMap.set(tareaId.toString(), {
            invernadero: invernadero || 'No especificado',
            tipoTarea: tipoTarea || 'No especificada'
          });
        }
      });
    }

    console.log(`📋 Creado mapa de ID-tarea -> info completa con ${tareaInfoMap.size} entradas`);

    // Leer todas las horas de la hoja "Horas" incluyendo la columna Ranking (ID)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Horas!A:F' // A=Fecha, B=Grupo, C=Nombre, D=Tiempo, E=Ranking(ID), F=Empresa
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({
        trabajador,
        mes,
        año,
        totalHoras: 0,
        totalDias: 0,
        detalles: [],
        resumen: 'No se encontraron datos de horas para este trabajador'
      });
    }

    // Filtrar por trabajador y mes
    const detalles = [];
    let totalHoras = 0;
    
    rows.slice(1).forEach(row => {
      const fecha = row[0]; // Columna A
      const grupo = row[1]; // Columna B
      const trabajadorRow = row[2]; // Columna C
      const horas = parseFloat(row[3]) || 0; // Columna D
      const tareaId = row[4] || ''; // Columna E (Ranking/ID de tarea)
      const empresa = row[5]; // Columna F
      
      if (!fecha || !trabajadorRow || trabajadorRow.trim() !== trabajador || !tareaId) {
        return;
      }

      // Parsear fecha (asumiendo formato DD/MM/YYYY o similar)
      let fechaObj;
      try {
        // Intentar varios formatos de fecha
        if (fecha.includes('/')) {
          const partes = fecha.split('/');
          if (partes.length === 3) {
            // DD/MM/YYYY
            fechaObj = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
          }
        } else if (fecha.includes('-')) {
          // YYYY-MM-DD o DD-MM-YYYY
          fechaObj = new Date(fecha);
        } else {
          fechaObj = new Date(fecha);
        }
        
        if (isNaN(fechaObj.getTime())) {
          return;
        }
        
        // Verificar mes y año
        if (fechaObj.getMonth() + 1 === parseInt(mes) && fechaObj.getFullYear() === parseInt(año)) {
          totalHoras += horas;
          
          // Buscar información completa de la tarea usando el ID
          const tareaInfo = tareaInfoMap.get(tareaId.toString()) || { 
            invernadero: 'No especificado', 
            tipoTarea: 'No especificada' 
          };
          
          detalles.push({
            fecha: fecha,
            horas: horas,
            encargado: grupo || 'No especificado', // Columna B = Encargado/Grupo
            tarea: tareaInfo.tipoTarea, // Tarea real desde hoja Trabajos
            invernadero: tareaInfo.invernadero
          });
        }
      } catch (error) {
        console.warn(`⚠️ Error parseando fecha: ${fecha}`, error);
      }
    });

    // Ordenar detalles por fecha
    detalles.sort((a, b) => {
      const fechaA = new Date(a.fecha.split('/').reverse().join('-'));
      const fechaB = new Date(b.fecha.split('/').reverse().join('-'));
      return fechaA - fechaB;
    });

    // Agrupar detalles por fecha
    const detallesAgrupados = [];
    const fechasMap = new Map();

    detalles.forEach(detalle => {
      const fecha = detalle.fecha;
      if (!fechasMap.has(fecha)) {
        fechasMap.set(fecha, {
          fecha: fecha,
          totalHorasDia: 0,
          registros: []
        });
      }
      
      const diaInfo = fechasMap.get(fecha);
      diaInfo.totalHorasDia += detalle.horas;
      diaInfo.registros.push({
        horas: detalle.horas,
        encargado: detalle.encargado,
        tarea: detalle.tarea,
        invernadero: detalle.invernadero
      });
    });

    // Convertir el mapa a array y redondear totales
    fechasMap.forEach((diaInfo, fecha) => {
      diaInfo.totalHorasDia = Math.round(diaInfo.totalHorasDia * 100) / 100;
      detallesAgrupados.push(diaInfo);
    });

    const resultado = {
      trabajador,
      mes: parseInt(mes),
      año: parseInt(año),
      totalHoras: Math.round(totalHoras * 100) / 100, // Redondear a 2 decimales
      totalDias: detallesAgrupados.length,
      detalles: detalles, // Mantener detalles planos para compatibilidad
      detallesAgrupados: detallesAgrupados, // Nueva estructura agrupada
      resumen: detallesAgrupados.length > 0 
        ? `${trabajador} trabajó ${totalHoras} horas en ${detallesAgrupados.length} días durante ${mes}/${año}`
        : `No se encontraron horas registradas para ${trabajador} en ${mes}/${año}`
    };

    console.log(`✅ Consulta completada: ${resultado.totalHoras} horas en ${resultado.totalDias} días`);
    res.json(resultado);

  } catch (error) {
    console.error('❌ Error en consulta de horas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para consultar horas por tarea e invernadero
app.post('/consultas/horas-tarea', verifyJWT, async (req, res) => {
  try {
    const { tipoTarea, invernadero, mes, año } = req.body;
    
    console.log(`📊 Consultando horas para tarea: ${tipoTarea}, invernadero: ${invernadero}, mes: ${mes}, año: ${año}`);
    
    // Verificar rol (solo superiores)
    if (req.user.rol !== 'superior') {
      return res.status(403).json({ error: 'Acceso denegado: solo superiores pueden realizar consultas' });
    }

    // Validar parámetros
    if (!tipoTarea || !invernadero || !mes || !año) {
      return res.status(400).json({ error: 'Faltan parámetros: tipoTarea, invernadero, mes y año son requeridos' });
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Leer todas las tareas de la hoja "Trabajos"
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Trabajos!A:Z' // Leer todas las columnas necesarias
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({
        tipoTarea,
        invernadero,
        mes,
        año,
        totalHoras: 0,
        totalTareas: 0,
        detalles: [],
        resumen: 'No se encontraron datos de trabajos para esta consulta'
      });
    }

    // Obtener headers para identificar columnas
    const headers = rows[0] || [];
    console.log('📋 Headers encontrados en hoja Trabajos:', headers);
    
    // Usar índices según nuevas cabeceras de hoja "Trabajos"
    // Código, Fecha, Encargado, Inver CCoste, Actividad, Genero, Descrip Actividad, Resultado, Horas, FechaFinReal, FechaLimite, JornalesEstimados, desarrollo_ha, dimension_total
    const tareaIdCol = 0;         // Columna A (Código)
    const fechaCol = 1;           // Columna B (Fecha)
    const encargadoCol = 2;       // Columna C (Encargado)
    const invernaderoCol = 3;     // Columna D (Inver CCoste = Invernadero)
    const tipoTareaCol = 4;       // Columna E (Actividad = TipoTarea)
    const generoCol = 5;          // Columna F (Genero)
    const descripcionCol = 6;     // Columna G (Descrip Actividad = Descripción)
    const resultadoCol = 7;       // Columna H (Resultado)
    const horasCol = 8;           // Columna I (Horas)

    console.log(`📋 Columnas según nuevas cabeceras - TareaID: ${tareaIdCol}(A), Fecha: ${fechaCol}(B), Encargado: ${encargadoCol}(C), Invernadero: ${invernaderoCol}(D), TipoTarea: ${tipoTareaCol}(E), Genero: ${generoCol}(F), Descripción: ${descripcionCol}(G), Resultado: ${resultadoCol}(H), Horas: ${horasCol}(I)`);
    console.log(`📋 Headers en posiciones:
    - A(${tareaIdCol}): ${headers[tareaIdCol] || 'vacío'}
    - B(${fechaCol}): ${headers[fechaCol] || 'vacío'}
    - C(${encargadoCol}): ${headers[encargadoCol] || 'vacío'}
    - D(${invernaderoCol}): ${headers[invernaderoCol] || 'vacío'}  
    - E(${tipoTareaCol}): ${headers[tipoTareaCol] || 'vacío'}
    - F(${generoCol}): ${headers[generoCol] || 'vacío'}
    - G(${descripcionCol}): ${headers[descripcionCol] || 'vacío'}
    - H(${resultadoCol}): ${headers[resultadoCol] || 'vacío'}
    - I(${horasCol}): ${headers[horasCol] || 'vacío'}`);
    
    // Verificar que hay suficientes columnas (necesitamos al menos 9 para columna I)
    if (headers.length < 9) {
      console.log('❌ Error: La hoja Trabajos no tiene suficientes columnas (mínimo 9 esperadas)');
      console.log('📋 Headers disponibles:', headers);
      return res.status(500).json({ error: 'La hoja Trabajos no tiene la estructura esperada (faltan columnas)' });
    }

    // Filtrar por tipo de tarea, invernadero y mes
    const detalles = [];
    let totalHoras = 0;
    let totalTareas = 0;
    
    rows.slice(1).forEach((row, index) => {
      const tareaId = row[tareaIdCol] || '';
      const fecha = row[fechaCol] || '';
      const horas = parseFloat(row[horasCol]) || 0;
      const tipoTareaRow = (row[tipoTareaCol] || '').trim();
      const invernaderoRow = (row[invernaderoCol] || '').trim();
      const encargado = row[encargadoCol] || '';
      const descripcion = row[descripcionCol] || '';
      const resultado = row[resultadoCol] || '';
      const genero = row[generoCol] || '';
      
      if (!fecha || !tipoTareaRow || !invernaderoRow) {
        return;
      }

      // Verificar si coincide el tipo de tarea (búsqueda flexible con múltiples tareas)
      let coincideTipoTarea = false;
      
      if (tipoTarea.includes(',')) {
        // Múltiples tareas separadas por coma
        const tareasList = tipoTarea.split(',').map(t => t.trim().toLowerCase());
        coincideTipoTarea = tareasList.some(tarea => 
          tipoTareaRow.toLowerCase().includes(tarea) || tarea.includes(tipoTareaRow.toLowerCase())
        );
      } else {
        // Una sola tarea
        coincideTipoTarea = tipoTareaRow.toLowerCase().includes(tipoTarea.toLowerCase()) || 
                           tipoTarea.toLowerCase().includes(tipoTareaRow.toLowerCase());
      }

      // Verificar invernadero (puede ser específico, varios o "todos")
      let coincideInvernadero = false;
      if (invernadero === 'todos' || invernadero === 'TODOS') {
        coincideInvernadero = true;
      } else if (invernadero.includes(',')) {
        // Múltiples invernaderos separados por coma
        const invernaderosList = invernadero.split(',').map(i => i.trim().toLowerCase());
        coincideInvernadero = invernaderosList.some(inv => 
          invernaderoRow.toLowerCase().includes(inv) || inv.includes(invernaderoRow.toLowerCase())
        );
      } else {
        // Invernadero específico
        coincideInvernadero = invernaderoRow.toLowerCase().includes(invernadero.toLowerCase()) ||
                             invernadero.toLowerCase().includes(invernaderoRow.toLowerCase());
      }

      if (!coincideTipoTarea || !coincideInvernadero) {
        return;
      }

      // Parsear fecha
      let fechaObj;
      try {
        if (fecha.includes('/')) {
          const partes = fecha.split('/');
          if (partes.length === 3) {
            // DD/MM/YYYY
            fechaObj = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
          }
        } else if (fecha.includes('-')) {
          fechaObj = new Date(fecha);
        } else {
          fechaObj = new Date(fecha);
        }
        
        if (isNaN(fechaObj.getTime())) {
          return;
        }
        
        // Verificar mes y año
        if (fechaObj.getMonth() + 1 === parseInt(mes) && fechaObj.getFullYear() === parseInt(año)) {
          totalHoras += horas;
          totalTareas++;
          detalles.push({
            tareaId: tareaId,
            fecha: fecha,
            horas: horas,
            tipoTarea: tipoTareaRow,
            invernadero: invernaderoRow,
            encargado: encargado,           // Columna C - Nombre del encargado
            descripcion: descripcion,
            progreso: resultado,            // Columna H - Progreso/Estado de la tarea (antes "resultado")
            genero: genero,
            fila: index + 2 // +2 porque empezamos desde slice(1) y las filas están 1-indexed
          });
        }
      } catch (error) {
        console.warn(`⚠️ Error parseando fecha en fila ${index + 2}: ${fecha}`, error);
      }
    });

    // Ordenar detalles por fecha
    detalles.sort((a, b) => {
      const fechaA = new Date(a.fecha.split('/').reverse().join('-'));
      const fechaB = new Date(b.fecha.split('/').reverse().join('-'));
      return fechaA - fechaB;
    });

    const resultado = {
      tipoTarea,
      invernadero,
      mes: parseInt(mes),
      ano: parseInt(año),
      totalHoras: Math.round(totalHoras * 100) / 100,
      totalTareas,
      detalles,
      resumen: detalles.length > 0 
        ? `Se encontraron ${totalTareas} tareas de "${tipoTarea}" en "${invernadero}" con un total de ${totalHoras} horas durante ${mes}/${año}`
        : `No se encontraron tareas de "${tipoTarea}" en "${invernadero}" durante ${mes}/${año}`
    };

    console.log(`✅ Consulta de horas por tarea completada: ${resultado.totalHoras} horas en ${resultado.totalTareas} tareas`);
    res.json(resultado);

  } catch (error) {
    console.error('❌ Error en consulta de horas por tarea:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener tipos de tarea disponibles
app.get('/tipos-tarea', verifyJWT, async (req, res) => {
  try {
    console.log(`📋 Obteniendo tipos de tarea disponibles`);
    
    // Verificar rol (solo superiores)
    if (req.user.rol !== 'superior') {
      return res.status(403).json({ error: 'Acceso denegado: solo superiores pueden acceder a esta información' });
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Leer la hoja "Trabajos" para obtener tipos únicos
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Trabajos!A:Z'
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json([]);
    }

    // Obtener headers para identificar columna de tipo de tarea
    const headers = rows[0] || [];
    const tipoTareaCol = headers.findIndex(h => h && (h.toLowerCase().includes('tipo') || h.toLowerCase().includes('tarea')));

    if (tipoTareaCol === -1) {
      return res.status(500).json({ error: 'No se pudo identificar la columna de tipo de tarea' });
    }

    // Extraer tipos únicos
    const tiposSet = new Set();
    rows.slice(1).forEach(row => {
      const tipo = (row[tipoTareaCol] || '').trim();
      if (tipo && tipo !== '') {
        tiposSet.add(tipo);
      }
    });

    const tipos = Array.from(tiposSet).sort();
    console.log(`✅ Encontrados ${tipos.length} tipos de tarea únicos`);
    res.json(tipos);

  } catch (error) {
    console.error('❌ Error obteniendo tipos de tarea:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on 0.0.0.0:${PORT}`);
  console.log(`🛡️ JWT Authentication: ENABLED (24h tokens)`);
  console.log(`🛡️  Protected endpoints: /tasks (POST), /tasks/:id/* (POST)`);
  console.log(`🔍 Health check disponible en:`);
  console.log(`   - Localmente: http://localhost:${PORT}/health`);
  console.log(`   - Desde la red: http://192.168.0.101:${PORT}/health`);
  console.log(`📡 Endpoints principales:`);
  console.log(`   - POST /login - Autenticación con JWT`);
  console.log(`   - POST /verify-token - Verificar token válido`);
  console.log(`   - GET /tasks - Obtener tareas (opcional JWT)`);
  console.log(`   - POST /tasks - Crear/actualizar tareas (requiere JWT)`);
  console.log(`   - POST /tasks/:id/accept - Aceptar tarea + validar horas automáticamente`);
  console.log(`   - POST /tasks/:id/complete - Completar tarea + validar horas automáticamente`);
  console.log(`   - POST /tasks/:id/complete-direct - Completar directo + validar horas automáticamente`);
  console.log(`📊 FUNCIONALIDAD FUSIONADA: Validación automática de horas integrada`);
  console.log(`   - Hoja "Horas" renombrada a "Horas_PorValidar" con columna G para estado de validación`);
  console.log(`   - Al aceptar/completar tareas se validan automáticamente las horas relacionadas`);
  console.log(`   - Workflow unificado: Validación de tareas + validación de horas en una sola operación`);
  
  // DEBUG: Verificar que el servidor realmente está respondiendo
  console.log(`🔧 DEBUG: Servidor iniciado exitosamente en puerto ${PORT}`);
  
  // Test inmediato del endpoint health
  setTimeout(() => {
    console.log(`🔧 DEBUG: Test interno del servidor después de 2 segundos...`);
  }, 2000);
});

// ===========================================
// ENDPOINTS PARA SISTEMA TÉCNICO
// ===========================================

// Obtener cabezales del usuario técnico
app.get('/technician/user-cabezales/:userId', verifyJWT, async (req, res) => {
  const { userId } = req.params;
  console.log('🔧 GET /technician/user-cabezales - Usuario:', userId);

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Leer usuarios técnicos
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'usuarios',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ success: false, error: 'No hay usuarios técnicos' });
    }

    const headers = rows[0];
    const idxId = headers.findIndex(h => h.toLowerCase() === 'id');
    const idxCabezal = headers.findIndex(h => h.toLowerCase() === 'cabezal');

    if (idxId === -1 || idxCabezal === -1) {
      return res.json({ success: false, error: 'Faltan columnas en usuarios técnicos' });
    }

    // Buscar usuario
    const userRow = rows.slice(1).find(row => String(row[idxId]) === String(userId));
    if (!userRow) {
      return res.json({ success: false, error: 'Usuario técnico no encontrado' });
    }

    // Obtener cabezales (pueden estar separados por ;)
    const cabezalesStr = userRow[idxCabezal] || '';
    const cabezales = cabezalesStr.split(';').map(c => c.trim()).filter(c => c);

    console.log('✅ Cabezales del usuario técnico:', cabezales);
    res.json({ success: true, cabezales });

  } catch (error) {
    console.error('❌ Error obteniendo cabezales del usuario técnico:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener invernaderos filtrados por cabezales del usuario
app.get('/technician/invernaderos/:userId', verifyJWT, async (req, res) => {
  const { userId } = req.params;
  console.log('🔧 GET /technician/invernaderos - Usuario:', userId);

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Primero obtener cabezales del usuario
    const userResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'usuarios',
    });

    const userRows = userResponse.data.values;
    if (!userRows || userRows.length === 0) {
      return res.json({ success: false, error: 'No hay usuarios técnicos' });
    }

    const userHeaders = userRows[0];
    const idxUserId = userHeaders.findIndex(h => h.toLowerCase() === 'id');
    const idxUserCabezal = userHeaders.findIndex(h => h.toLowerCase() === 'cabezal');

    const userRow = userRows.slice(1).find(row => String(row[idxUserId]) === String(userId));
    if (!userRow) {
      return res.json({ success: false, error: 'Usuario técnico no encontrado' });
    }

    const userCabezalesStr = userRow[idxUserCabezal] || '';
    const userCabezales = userCabezalesStr.split(';').map(c => c.trim()).filter(c => c);

    // Obtener invernaderos
    const invResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'Invernaderos',
    });

    const invRows = invResponse.data.values;
    if (!invRows || invRows.length === 0) {
      return res.json({ success: false, error: 'No hay invernaderos' });
    }

    // Estructura de columnas: A = Invernadero (índice 0), B = Cabezal (índice 1)
    const idxNombre = 0; // Columna A
    const idxCabezal = 1; // Columna B

    // Filtrar invernaderos por cabezales del usuario
    const groupedInvernaderos = [];
    
    console.log(`🔍 Cabezales del usuario ${userId}:`, userCabezales);
    
    userCabezales.forEach(cabezal => {
      const invernaderosCabezal = invRows.slice(1)
        .filter(row => row[idxCabezal] === cabezal)
        .map(row => ({ nombre: row[idxNombre] }));
      
      console.log(`📋 Cabezal "${cabezal}" tiene ${invernaderosCabezal.length} invernaderos`);
      
      if (invernaderosCabezal.length > 0) {
        groupedInvernaderos.push({
          cabezal: cabezal,
          invernaderos: invernaderosCabezal
        });
      }
    });

    console.log('✅ Invernaderos agrupados:', groupedInvernaderos);
    res.json({ success: true, invernaderos: groupedInvernaderos });

  } catch (error) {
    console.error('❌ Error obteniendo invernaderos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener estados de planta agrupados
app.get('/technician/estados-planta', verifyJWT, async (req, res) => {
  console.log('🔧 GET /technician/estados-planta');

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'estado_Planta',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ success: false, error: 'No hay estados de planta' });
    }

    const headers = rows[0];
    const idxTipo = headers.findIndex(h => h.toLowerCase() === 'tipo_estado');
    const idxSubtipo = headers.findIndex(h => h.toLowerCase() === 'subtipo_estado');
    const idxNombre = headers.findIndex(h => h.toLowerCase() === 'nombre_estado');

    // Agrupar por tipo_estado
    const grouped = {};
    rows.slice(1).forEach(row => {
      const tipo = row[idxTipo] || 'Sin Tipo';
      const subtipo = row[idxSubtipo] || '';
      const nombre = row[idxNombre] || '';

      if (!grouped[tipo]) {
        grouped[tipo] = [];
      }

      grouped[tipo].push({
        tipo_estado: tipo,
        subtipo_estado: subtipo,
        nombre_estado: nombre
      });
    });

    const groupedArray = Object.keys(grouped).map(tipo => ({
      tipo: tipo,
      estados: grouped[tipo]
    }));

    console.log('✅ Estados de planta agrupados:', groupedArray);
    res.json({ success: true, estados: groupedArray });

  } catch (error) {
    console.error('❌ Error obteniendo estados de planta:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener estados de género agrupados
app.get('/technician/estados-genero', verifyJWT, async (req, res) => {
  console.log('🔧 GET /technician/estados-genero');

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'estado_Genero',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ success: false, error: 'No hay estados de género' });
    }

    const headers = rows[0];
    const idxTipo = headers.findIndex(h => h.toLowerCase() === 'tipo_estado');
    const idxSubtipo = headers.findIndex(h => h.toLowerCase() === 'subtipo_estado');
    const idxNombre = headers.findIndex(h => h.toLowerCase() === 'nombre_estado');

    // Agrupar por tipo_estado
    const grouped = {};
    rows.slice(1).forEach(row => {
      const tipo = row[idxTipo] || 'Sin Tipo';
      const subtipo = row[idxSubtipo] || '';
      const nombre = row[idxNombre] || '';

      if (!grouped[tipo]) {
        grouped[tipo] = [];
      }

      grouped[tipo].push({
        tipo_estado: tipo,
        subtipo_estado: subtipo,
        nombre_estado: nombre
      });
    });

    const groupedArray = Object.keys(grouped).map(tipo => ({
      tipo: tipo,
      estados: grouped[tipo]
    }));

    console.log('✅ Estados de género agrupados:', groupedArray);
    res.json({ success: true, estados: groupedArray });

  } catch (error) {
    console.error('❌ Error obteniendo estados de género:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener géneros
app.get('/technician/generos', verifyJWT, async (req, res) => {
  console.log('🔧 GET /technician/generos');

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'Generos',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ success: false, error: 'No hay géneros' });
    }

    const headers = rows[0];
    const idxGenero = headers.findIndex(h => h.toLowerCase() === 'genero');

    const generos = rows.slice(1)
      .map(row => row[idxGenero])
      .filter(genero => genero && genero.trim())
      .map(genero => genero.trim());

    console.log('✅ Géneros obtenidos:', generos);
    res.json({ success: true, generos });

  } catch (error) {
    console.error('❌ Error obteniendo géneros:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Crear informe técnico
app.post('/technician/create-report', verifyJWT, async (req, res) => {
  console.log('🔧 POST /technician/create-report');
  console.log('📦 Datos del informe:', req.body);

  const {
    invernadero,
    estadoPlanta,
    porcentajePlanta,
    genero,
    estadoGenero,
    porcentajeGenero,
    fechaMax,
    descripcion,
    nombre_encargado
  } = req.body;

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Generar código único
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const codigo = `TEC-${timestamp}-${random}`;

    // Formatear fecha actual en formato europeo
    const fechaCreacion = formatDateToEuropean(now);

    // Preparar fila para insertar
    const newRow = [
      codigo,
      fechaCreacion,
      nombre_encargado,
      invernadero,  // Invernadero sin prefijo
      genero,
      estadoPlanta,
      porcentajePlanta,
      estadoGenero,
      porcentajeGenero,
      fechaMax,
      descripcion || ''
    ];

    // Insertar en la hoja estudio_Tecnico
    await sheets.spreadsheets.values.append({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'estudio_Tecnico',
      valueInputOption: 'RAW',
      resource: {
        values: [newRow]
      }
    });

    console.log('✅ Informe técnico creado exitosamente:', codigo);
    res.json({ 
      success: true, 
      message: 'Informe creado exitosamente',
      codigo: codigo
    });

  } catch (error) {
    console.error('❌ Error creando informe técnico:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para crear informe de encargado
app.post('/technician/create-manager-report', verifyJWT, async (req, res) => {
  try {
    console.log('👔 POST /technician/create-manager-report');
    console.log('📋 Datos recibidos:', req.body);

    const { invernadero, genero, kgTotales, intervalos, necesidadCogida, razonCogida, descripcion, nombre_encargado } = req.body;

    // Validaciones
    if (!invernadero || !genero || !kgTotales || kgTotales <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios o KG totales inválido' 
      });
    }

    // Validar intervalos si existen
    if (intervalos && intervalos.length > 0) {
      const totalKgIntervalos = intervalos.reduce((sum, interval) => sum + (interval.kg || 0), 0);
      if (Math.abs(totalKgIntervalos - kgTotales) > 0.01) { // Tolerancia de 1 centésimo
        return res.status(400).json({
          success: false,
          error: `Los KG de intervalos (${totalKgIntervalos}) no coinciden con el total (${kgTotales})`
        });
      }
    }

    // Configurar autenticación
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Generar código único para el informe
    const fecha = new Date();
    const fechaFormateada = getCurrentEuropeanDate();
    const codigo = `ENC-COG-${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Formatear intervalos según el formato requerido
    let intervalokgFormatted = '';
    let kgintervaloFormatted = '';
    
    if (intervalos && intervalos.length > 0) {
      // Crear arrays para intervalos y sus KG
      const intervalRanges = [];
      const intervalKgs = [];
      
      intervalos.forEach(interval => {
        intervalRanges.push(`${interval.rangeStart}-${interval.rangeEnd}`);
        intervalKgs.push(interval.kg.toString());
      });
      
      intervalokgFormatted = intervalRanges.join(';');
      kgintervaloFormatted = intervalKgs.join(';');
    }

    // Preparar fila según las cabeceras: codigo, fecha, nombre_encargado, invernadero, genero, kilos, intervalokg, kgintervalo, necesidadcogida, razoncogida, descripcion
    const nuevaFila = [
      codigo,                                    // A: codigo
      fechaFormateada,                          // B: fecha
      nombre_encargado || 'Desconocido',        // C: nombre_encargado
      invernadero,                              // D: invernadero
      genero,                                   // E: genero
      kgTotales,                               // F: kilos
      intervalokgFormatted,                    // G: intervalokg (0-6;7-10)
      kgintervaloFormatted,                    // H: kgintervalo (1000;500)
      necesidadCogida ? 1 : 0,                 // I: necesidadcogida (0 o 1)
      razonCogida || '',                       // J: razoncogida
      descripcion || ''                        // K: descripcion
    ];

    console.log('📝 Guardando en hoja "estudio_Cogida":', nuevaFila);

    // Insertar en la hoja estudio_Cogida del spreadsheet SeguimientoEstadoFruta
    await sheets.spreadsheets.values.append({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'estudio_Cogida',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [nuevaFila]
      }
    });

    console.log('✅ Informe de encargado de cogida creado exitosamente');
    
    res.json({ 
      success: true, 
      message: 'Informe de encargado de cogida creado exitosamente',
      codigo: codigo
    });

  } catch (error) {
    console.error('❌ Error procesando informe de encargado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener datos de analytics 
app.post('/technician/analytics', verifyJWT, async (req, res) => {
  try {
    console.log('📊 Obteniendo datos de analytics...');
    
    const { invernaderos } = req.body;
    
    console.log('🔍 Invernaderos seleccionados:', invernaderos);
    
    if (!invernaderos || !Array.isArray(invernaderos) || invernaderos.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere al menos un invernadero seleccionado' 
      });
    }

    // Configurar autenticación usando la función existente
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Obtener datos de la hoja estudio_Tecnico
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'estudio_Tecnico'
    });

    const rows = response.data.values || [];
    
    console.log(`📋 Total de filas encontradas: ${rows.length}`);
    
    if (rows.length <= 1) {
      console.log('⚠️ No hay datos en la hoja estudio_Tecnico');
      return res.json({ 
        success: true, 
        data: [], 
        message: 'No hay datos disponibles para analytics' 
      });
    }

    // Procesar los datos para analytics
    const analyticsData = [];
    const headers = rows[0];
    
    console.log('📊 Headers encontrados:', headers);
    
    // Encontrar índices de las columnas según la estructura especificada
    // Columna D (índice 3): Invernadero
    // Columna B (índice 1): Fecha
    // Columna F (índice 5): Estado Planta
    // Columna G (índice 6): Porcentaje Planta
    // Columna H (índice 7): Estado Genero
    // Columna I (índice 8): Porcentaje Genero
    // Columna J (índice 9): Fecha Máxima
    const invernaderoIndex = 3; // Columna D
    const fechaIndex = 1; // Columna B
    const estadoPlantaIndex = 5; // Columna F
    const porcentajePlantaIndex = 6; // Columna G
    const estadoGeneroIndex = 7; // Columna H
    const porcentajeGeneroIndex = 8; // Columna I
    const fechaMaxIndex = 9; // Columna J

    // Procesar datos de filas (comenzar desde fila 1, saltando headers)
    console.log(`🔄 Procesando ${rows.length - 1} filas de datos...`);
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const invernadero = row[invernaderoIndex];
      const fecha = row[fechaIndex];
      
      console.log(`📝 Fila ${i}: Invernadero="${invernadero}", Fecha="${fecha}"`);
      
      // Filtrar por invernaderos seleccionados
      if (invernaderos.includes(invernadero)) {
        console.log(`✅ Invernadero "${invernadero}" coincide con selección`);
        // Agregar datos de estado de planta (Columnas F y G) - SOPORTE MULTISELECT
        const estadoPlanta = row[estadoPlantaIndex];
        const porcentajePlanta = row[porcentajePlantaIndex];
        
        console.log(`🌱 Estado Planta: "${estadoPlanta}", Porcentaje: "${porcentajePlanta}"`);
        
        if (estadoPlanta && porcentajePlanta) {
          // Verificar si hay múltiples estados separados por ";"
          const estadosRaw = estadoPlanta.toString().split(';');
          const porcentajesRaw = porcentajePlanta.toString().split(';');
          
          console.log(`🔍 Estados RAW (antes de filtrar):`, estadosRaw);
          console.log(`🔍 Porcentajes RAW (antes de filtrar):`, porcentajesRaw);
          
          const estados = estadosRaw.map(s => s.trim()).filter(s => s);
          const porcentajes = porcentajesRaw.map(s => s.trim());
          
          console.log(`🔄 Estados FILTRADOS:`, estados);
          console.log(`🔄 Porcentajes FILTRADOS:`, porcentajes);
          console.log(`📊 Total estados: ${estados.length}, Total porcentajes: ${porcentajes.length}`);
          
          // Crear una entrada por cada estado (manteniendo correspondencia por posición)
          for (let j = 0; j < estados.length; j++) {
            const estado = estados[j];
            const porcentaje = porcentajes[j] || '0'; // Si no hay porcentaje correspondiente, usar 0
            
            console.log(`🔍 Procesando estado ${j + 1}: "${estado}" con porcentaje "${porcentaje}"`);
            
            if (estado) { // Solo procesar si el estado no está vacío
              const dataPlanta = {
                Invernadero: invernadero,
                Fecha: fecha,
                Estado: `${estado} (Planta)`, // 🔧 AGREGAR SUFIJO PARA DIFERENCIAR
                Porcentaje: parseFloat(porcentaje) || 0,
                Tipo: 'Planta'
              };
              analyticsData.push(dataPlanta);
              console.log(`✅ Agregado dato de planta ${j + 1}/${estados.length}:`, dataPlanta);
            } else {
              console.log(`⚠️ Estado ${j + 1} está vacío, omitiendo...`);
            }
          }
        }
        
        // Agregar datos de estado de género (Columnas H e I) - SOPORTE MULTISELECT
        const estadoGenero = row[estadoGeneroIndex];
        const porcentajeGenero = row[porcentajeGeneroIndex];
        
        console.log(`🧬 Estado Género: "${estadoGenero}", Porcentaje: "${porcentajeGenero}"`);
        
        if (estadoGenero && porcentajeGenero) {
          // Verificar si hay múltiples estados separados por ";"
          const estadosRaw = estadoGenero.toString().split(';');
          const porcentajesRaw = porcentajeGenero.toString().split(';');
          
          console.log(`🔍 Estados GÉNERO RAW (antes de filtrar):`, estadosRaw);
          console.log(`🔍 Porcentajes GÉNERO RAW (antes de filtrar):`, porcentajesRaw);
          
          const estados = estadosRaw.map(s => s.trim()).filter(s => s);
          const porcentajes = porcentajesRaw.map(s => s.trim());
          
          console.log(`🔄 Estados GÉNERO FILTRADOS:`, estados);
          console.log(`🔄 Porcentajes GÉNERO FILTRADOS:`, porcentajes);
          console.log(`📊 Total estados género: ${estados.length}, Total porcentajes género: ${porcentajes.length}`);
          
          // Crear una entrada por cada estado (manteniendo correspondencia por posición)
          for (let j = 0; j < estados.length; j++) {
            const estado = estados[j];
            const porcentaje = porcentajes[j] || '0'; // Si no hay porcentaje correspondiente, usar 0
            
            console.log(`🔍 Procesando estado género ${j + 1}: "${estado}" con porcentaje "${porcentaje}"`);
            
            if (estado) { // Solo procesar si el estado no está vacío
              const dataGenero = {
                Invernadero: invernadero,
                Fecha: fecha,
                Estado: `${estado} (Género)`, // 🔧 AGREGAR SUFIJO PARA DIFERENCIAR
                Porcentaje: parseFloat(porcentaje) || 0,
                Tipo: 'Genero'
              };
              analyticsData.push(dataGenero);
              console.log(`✅ Agregado dato de género ${j + 1}/${estados.length}:`, dataGenero);
            } else {
              console.log(`⚠️ Estado género ${j + 1} está vacío, omitiendo...`);
            }
          }
        }
      } else {
        console.log(`❌ Invernadero "${invernadero}" NO coincide con selección:`, invernaderos);
      }
    }

    // Recopilar fechas máximas por invernadero (última fecha registrada para cada uno)
    const fechasMaximas = {};
    
    // Agrupar por invernadero y encontrar la última fecha máxima
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const invernadero = row[invernaderoIndex];
      const fechaReporte = row[fechaIndex];
      const fechaMax = row[fechaMaxIndex];
      
      if (invernaderos.includes(invernadero) && fechaMax) {
        console.log(`📅 Procesando fechaMax para ${invernadero}: ${fechaMax} (reporte del ${fechaReporte})`);
        
        // Convertir fecha del reporte a objeto Date para comparación
        const fechaReporteObj = parseDateFromString(fechaReporte);
        
        if (!fechasMaximas[invernadero] || 
            fechaReporteObj > parseDateFromString(fechasMaximas[invernadero].fechaReporte)) {
          fechasMaximas[invernadero] = {
            fechaMax: fechaMax,
            fechaReporte: fechaReporte
          };
        }
      }
    }
    
    console.log('📅 Fechas máximas por invernadero:', fechasMaximas);
    
    // Información adicional para debugging
    const uniqueInvernaderos = [...new Set(rows.slice(1).map(row => row[invernaderoIndex]).filter(inv => inv))];
    console.log('🏠 Invernaderos únicos encontrados en estudio_Tecnico:', uniqueInvernaderos);
    
    console.log(`✅ Analytics data obtenidos: ${analyticsData.length} registros`);
    res.json({ 
      success: true, 
      data: analyticsData,
      fechasMaximas: fechasMaximas,
      debug: {
        totalRows: rows.length - 1,
        uniqueInvernaderos: uniqueInvernaderos,
        selectedInvernaderos: invernaderos,
        processedRecords: analyticsData.length
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo datos de analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener lista de invernaderos (sin userId para analytics)
app.get('/technician/invernaderos', verifyJWT, async (req, res) => {
  try {
    console.log('🏠 Obteniendo lista de invernaderos para analytics...');

    // Configurar autenticación usando la función existente
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Obtener datos de invernaderos desde la hoja "Invernaderos"
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'Invernaderos'
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return res.json({ success: true, data: [] });
    }

    // Estructura corregida: Columna A (índice 0) = Invernadero, Columna B (índice 1) = Cabezal
    const groupedData = {};
    
    console.log(`📊 Procesando ${rows.length - 1} filas de invernaderos...`);
    
    // Procesar filas (saltando header en índice 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const invernadero = row[0]; // Columna A: Invernadero
      const cabezal = row[1]; // Columna B: Cabezal
      
      if (invernadero && cabezal) {
        if (!groupedData[cabezal]) {
          groupedData[cabezal] = [];
        }
        groupedData[cabezal].push({ nombre: invernadero });
        console.log(`✅ Agregado: ${invernadero} → ${cabezal}`);
      }
    }
    
    // Convertir a array de objetos agrupados
    const invernaderos = Object.keys(groupedData).map(cabezal => ({
      cabezal: cabezal,
      invernaderos: groupedData[cabezal]
    }));
    
    console.log(`🏠 Grupos de invernaderos creados:`, invernaderos.map(g => `${g.cabezal} (${g.invernaderos.length})`));

    console.log(`✅ Invernaderos encontrados: ${invernaderos.length}`);
    res.json({ success: true, data: invernaderos });

  } catch (error) {
    console.error('❌ Error obteniendo invernaderos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para consultar informes de cogida por invernadero
app.post('/technician/cogida-reports', verifyJWT, async (req, res) => {
  try {
    console.log('🔍 POST /technician/cogida-reports');
    console.log('📋 Datos recibidos:', req.body);

    const { invernadero } = req.body;

    if (!invernadero) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invernadero es requerido' 
      });
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Obtener datos de la hoja estudio_Cogida
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TECHNICIAN_SPREADSHEET_ID,
      range: 'estudio_Cogida'
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.log('📭 No se encontraron datos en estudio_Cogida');
      return res.json({ 
        success: true, 
        reports: [],
        message: 'No hay informes registrados' 
      });
    }

    // Las cabeceras deberían ser: codigo, fecha, nombre_encargado, invernadero, genero, kilos, intervalokg, kgintervalo, necesidadcogida, razoncogida, descripcion
    const headers = rows[0];
    console.log('📋 Cabeceras encontradas:', headers);

    const codigoIndex = headers.findIndex(h => h && h.toLowerCase().includes('codigo'));
    const fechaIndex = headers.findIndex(h => h && h.toLowerCase().includes('fecha'));
    const nombreEncargadoIndex = headers.findIndex(h => h && h.toLowerCase().includes('nombre_encargado'));
    const invernaderoIndex = headers.findIndex(h => h && h.toLowerCase().includes('invernadero'));
    const generoIndex = headers.findIndex(h => h && h.toLowerCase().includes('genero'));
    const kilosIndex = headers.findIndex(h => h && h.toLowerCase().includes('kilos'));
    const intervalokgIndex = headers.findIndex(h => h && h.toLowerCase().includes('intervalokg'));
    const kgintervaloIndex = headers.findIndex(h => h && h.toLowerCase().includes('kgintervalo'));
    const necesidadcogidaIndex = headers.findIndex(h => h && h.toLowerCase().includes('necesidadcogida'));
    const razoncogidaIndex = headers.findIndex(h => h && h.toLowerCase().includes('razoncogida'));
    const descripcionIndex = headers.findIndex(h => h && h.toLowerCase().includes('descripcion'));

    console.log('📊 Índices de columnas:', {
      codigoIndex,
      fechaIndex,
      nombreEncargadoIndex,
      invernaderoIndex,
      generoIndex,
      kilosIndex,
      intervalokgIndex,
      kgintervaloIndex,
      necesidadcogidaIndex,
      razoncogidaIndex,
      descripcionIndex
    });

    // Filtrar por invernadero y crear objetos de informes
    const reports = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowInvernadero = row[invernaderoIndex];
      
      // Comparar invernadero (remover posibles comillas simples del almacenamiento)
      const cleanRowInvernadero = rowInvernadero ? rowInvernadero.replace(/^'/, '') : '';
      
      console.log(`🔍 Comparando: "${cleanRowInvernadero}" con "${invernadero}"`);
      
      if (cleanRowInvernadero === invernadero) {
        const report = {
          codigo: row[codigoIndex] || '',
          fecha: row[fechaIndex] || '',
          nombre_encargado: row[nombreEncargadoIndex] || '',
          invernadero: cleanRowInvernadero,
          genero: row[generoIndex] || '',
          kilos: row[kilosIndex] || '',
          intervalokg: row[intervalokgIndex] || '',
          kgintervalo: row[kgintervaloIndex] || '',
          necesidadcogida: row[necesidadcogidaIndex] || '0',
          razoncogida: row[razoncogidaIndex] || '',
          descripcion: row[descripcionIndex] || ''
        };
        
        reports.push(report);
        console.log('✅ Informe agregado:', report);
      }
    }

    // Ordenar por fecha (más reciente primero)
    reports.sort((a, b) => {
      // Convertir fechas DD/MM/YYYY a Date para comparar
      const dateA = new Date(a.fecha.split('/').reverse().join('-'));
      const dateB = new Date(b.fecha.split('/').reverse().join('-'));
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`📋 Total informes encontrados para ${invernadero}: ${reports.length}`);

    res.json({ 
      success: true, 
      reports: reports,
      total: reports.length,
      invernadero: invernadero
    });

  } catch (error) {
    console.error('❌ Error consultando informes de cogida:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});





