#!/bin/bash
# Script de instalación para servidor físico - ZOI Task Web

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

# Instalar Docker Compose
echo "🔧 Instalando Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Crear directorio para la aplicación
mkdir -p ~/zoi-task-web
cd ~/zoi-task-web

echo "✅ Sistema preparado!"
echo "📁 Ahora copia tu código ZOITaskWeb a este directorio"
echo "📍 Ubicación: $(pwd)"
echo ""
echo "Siguientes pasos:"
echo "1. Copia tu carpeta ZOITaskWeb aquí"
echo "2. Ejecuta: cd ZOITaskWeb && docker-compose up -d"