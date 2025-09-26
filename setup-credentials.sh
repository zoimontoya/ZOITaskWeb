#!/bin/bash

# 🔐 Script de Configuración Segura de Credenciales
# ===============================================

echo "🔐 Configuración de Credenciales de Google Sheets"
echo "================================================"
echo ""

# Verificar si existe el archivo service-account.json
if [ ! -f "backend/service-account.json" ]; then
    echo "❌ No se encontró backend/service-account.json"
    echo ""
    echo "📝 Para continuar:"
    echo "   1. Ve a: https://console.cloud.google.com/"
    echo "   2. Descarga tu archivo service-account.json"
    echo "   3. Colócalo en: backend/service-account.json"
    echo ""
    exit 1
fi

echo "✅ Archivo service-account.json encontrado"
echo "📄 Creando archivo .env con credenciales..."

# Verificar que el JSON sea válido
if ! jq empty backend/service-account.json 2>/dev/null; then
    echo "⚠️  jq no está disponible, verificación JSON omitida"
fi

# Convertir el JSON a una sola línea para la variable de entorno
GOOGLE_CREDS=$(cat backend/service-account.json | tr -d '\n\r' | sed 's/[[:space:]]\+/ /g')

# Crear el archivo .env
cat > .env << EOF
# 🔒 Google Sheets API Credentials (Auto-generado)
# ⚠️  NUNCA subas este archivo al repositorio Git
GOOGLE_SERVICE_ACCOUNT_JSON='${GOOGLE_CREDS}'

# 🚀 Application Settings
NODE_ENV=production
PORT=3000

# 📊 Spreadsheet Configuration
SPREADSHEET_ID=1EEZlootxR63QHicF2cQ5GDmzQJ31V22fE202LXkufc4
EOF

echo ""
echo "✅ Archivo .env creado exitosamente"
echo "🚀 Ahora puedes ejecutar: docker compose up --build -d"
echo ""
echo "🌐 La aplicación estará disponible en:"
echo "   - Localmente: http://localhost"
echo "   - Red local: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'TU_IP_LOCAL')"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   🔒 El archivo .env contiene credenciales sensibles"
echo "   📁 Está protegido por .gitignore"
echo "   🚫 NUNCA lo subas al repositorio"