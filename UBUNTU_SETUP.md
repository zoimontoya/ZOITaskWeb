# 🔒 Configuración de Variables de Entorno para Ubuntu

## 📋 Instrucciones para crear .env en Ubuntu VM

### 1. Crear el archivo .env
```bash
cd ZOITaskWeb
nano .env
```

### 2. Configurar las variables necesarias:

```env
# Google Sheets Configuration  
SPREADSHEET_ID=TU_SPREADSHEET_ID

# Google Service Account JSON (reemplazar con tus credenciales reales)
GOOGLE_SERVICE_ACCOUNT_JSON=TUS_CREDENCIALES_JSON_COMPLETAS

# Application Configuration
NODE_ENV=production
PORT=3000
JWT_SECRET=tu-jwt-secret-muy-seguro
```

### 3. Proteger el archivo
```bash
chmod 600 .env
```

## ⚠️ IMPORTANTE: Seguridad

- **NUNCA** subas el archivo .env real a Git/GitHub
- Copia manualmente las credenciales desde tu .env local
- Usa siempre `chmod 600 .env` para proteger el archivo

## 📁 Archivos necesarios para Ubuntu

Los siguientes archivos están listos para transferir:
- `docker-compose.yml`
- `Dockerfile`  
- `package.json`
- `src/` (carpeta completa)
- `backend/` (carpeta completa)
- Scripts de instalación y comandos útiles