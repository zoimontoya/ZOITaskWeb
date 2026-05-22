#!/bin/bash

# Script de actualización/despliegue para servidor Ubuntu existente
set -euo pipefail

APP_DIR="/home/teseo/ZOITaskWeb"
REPO_URL="https://github.com/zoimontoya/ZOITaskWeb.git"
BRANCH="production-deployment"

echo "🚀 Actualizando ZOI Task Web en Ubuntu..."

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

# Instalar plugin Docker Compose v2 si no está instalado
if ! docker compose version &> /dev/null; then
    echo "🔧 Instalando Docker Compose plugin..."
    sudo apt install -y docker-compose-plugin
fi

# Asegurar que Docker esté activo
sudo systemctl start docker
sudo systemctl enable docker

# Clonar repositorio si no existe
if [ ! -d "$APP_DIR/.git" ]; then
    echo "📥 Clonando repositorio en $APP_DIR"
    sudo mkdir -p /home/teseo
    sudo chown -R "$USER":"$USER" /home/teseo
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

echo "🔄 Actualizando rama $BRANCH..."
git fetch origin
git checkout "$BRANCH"
git pull --rebase origin "$BRANCH"

# Configurar variables de entorno
echo "⚙️ Configurando variables de entorno..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "📝 IMPORTANTE: Se creó .env. Debes completar credenciales de Google Sheets"
    nano .env
fi

# Verificar variables mínimas requeridas
for key in NODE_ENV PORT SPREADSHEET_ID TECHNICIAN_SPREADSHEET_ID GOOGLE_SERVICE_ACCOUNT_JSON JWT_SECRET; do
  if ! grep -q "^${key}=" .env; then
    echo "❌ Falta variable requerida en .env: ${key}"
    echo "   Edita .env y vuelve a ejecutar este script."
    exit 1
  fi
done

chmod 600 .env || true

# Construir y ejecutar contenedores
echo "🏗️ Construyendo y ejecutando contenedores..."
docker compose down
docker compose build --no-cache
docker compose up -d

# Mostrar estado
echo "✅ Despliegue completado!"
echo "🌐 Tu aplicación está disponible en:"
echo "   http://$(curl -s ipinfo.io/ip):8090"
echo ""
echo "📊 Estado de contenedores:"
docker compose ps

echo ""
echo "🔧 Para ver logs:"
echo "   docker compose logs -f"
echo ""
echo "🩺 Health checks:"
echo "   Frontend: http://localhost:8090"
echo "   Backend:  http://localhost:3000/health"