@echo off
setlocal enabledelayedexpansion

echo 🚀 === ZOI Task Management - Deployment Script ===
echo.

REM 1. Verificar que Docker está instalado
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker no está instalado. Instala Docker Desktop primero.
    pause
    exit /b 1
)

REM 2. Verificar que Docker Compose está disponible
docker compose version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose no está disponible.
    pause
    exit /b 1
)

echo ✅ Docker y Docker Compose están disponibles

REM 3. Verificar archivo .env
if not exist ".env" (
    echo ⚠️  Archivo .env no encontrado. Copiando desde .env.example...
    copy ".env.example" ".env"
    echo 📝 Edita el archivo .env con tus credenciales antes de continuar.
    echo    Especialmente:
    echo    - GOOGLE_SERVICE_ACCOUNT_JSON
    echo    - SPREADSHEET_ID
    echo.
    set /p continue="¿Has configurado el archivo .env? (y/n): "
    if /i not "!continue!"=="y" (
        echo ❌ Configura el archivo .env primero.
        pause
        exit /b 1
    )
)

echo ✅ Archivo .env encontrado

REM 4. Construir y desplegar
echo.
echo 🔨 Construyendo y desplegando aplicación...
echo.

REM Detener contenedores existentes
echo 🛑 Deteniendo contenedores existentes...
docker compose down

REM Limpiar imágenes anteriores (opcional)
echo 🧹 Limpiando imágenes anteriores...
docker compose down --rmi all --volumes --remove-orphans 2>nul

REM Construir y ejecutar
echo 🔨 Construyendo aplicación...
docker compose build --no-cache

echo 🚀 Iniciando aplicación...
docker compose up -d

REM 5. Verificar que los contenedores están corriendo
echo.
echo ⏳ Verificando contenedores...
timeout /t 5 /nobreak >nul

docker compose ps | findstr "Up" >nul
if not errorlevel 1 (
    echo ✅ ¡Aplicación desplegada exitosamente!
    echo.
    echo 🌐 URLs de acceso:
    echo    📱 Aplicación principal: http://localhost
    echo    🔧 Backend API: http://localhost/api/health
    echo.
    echo 📋 Para acceso desde otros dispositivos en tu red:
    echo    1. Encuentra tu IP local: ipconfig
    echo    2. Accede desde: http://[TU-IP-LOCAL]
    echo    Ejemplo: http://192.168.1.100
    echo.
    echo 📝 Para ver logs: docker compose logs -f
    echo 🛑 Para detener: docker compose down
) else (
    echo ❌ Error al iniciar los contenedores
    echo 📋 Ver logs con: docker compose logs
)

echo.
echo 🎉 ¡Deployment completado!
echo.
pause