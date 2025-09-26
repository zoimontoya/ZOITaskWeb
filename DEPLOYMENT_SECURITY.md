# 🚀 Deployment Seguro - ZOI Task Web

## ⚠️ IMPORTANTE - Configuración de Credenciales

Este proyecto usa **Google Sheets API** y requiere credenciales que **NUNCA deben subirse al repositorio**.

## 🔒 Configuración Inicial (Solo la primera vez)

### 1. Obtener Credenciales de Google Sheets

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Habilita la **Google Sheets API**
4. Crea credenciales de **Cuenta de Servicio**
5. Descarga el archivo JSON de credenciales
6. **Renómbralo como** `service-account.json`
7. **Colócalo en** `backend/service-account.json`

### 2. Configurar el Entorno

**Opción A: Automático (Recomendado)**
```bash
# Windows
setup-credentials.bat

# Linux/Mac
chmod +x setup-credentials.sh
./setup-credentials.sh
```

**Opción B: Manual**
1. Copia `service-account.json` a `backend/`
2. Ejecuta el script de setup arriba

## 🚀 Deployment con Docker

### Deployment Automático
```bash
# Windows
deploy.bat

# Linux/Mac  
chmod +x deploy.sh
./deploy.sh
```

### Deployment Manual
```bash
# 1. Configurar credenciales (si no se hizo antes)
./setup-credentials.sh

# 2. Construir y ejecutar
docker compose up --build -d

# 3. Ver logs
docker compose logs -f
```

## 🌐 Acceso a la Aplicación

Una vez desplegada:
- **Local:** http://localhost
- **Red WiFi:** http://[TU_IP_LOCAL]

## 📁 Estructura de Archivos

```
📦 ZOITaskWeb/
├── 🔒 .env                    # ← Credenciales (NO subir)
├── 🔒 backend/service-account.json  # ← Credenciales (NO subir)
├── 📄 .gitignore              # ← Protege archivos sensibles
├── 🐳 docker-compose.yml      # ← Configuración Docker
├── 🛠️ setup-credentials.sh    # ← Script de configuración
├── 🚀 deploy.sh              # ← Script de deployment
└── 📖 DEPLOYMENT_SECURITY.md  # ← Este archivo
```

## 🛡️ Medidas de Seguridad Implementadas

✅ **Gitignore actualizado:** Protege `service-account.json` y `.env`  
✅ **Variables de entorno:** Credenciales no hardcodeadas  
✅ **Detección automática:** Backend detecta credenciales locales o de entorno  
✅ **Scripts seguros:** Configuración automatizada sin exposición  
✅ **Validación:** Scripts verifican credenciales antes del deployment  

## 🔍 Verificación de Seguridad

### Verificar que los archivos sensibles están protegidos:
```bash
# Verificar .gitignore
grep -E "(service-account|\.env)" .gitignore

# Verificar que NO están en Git
git status --ignored
```

### Si accidentalmente subiste credenciales:
```bash
# 1. Eliminar del repositorio
git rm --cached backend/service-account.json
git rm --cached .env

# 2. Commit la eliminación
git commit -m "Remove sensitive credentials"

# 3. Regenerar credenciales en Google Cloud Console
# 4. Actualizar service-account.json localmente
```

## 🛠️ Comandos Útiles

### Ver logs de autenticación:
```bash
docker compose logs backend | grep -E "(credenciales|auth|Google)"
```

### Recrear configuración:
```bash
# Eliminar configuración actual
rm -f .env

# Reconfigurar
./setup-credentials.sh
```

### Limpiar y rebuilder:
```bash
docker compose down --rmi all
./deploy.sh
```

## 🆘 Troubleshooting

### Error: "No se encontraron credenciales"
**Solución:** Ejecuta `setup-credentials.sh` primero

### Error: "Credenciales inválidas"
**Solución:** 
1. Regenera credenciales en Google Cloud Console
2. Reemplaza `backend/service-account.json`
3. Ejecuta `setup-credentials.sh`

### Error: "Docker no puede leer .env"
**Solución:**
1. Verifica que `.env` existe
2. Ejecuta `setup-credentials.sh`
3. Verifica permisos del archivo

### Error de permisos en Google Sheets
**Solución:**
1. Verifica que la cuenta de servicio tenga acceso a la hoja
2. Comparte la hoja con el email de la cuenta de servicio

## 📚 Recursos

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Account Setup Guide](https://cloud.google.com/iam/docs/service-accounts)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

---

## ⚡ Quick Start

```bash
# 1. Colocar service-account.json en backend/
# 2. Ejecutar:
./setup-credentials.sh && ./deploy.sh
```

¡Listo! 🎉