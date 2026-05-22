# 🚀 Quick Start - ZOI Task Web Docker

## ⚡ Despliegue en 3 Pasos

### 1️⃣ Preparar Credenciales
```bash
# Coloca tu service-account.json en: backend/service-account.json
# Luego ejecuta:

# Windows:
setup-credentials.bat

# Linux/Mac:
chmod +x setup-credentials.sh
./setup-credentials.sh
```

### 2️⃣ Desplegar
```bash
# Windows:
deploy.bat

# Linux/Mac:
chmod +x deploy.sh
./deploy.sh
```

### 3️⃣ Acceder
- **Tu dispositivo:** http://localhost:8090
- **Otros dispositivos:** http://[TU_IP_LOCAL]:8090

> Si ya tienes la instalación en Ubuntu, usa la ruta: `/home/teseo/ZOITaskWeb`

---

## 🛑 Para Detener
```bash
docker compose down
```

## 🔄 Para Actualizar Código
```bash
./deploy.sh  # Rebuilds automáticamente
```

## 📋 Prerequisitos
- ✅ Docker Desktop instalado
- ✅ Archivo service-account.json de Google Cloud
- ✅ Todos en la misma red WiFi

## 🆘 Si hay Problemas
1. Verifica que Docker esté ejecutándose
2. Ejecuta `setup-credentials.sh` primero
3. Lee `DEPLOYMENT_SECURITY.md` para más detalles

---
**¿Primera vez?** Lee `DEPLOYMENT_SECURITY.md` para configuración detallada.