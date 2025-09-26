#!/bin/bash

# Script para desplegar ZOI Task Web con Docker Compose

echo "🚀 Desplegando ZOI Task Web..."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker no está instalado"
    echo "📖 Por favor, consulta INSTALL_DOCKER.md para instalarlo"
    echo "🌐 O visita: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Verificar si Docker Compose está disponible
if ! docker compose version &> /dev/null; then
    echo "❌ Error: Docker Compose no está disponible"
    echo "📖 Asegúrate de tener Docker Desktop instalado correctamente"
    exit 1
fi

echo "✅ Docker está disponible"

# Verificar si existe el archivo .env
if [ ! -f ".env" ]; then
    echo "⚠️  No se encontró archivo .env"
    echo "🔐 Ejecutando configuración de credenciales..."
    chmod +x setup-credentials.sh
    ./setup-credentials.sh
    if [ $? -ne 0 ]; then
        echo "❌ Error en la configuración de credenciales"
        exit 1
    fi
fi

# Detener contenedores existentes si los hay
echo "📦 Deteniendo contenedores existentes..."
docker compose down

# Limpiar imágenes anteriores (opcional)
echo "🧹 Limpiando imágenes anteriores..."
docker compose down --rmi all 2>/dev/null || true

# Construir y levantar los servicios
echo "🏗️  Construyendo y levantando servicios..."
docker compose up --build -d

# Mostrar el estado de los contenedores
echo "📊 Estado de los contenedores:"
docker compose ps

# Obtener la IP local
if command -v ip &> /dev/null; then
    LOCAL_IP=$(ip route get 1.1.1.1 | grep -oP 'src \K\S+')
elif command -v hostname &> /dev/null; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
else
    LOCAL_IP="localhost"
fi

echo ""
echo "✅ Despliegue completado!"
echo ""
echo "🌐 Accede a la aplicación desde:"
echo "   - Localmente: http://localhost"
echo "   - Desde otros dispositivos en tu red: http://$LOCAL_IP"
echo ""
echo "🔧 Backend API disponible en:"
echo "   - Localmente: http://localhost:3000"
echo "   - Desde otros dispositivos: http://$LOCAL_IP:3000"
echo ""
echo "📱 Comparte la URL http://$LOCAL_IP con otros dispositivos en tu WiFi"
echo ""
echo "🛑 Para detener los servicios ejecuta: docker compose down"