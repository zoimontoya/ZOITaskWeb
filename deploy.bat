@echo off
REM Script para desplegar ZOI Task Web con Docker Compose en Windows

echo 🚀 Desplegando ZOI Task Web...

REM Verificar si Docker está instalado
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker no está instalado o no está en el PATH
    echo 📖 Por favor, consulta INSTALL_DOCKER.md para instalarlo
    echo 🌐 O descárgalo desde: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

REM Verificar si Docker Compose está disponible
docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker Compose no está disponible
    echo 📖 Asegúrate de tener Docker Desktop instalado correctamente
    pause
    exit /b 1
)

echo ✅ Docker está disponible

REM Verificar si existe el archivo .env
if not exist ".env" (
    echo ⚠️  No se encontró archivo .env
    echo 🔐 Ejecutando configuración de credenciales...
    call setup-credentials.bat
    if errorlevel 1 (
        echo ❌ Error en la configuración de credenciales
        pause
        exit /b 1
    )
)

REM Detener contenedores existentes si los hay
echo 📦 Deteniendo contenedores existentes...
docker compose down

REM Limpiar imágenes anteriores (opcional)
echo 🧹 Limpiando imágenes anteriores...
docker compose down --rmi all 2>nul

REM Construir y levantar los servicios
echo 🏗️  Construyendo y levantando servicios...
docker compose up --build -d

REM Mostrar el estado de los contenedores
echo 📊 Estado de los contenedores:
docker compose ps

REM Obtener la IP local
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set LOCAL_IP=%%i
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP:~1%

echo.
echo ✅ Despliegue completado!
echo.
echo 🌐 Accede a la aplicación desde:
echo    - Localmente: http://localhost
echo    - Desde otros dispositivos en tu red: http://%LOCAL_IP%
echo.
echo 🔧 Backend API disponible en:
echo    - Localmente: http://localhost:3000
echo    - Desde otros dispositivos: http://%LOCAL_IP%:3000
echo.
echo 📱 Comparte la URL http://%LOCAL_IP% con otros dispositivos en tu WiFi
echo.
echo 🛑 Para detener los servicios ejecuta: docker compose down
pause