@echo off
echo 🔍 === Verificación Pre-Deployment ===
echo.

echo 📋 1. Verificando Docker...
docker --version
if errorlevel 1 (
    echo ❌ Docker no está instalado
    goto :error
)
echo ✅ Docker OK

echo.
echo 📋 2. Verificando Docker Compose...
docker compose version
if errorlevel 1 (
    echo ❌ Docker Compose no disponible
    goto :error
)
echo ✅ Docker Compose OK

echo.
echo 📋 3. Verificando archivo .env...
if not exist ".env" (
    echo ❌ Archivo .env no encontrado
    echo 📝 Ejecuta primero: copy .env.example .env
    goto :error
)
echo ✅ Archivo .env encontrado

echo.
echo 📋 4. Verificando configuración .env...
findstr /C:"GOOGLE_SERVICE_ACCOUNT_JSON=" .env >nul
if errorlevel 1 (
    echo ⚠️  GOOGLE_SERVICE_ACCOUNT_JSON no configurado
    echo 📝 Edita .env con tus credenciales de Google Sheets
)

findstr /C:"SPREADSHEET_ID=" .env >nul
if errorlevel 1 (
    echo ⚠️  SPREADSHEET_ID no configurado
    echo 📝 Edita .env con el ID de tu Google Sheet
)

echo.
echo 📋 5. Verificando estructura de archivos...
if not exist "backend\Dockerfile" (
    echo ❌ backend\Dockerfile no encontrado
    goto :error
)
if not exist "Dockerfile" (
    echo ❌ Dockerfile (frontend) no encontrado
    goto :error
)
if not exist "docker-compose.yml" (
    echo ❌ docker-compose.yml no encontrado
    goto :error
)
echo ✅ Archivos Docker OK

echo.
echo 📋 6. Test de construcción (dry-run)...
docker compose config >nul
if errorlevel 1 (
    echo ❌ Error en configuración de docker-compose.yml
    goto :error
)
echo ✅ Configuración Docker válida

echo.
echo 🎉 ¡Todo listo para deployment!
echo.
echo 🚀 Para desplegar ejecuta:
echo    deploy-production.bat
echo.
goto :end

:error
echo.
echo ❌ Hay errores que deben corregirse antes del deployment
echo 📖 Consulta DEPLOYMENT_GUIDE.md para más información
echo.

:end
pause