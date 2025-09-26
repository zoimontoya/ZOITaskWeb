# 🐳 Docker Deployment - ZOI Task Web

Este documento explica cómo desplegar la aplicación ZOI Task Web usando Docker para compartirla en tu red local.

## 🚀 Despliegue Rápido

### Prerequisitos
- Docker y Docker Compose instalados
- Estar conectado a la misma red WiFi que los dispositivos que accederán

### Opción 1: Script Automático (Recomendado)

**En Windows:**
```cmd
deploy.bat
```

**En Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Opción 2: Manual

```bash
# Construir y levantar los servicios
docker-compose up --build -d

# Ver el estado
docker-compose ps

# Ver logs (opcional)
docker-compose logs -f
```

## 🌐 Acceso a la Aplicación

Una vez desplegada, la aplicación estará disponible en:

- **Localmente:** http://localhost
- **Desde otros dispositivos:** http://[TU_IP_LOCAL]

### Obtener tu IP Local

**Windows:**
```cmd
ipconfig
```
Busca "IPv4 Address" en tu adaptador de red activo.

**Linux/Mac:**
```bash
ip addr show | grep inet
# o
hostname -I
```

## 📱 Compartir con Otros Dispositivos

1. Asegúrate de que todos los dispositivos están en la misma WiFi
2. Comparte la URL: `http://[TU_IP_LOCAL]`
3. Los otros dispositivos pueden abrir esta URL en su navegador

### Ejemplo:
Si tu IP local es `192.168.1.100`, comparte:
- **Frontend:** `http://192.168.1.100`
- **Backend API:** `http://192.168.1.100:3000` (si necesario)

## 🛠️ Comandos Útiles

### Ver logs de los servicios:
```bash
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Rebuild de un servicio específico:
```bash
docker-compose up --build -d frontend
docker-compose up --build -d backend
```

### Detener todos los servicios:
```bash
docker-compose down
```

### Limpiar todo (incluyendo imágenes):
```bash
docker-compose down --rmi all
docker system prune -f
```

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────┐
│                  Docker Host                │
│  ┌─────────────────┐  ┌─────────────────────┐ │
│  │    Frontend     │  │      Backend        │ │
│  │  (Angular +     │  │   (Node.js +        │ │
│  │    Nginx)       │  │    Express)         │ │
│  │                 │  │                     │ │
│  │   Port: 80      │  │    Port: 3000       │ │
│  └─────────────────┘  └─────────────────────┘ │
│           │                       │           │
│           └───────────────────────┘           │
│                 Network Bridge                │
└─────────────────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              │   Tu Red WiFi     │
              └───────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   📱 Móvil         💻 Laptop      📱 Tablet
```

## 🔧 Configuración de Red

### Firewall (Windows)
Si tienes problemas de acceso, permite el tráfico en los puertos:
- Puerto 80 (Frontend)
- Puerto 3000 (Backend)

### Router
La mayoría de routers domésticos permiten comunicación entre dispositivos por defecto.

## 🐛 Troubleshooting

### Problema: No puedo acceder desde otros dispositivos
**Soluciones:**
1. Verifica que estés usando la IP correcta
2. Desactiva temporalmente el firewall
3. Asegúrate de que ambos dispositivos están en la misma red
4. Reinicia el router si es necesario

### Problema: Error al construir las imágenes
**Soluciones:**
1. Limpia Docker: `docker system prune -f`
2. Verifica que tienes espacio en disco
3. Reinicia Docker Desktop

### Problema: El backend no se conecta a Google Sheets
**Soluciones:**
1. Verifica que `service-account.json` existe en `backend/`
2. Comprueba que las credenciales son correctas
3. Revisa los logs: `docker-compose logs backend`

## 📊 Monitoreo

Ver recursos utilizados:
```bash
docker stats
```

Ver puertos ocupados:
```bash
docker-compose ps
```

## 🔒 Seguridad

⚠️ **Importante:** Esta configuración es solo para uso en redes locales de confianza. No expongas estos puertos a Internet sin configuración adicional de seguridad.

## 📝 Notas

- Los datos se mantienen mientras los contenedores estén activos
- Para persistencia de datos, considera agregar volumes si es necesario
- El frontend se sirve de forma estática y eficiente con Nginx
- El backend mantiene conexión con Google Sheets API