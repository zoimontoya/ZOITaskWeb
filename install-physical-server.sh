#!/bin/bash
# Script de instalación para servidor físico - ZOI Task Web

set -euo pipefail

echo "🏠 Instalando ZOI Task Web en servidor físico..."

# Detectar el sistema operativo
if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    sudo apt update
    sudo apt install -y git curl
elif [ -f /etc/redhat-release ]; then
    # CentOS/RHEL/Fedora
    sudo yum update -y
    sudo yum install -y git curl
fi

# Instalar Docker
echo "🐳 Instalando Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo systemctl start docker
sudo systemctl enable docker

# Instalar Docker Compose plugin (v2)
echo "🔧 Instalando Docker Compose plugin..."
if [ -f /etc/debian_version ]; then
    sudo apt install -y docker-compose-plugin
elif [ -f /etc/redhat-release ]; then
    sudo yum install -y docker-compose-plugin || true
fi

if ! docker compose version &> /dev/null; then
    echo "❌ No se pudo instalar Docker Compose plugin."
    exit 1
fi

# Crear directorio para la aplicación
sudo mkdir -p /home/teseo/ZOITaskWeb
sudo chown -R "$USER":"$USER" /home/teseo/ZOITaskWeb
cd /home/teseo/ZOITaskWeb

echo "✅ Sistema preparado!"
echo "📁 Ahora clona/actualiza tu código ZOITaskWeb en este directorio"
echo "📍 Ubicación: $(pwd)"
echo ""
echo "Siguientes pasos:"
echo "1. git clone -b production-deployment https://github.com/zoimontoya/ZOITaskWeb.git ."
echo "2. Configura .env"
echo "3. Ejecuta: docker compose up -d --build"