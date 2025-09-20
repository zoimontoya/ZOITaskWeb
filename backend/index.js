
import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const SERVICE_ACCOUNT_FILE = './service-account.json'; // Cambia si tu archivo tiene otro nombre
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '1EEZlootxR63QHicF2cQ5GDmzQJ31V22fE202LXkufc4'; // <-- Pega aquí el ID de tu hoja

// Autenticación con Google
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: SCOPES,
});

// Endpoint para obtener encargados
app.get('/encargados', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios', // Corregido a mayúscula
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json([]);
    }
    const headers = rows[0];
    const idxRol = headers.findIndex(h => h.toLowerCase() === 'rol');
    const idxId = headers.findIndex(h => h.toLowerCase() === 'id');
    const idxName = headers.findIndex(h => h.toLowerCase() === 'name');
    if (idxRol === -1 || idxId === -1 || idxName === -1) {
      return res.status(500).json({ error: 'Faltan columnas rol, id o name' });
    }
    const encargados = rows.slice(1)
      .filter(row => row[idxRol] && String(row[idxRol]).toLowerCase() === 'encargado')
      .map(row => ({
        id: row[idxId],
        name: row[idxName],
        rol: row[idxRol]
      }));
    res.json(encargados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ejemplo: obtener todas las tareas
app.get('/tasks', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'tareas', // nombre de la hoja
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json([]);
    }
    const headers = rows[0];
    const tasks = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Endpoint de login: valida usuario y password contra la hoja 'usuarios'
app.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ success: false, error: 'Faltan credenciales' });
  }
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios', // nombre de la hoja de usuarios (con mayúscula)
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(500).json({ success: false, error: 'No hay usuarios' });
    }
    const headers = rows[0];
    const idxUsuario = headers.findIndex(h => h.toLowerCase() === 'id');
    const idxPassword = headers.findIndex(h => h.toLowerCase() === 'password');
    if (idxUsuario === -1 || idxPassword === -1) {
      return res.status(500).json({ success: false, error: 'Faltan columnas id/password' });
    }
    const idxRol = headers.findIndex(h => h.toLowerCase() === 'rol');
    const idxName = headers.findIndex(h => h.toLowerCase() === 'name');
    const userRow = rows.slice(1).find(row => {
      return String(row[idxUsuario]) === String(usuario) && String(row[idxPassword]) === String(password);
    });
    if (userRow) {
      const rol = idxRol !== -1 ? userRow[idxRol] : undefined;
      const name = idxName !== -1 ? userRow[idxName] : usuario;
      return res.json({ success: true, usuario, rol, name });
    } else {
      return res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Puerto local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
