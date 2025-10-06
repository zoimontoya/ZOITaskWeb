# 🚀 Guía de Deployment - ZOI Task Management

## 📋 Requisitos Previos

1. **Docker Desktop** instalado y funcionando
2. **Credenciales de Google Sheets API**
3. **Archivo .env configurado** con tus credenciales

## 🔧 Configuración Inicial

### 1. Configurar Google Sheets API

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Habilita la **Google Sheets API**
4. Crea credenciales de **Service Account**
5. Descargar el archivo JSON de credenciales

### 2. Configurar archivo .env

```bash
# Copia el archivo de ejemplo
copy .env.example .env
```

Edita `.env` con tus datos:

```bash
# Pega aquí el JSON de credenciales en una sola línea
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# ID de tu Google Sheet
SPREADSHEET_ID=1EEZlootxR63QHicF2cQ5GDmzQJ31V22fE202LXkufc4

# Configuración del servidor
PORT=3000
NODE_ENV=production
```

### 3. Dar permisos al Service Account

1. Abre tu Google Sheet
2. Clic en "Compartir"
3. Añade el email del Service Account (ej: `zoi-task@tu-proyecto.iam.gserviceaccount.com`)
4. Dale permisos de **Editor**

## 🚀 Deployment Automático

### Opción A: Script Windows (Recomendado)

```cmd
# Ejecuta el script de deployment
deploy-production.bat
```

### Opción B: Comandos manuales

```cmd
# 1. Construir contenedores
docker compose build --no-cache

# 2. Iniciar aplicación
docker compose up -d

# 3. Verificar estado
docker compose ps
```

## 🌐 Acceso a la Aplicación

### Acceso Local
- **Aplicación**: http://localhost
- **API**: http://localhost/api/health

### Acceso desde Red Local
1. Encuentra tu IP local:
   ```cmd
   ipconfig
   ```
2. Accede desde cualquier dispositivo:
   - **IP Ejemplo**: http://192.168.1.100

### Acceso desde Internet (Opcional)
Para acceso desde fuera de tu red:

1. **Router**: Configura port forwarding (puerto 80 → tu PC)
2. **IP Pública**: Encuentra tu IP en [whatismyip.com](https://whatismyip.com)
3. **Acceso**: http://[TU-IP-PUBLICA]

⚠️ **Seguridad**: Solo para testing, no recomendado para producción real.

## 📱 Acceso desde Móvil con Datos

Para acceso con datos móviles, necesitas una de estas opciones:

### 1. Servicio en la Nube (Recomendado)
- **Railway**: Deployment gratuito
- **Heroku**: Plan gratuito limitado
- **DigitalOcean**: $5/mes
- **AWS/Google Cloud**: Pay-as-you-go

### 2. Ngrok (Para testing)
```cmd
# Instalar ngrok
# Ejecutar después del deployment
ngrok http 80
```

### 3. CloudFlare Tunnel (Gratuito)
- Más seguro que port forwarding
- Acceso HTTPS automático

## 🛠️ Comandos Útiles

```cmd
# Ver logs
docker compose logs -f

# Reiniciar aplicación
docker compose restart

# Detener aplicación
docker compose down

# Ver estado de contenedores
docker compose ps

# Actualizar después de cambios
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 🔍 Troubleshooting

### Error: No se puede conectar al backend
```cmd
# Verificar que el backend esté corriendo
docker compose ps
docker compose logs backend
```

### Error: Credenciales de Google Sheets
```cmd
# Verificar variables de entorno
docker compose exec backend env | grep GOOGLE
```

### Error: No se puede acceder desde otros dispositivos
1. Verificar firewall de Windows
2. Verificar que Docker expone el puerto 80
3. Verificar IP local con `ipconfig`

### Error: CORS en producción
- El nginx.conf ya incluye headers CORS
- Verificar que el frontend use `/api/` como base URL

## 📈 Monitoreo

### Health Check
- **Backend**: http://localhost/api/health
- **Frontend**: http://localhost

### Logs en Tiempo Real
```cmd
# Todos los servicios
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo frontend
docker compose logs -f frontend
```

## 🔄 Actualizaciones

Después de cambios en el código:

```cmd
# 1. Detener aplicación
docker compose down

# 2. Rebuild contenedores
docker compose build --no-cache

# 3. Reiniciar
docker compose up -d
```

## 🎯 Próximos Pasos

Una vez que funcione localmente:

1. **Testing**: Probar desde diferentes dispositivos en tu red
2. **Cloud**: Elegir servicio en la nube para acceso global
3. **Dominio**: Configurar dominio personalizado (ej: zoi-task.com)
4. **HTTPS**: Certificado SSL para seguridad
5. **Backup**: Automatizar backup de datos importantes