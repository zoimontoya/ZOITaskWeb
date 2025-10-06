@echo off
REM Script para hacer deploy a Google Cloud Run desde Windows

echo 🚀 Desplegando ZOI Task Web a Google Cloud Run...

REM Verificar que gcloud esté instalado
gcloud version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Google Cloud SDK no está instalado
    echo 📥 Descárgalo desde: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

REM Configurar proyecto (reemplaza con tu PROJECT_ID)
set PROJECT_ID=neon-feat-474312-k0
set REGION=europe-west1
set SERVICE_NAME=zoitaskweb

echo 🔧 Configurando proyecto: %PROJECT_ID%
gcloud config set project %PROJECT_ID%
gcloud config set run/region %REGION%

REM Habilitar APIs necesarias
echo 📡 Habilitando APIs necesarias...
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

REM Hacer build y deploy usando Cloud Build
echo 🏗️ Iniciando build en Cloud Build...
gcloud builds submit --config cloudbuild.yaml .

REM Verificar deploy
echo ✅ Verificando deploy...
gcloud run services describe %SERVICE_NAME% --region=%REGION%

REM Obtener URL del servicio
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region=%REGION% --format="value(status.url)"') do set SERVICE_URL=%%i

echo.
echo 🎉 ¡Deploy completado!
echo 🌐 Tu aplicación está disponible en: %SERVICE_URL%
echo.
echo 📋 Próximos pasos:
echo 1. Configurar variables de entorno:
echo    - Ve a: https://console.cloud.google.com/run
echo    - Selecciona el servicio: %SERVICE_NAME%
echo    - Edit ^& Deploy New Revision
echo    - Variables ^& Secrets ^& Add Variable
echo    - GOOGLE_SERVICE_ACCOUNT_JSON: [tu JSON completo]
echo.
echo 2. Probar la aplicación:
echo    - Frontend: %SERVICE_URL%
echo    - API Health: %SERVICE_URL%/api/health
echo.
echo 3. Ver logs:
echo    gcloud logs tail "resource.type=\"cloud_run_revision\"" --project=%PROJECT_ID%

pause