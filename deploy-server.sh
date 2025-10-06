#!/bin/bash

# Script de despliegue automático para ZOI Task Web
echo "🚀 Desplegando ZOI Task Web en producción..."

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker si no está instalado
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    sudo systemctl start docker
    sudo systemctl enable docker
fi

# Instalar Docker Compose si no está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "🔧 Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Clonar repositorio (si no existe)
if [ ! -d "ZOITaskWeb" ]; then
    git clone https://github.com/zoimontoya/ZOITaskWeb.git
fi

cd ZOITaskWeb

# Configurar variables de entorno
echo "⚙️ Configurando variables de entorno..."
cp .env.example .env
echo "📝 IMPORTANTE: Edita el archivo .env con tus credenciales de Google Sheets"
nano .env

# Construir y ejecutar contenedores
echo "🏗️ Construyendo y ejecutando contenedores..."
docker-compose up -d --build

# Mostrar estado
echo "✅ Despliegue completado!"
echo "🌐 Tu aplicación está disponible en:"
echo "   http://$(curl -s ipinfo.io/ip):8080"
echo ""
echo "📊 Estado de contenedores:"
docker ps

echo ""
echo "🔧 Para ver logs:"
echo "   docker-compose logs -f"