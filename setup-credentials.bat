@echo off
REM 🔐 Script de Configuración Segura de Credenciales para Windows
REM ==============================================================

echo 🔐 Configuración de Credenciales de Google Sheets
echo ================================================
echo.

REM Verificar si existe el archivo service-account.json
if not exist "backend\service-account.json" (
    echo ❌ No se encontró backend\service-account.json
    echo.
    echo 📝 Para continuar:
    echo    1. Ve a: https://console.cloud.google.com/
    echo    2. Descarga tu archivo service-account.json
    echo    3. Colócalo en: backend\service-account.json
    echo.
    pause
    exit /b 1
)

echo ✅ Archivo service-account.json encontrado
echo 📄 Creando archivo .env con credenciales...

REM Leer el contenido del JSON y crear el .env
powershell -Command "$json = Get-Content 'backend\service-account.json' -Raw; $json = $json -replace '[\r\n]', ''; $env = @(); $env += '# 🔒 Google Sheets API Credentials (Auto-generado)'; $env += '# ⚠️  NUNCA subas este archivo al repositorio Git'; $env += 'GOOGLE_SERVICE_ACCOUNT_JSON=' + [char]39 + $json + [char]39; $env += ''; $env += '# 🚀 Application Settings'; $env += 'NODE_ENV=production'; $env += 'PORT=3000'; $env += ''; $env += '# 📊 Spreadsheet Configuration'; $env += 'SPREADSHEET_ID=1EEZlootxR63QHicF2cQ5GDmzQJ31V22fE202LXkufc4'; $env | Out-File -FilePath '.env' -Encoding UTF8"

echo.
echo ✅ Archivo .env creado exitosamente
echo 🚀 Ahora puedes ejecutar: docker compose up --build -d
echo.

REM Obtener IP local
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%i
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP:~1%

echo 🌐 La aplicación estará disponible en:
echo    - Localmente: http://localhost
echo    - Red local: http://%LOCAL_IP%
echo.
echo ⚠️  IMPORTANTE:
echo    🔒 El archivo .env contiene credenciales sensibles
echo    📁 Está protegido por .gitignore
echo    🚫 NUNCA lo subas al repositorio
echo.
pause