# 🛠️ Comandos Útiles para ZOI Task Web Docker

## 🚀 Despliegue

### Desplegar toda la aplicación
```bash
# Opción 1: Script automático
./deploy.sh              # Linux/Mac
deploy.bat               # Windows

# Opción 2: Manual
docker compose up --build -d
```

### Solo construir sin ejecutar
```bash
docker compose build
```

## 📊 Monitoreo

### Ver estado de contenedores
```bash
docker compose ps
docker ps
```

### Ver logs
```bash
# Logs de todos los servicios
docker compose logs -f

# Logs solo del frontend
docker compose logs -f frontend

# Logs solo del backend
docker compose logs -f backend

# Últimas 50 líneas
docker compose logs --tail=50 backend
```

### Ver recursos utilizados
```bash
docker stats
```

### Ver información de red
```bash
docker network ls
docker network inspect zoi-network
```

## 🔧 Mantenimiento

### Restart servicios
```bash
# Restart todos
docker compose restart

# Restart solo uno
docker compose restart backend
docker compose restart frontend
```

### Rebuild un servicio específico
```bash
# Solo backend
docker compose up --build -d backend

# Solo frontend  
docker compose up --build -d frontend
```

### Actualizar código
```bash
# 1. Detener servicios
docker compose down

# 2. Rebuild con cambios
docker compose up --build -d

# O en un solo comando
docker compose up --build -d --force-recreate
```

## 🧹 Limpieza

### Detener servicios
```bash
docker compose down
```

### Detener y remover volúmenes
```bash
docker compose down -v
```

### Detener y remover imágenes
```bash
docker compose down --rmi all
```

### Limpieza completa del sistema Docker
```bash
# ⚠️ CUIDADO: Esto elimina TODO en Docker
docker system prune -a --volumes
```

### Limpieza segura (solo elementos no usados)
```bash
docker system prune -f
```

## 🐛 Debugging

### Acceder al contenedor en ejecución
```bash
# Backend
docker compose exec backend sh
docker compose exec backend bash  # si bash está disponible

# Frontend (Nginx)
docker compose exec frontend sh
```

### Ver archivos en el contenedor
```bash
# Listar archivos del backend
docker compose exec backend ls -la /app

# Ver configuración de Nginx
docker compose exec frontend cat /etc/nginx/nginx.conf
```

### Probar conectividad entre contenedores
```bash
# Desde frontend hacia backend
docker compose exec frontend ping backend

# Probar puerto del backend
docker compose exec frontend wget -O- http://backend:3000/health
```

### Verificar variables de entorno
```bash
docker compose exec backend env
docker compose exec frontend env
```

## 🔍 Troubleshooting

### Puerto ocupado
```bash
# Ver qué proceso usa el puerto 80
netstat -tulpn | grep :80        # Linux
netstat -ano | findstr :80       # Windows

# Matar proceso si es necesario
kill -9 PID                      # Linux
taskkill /F /PID PID             # Windows
```

### Problemas de red
```bash
# Ver redes Docker
docker network ls

# Inspeccionar red específica
docker network inspect zoi-network

# Recrear red
docker compose down
docker network rm zoi-network
docker compose up -d
```

### Problemas de memoria/espacio
```bash
# Ver uso de espacio Docker
docker system df

# Ver imágenes grandes
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

### Rebuild completo forzado
```bash
# Detener todo
docker compose down --rmi all -v

# Limpiar cache de build
docker builder prune -f

# Rebuild desde cero
docker compose build --no-cache
docker compose up -d
```

## 📱 Red y Acceso

### Obtener IP del host
```bash
# Linux/Mac
hostname -I
ip route get 1.1.1.1 | grep -oP 'src \K\S+'

# Windows
ipconfig | findstr IPv4
```

### Probar acceso desde otro dispositivo
```bash
# Ping al host
ping [IP_DEL_HOST]

# Probar puerto HTTP
curl http://[IP_DEL_HOST]
curl http://[IP_DEL_HOST]:3000/health  # Si tienes endpoint de health
```

### Ver puertos abiertos
```bash
# En el host
netstat -tulpn | grep -E ':80|:3000'    # Linux
netstat -ano | findstr -E ":80 :3000"   # Windows

# Puertos Docker
docker port frontend
docker port backend
```

## 🔒 Seguridad

### Ver logs de acceso
```bash
# Logs de Nginx (frontend)
docker compose logs frontend | grep -E "GET|POST"

# Logs del backend
docker compose logs backend | grep -E "Request|Error"
```

### Cambiar puertos (si hay conflictos)
```bash
# Editar docker-compose.yml o usar variables de entorno
export FRONTEND_PORT=8080
export BACKEND_PORT=3001
docker compose up -d
```