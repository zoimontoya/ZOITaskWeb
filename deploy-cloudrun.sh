#!/bin/bash

# Script para configurar variables de entorno en Google Cloud Run
# Ejecutar después del deploy inicial

echo "🔧 Configurando variables de entorno para ZOI Task Web en Cloud Run..."

# Variables requeridas
PROJECT_ID="neon-feat-474312-k0"  # Tu project ID
SERVICE_NAME="zoitaskweb"
REGION="europe-west1"

# Variables de entorno desde tu archivo .env
SPREADSHEET_ID="1EEZlootxR63QHicF2cQ5GDmzQJ31V22fE202LXkufc4"
JWT_SECRET="zoi-task-web-secret-key-2025"

# Google Service Account JSON (desde tu .env - necesita ser configurado manualmente)
echo "📝 IMPORTANTE: Necesitas configurar GOOGLE_SERVICE_ACCOUNT_JSON manualmente"
echo "   1. Ve a Google Cloud Console"
echo "   2. Cloud Run → zoitaskweb → Edit & Deploy New Revision"
echo "   3. Variables & Secrets → Add Variable"
echo "   4. Name: GOOGLE_SERVICE_ACCOUNT_JSON"
echo "   5. Value: [El contenido completo de tu JSON de service account]"

# Configurar variables básicas
gcloud run services update $SERVICE_NAME \
  --platform=managed \
  --region=$REGION \
  --update-env-vars="NODE_ENV=production" \
  --update-env-vars="PORT=8080" \
  --update-env-vars="SPREADSHEET_ID=$SPREADSHEET_ID" \
  --update-env-vars="JWT_SECRET=$JWT_SECRET"

echo "✅ Variables básicas configuradas"
echo "⚠️  Recuerda configurar GOOGLE_SERVICE_ACCOUNT_JSON manualmente en la consola"

# Mostrar URL del servicio
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform=managed --region=$REGION --format="value(status.url)")
echo ""
echo "🌐 Tu aplicación estará disponible en: $SERVICE_URL"
echo "🔧 Para ver logs: gcloud logs tail 'resource.type=\"cloud_run_revision\"' --project=$PROJECT_ID"