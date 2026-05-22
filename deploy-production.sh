#!/bin/bash

# 🚀 Script de deployment para ZOI Task Management
# Este script prepara y despliega la aplicación en Docker para producción

echo "🚀 === ZOI Task Management - Deployment Script ==="
echo ""

# 1. Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Instala Docker Desktop primero."
    exit 1
fi

# 2. Verificar que Docker Compose está disponible
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose no está disponible."
    exit 1
fi

echo "✅ Docker y Docker Compose están disponibles"

# 3. Verificar archivo .env
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Copiando desde .env.example..."
    cp .env.example .env
    echo "📝 Edita el archivo .env con tus credenciales antes de continuar."
    echo "   Especialmente:"
    echo "   - GOOGLE_SERVICE_ACCOUNT_JSON"
    echo "   - SPREADSHEET_ID"
    echo ""
    read -p "¿Has configurado el archivo .env? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Configura el archivo .env primero."
        exit 1
    fi
fi

echo "✅ Archivo .env encontrado"

# 4. Construir y desplegar
echo ""
echo "🔨 Construyendo y desplegando aplicación..."
echo ""

# Detener contenedores existentes
echo "🛑 Deteniendo contenedores existentes..."
docker compose down

# Limpiar imágenes anteriores (opcional)
echo "🧹 Limpiando imágenes anteriores..."
docker compose down --rmi all --volumes --remove-orphans 2>/dev/null || true

# Construir y ejecutar
echo "🔨 Construyendo aplicación..."
docker compose build --no-cache

echo "🚀 Iniciando aplicación..."
docker compose up -d

# 5. Verificar que los contenedores están corriendo
echo ""
echo "⏳ Verificando contenedores..."
sleep 5

if docker compose ps | grep -q "Up"; then
    echo "✅ ¡Aplicación desplegada exitosamente!"
    echo ""
    echo "🌐 URLs de acceso:"
    echo "   📱 Aplicación principal: http://localhost:8090"
    echo "   🔧 Backend API (directo): http://localhost:3000/health"
    echo "   🔧 Backend API (vía frontend): http://localhost:8090/api/health"
    echo ""
    echo "📋 Para acceso desde otros dispositivos en tu red:"
    echo "   1. Encuentra tu IP local: ipconfig (Windows) / ifconfig (Mac/Linux)"
    echo "   2. Accede desde: http://[TU-IP-LOCAL]:8090"
    echo "   Ejemplo: http://192.168.1.100:8090"
    echo ""
    echo "📝 Para ver logs: docker compose logs -f"
    echo "🛑 Para detener: docker compose down"
else
    echo "❌ Error al iniciar los contenedores"
    echo "📋 Ver logs con: docker compose logs"
fi

echo ""
echo "🎉 ¡Deployment completado!"