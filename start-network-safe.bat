@echo off
chcp 65001 > nul
echo 🔍 Verificando estado de los servicios...
echo.

:: Verificar si el backend ya está corriendo en puerto 3000
netstat -an | findstr ":3000" | findstr "LISTENING" > nul
if %errorlevel% == 0 (
    echo ✅ Backend ya está corriendo en puerto 3000
    set BACKEND_RUNNING=1
) else (
    echo ❌ Backend NO está corriendo en puerto 3000
    set BACKEND_RUNNING=0
)

:: Verificar si Angular ya está corriendo en puerto 4200
netstat -an | findstr ":4200" | findstr "LISTENING" > nul
if %errorlevel% == 0 (
    echo ✅ Frontend ya está corriendo en puerto 4200
    set FRONTEND_RUNNING=1
) else (
    echo ❌ Frontend NO está corriendo en puerto 4200
    set FRONTEND_RUNNING=0
)

echo.
echo 🚀 Iniciando servicios necesarios...

:: Iniciar backend solo si no está corriendo
if %BACKEND_RUNNING% == 0 (
    echo 📦 Iniciando Backend...
    start "Backend ZOI" cmd /k "cd /d %~dp0backend && echo 🚀 Iniciando backend en puerto 3000... && node index.js"
    timeout /t 3 > nul
) else (
    echo ⏭️  Backend ya activo, saltando inicio
)

:: Iniciar frontend solo si no está corriendo
if %FRONTEND_RUNNING% == 0 (
    echo 🌐 Iniciando Frontend con proxy...
    start "Frontend ZOI" cmd /k "echo 🚀 Iniciando frontend con proxy... && ng serve --host 0.0.0.0 --disable-host-check --proxy-config proxy-network.conf.json"
) else (
    echo ⏭️  Frontend ya activo, saltando inicio
)

echo.
echo 🎯 URLs IMPORTANTES:
echo ===================
echo 📱 Página de pruebas: http://192.168.0.101:4200/test-network.html
echo 🏠 App principal: http://192.168.0.101:4200
echo 🖥️ En tu PC: http://localhost:4200/test-network.html
echo 🔧 Backend health: http://192.168.0.101:3000/health
echo.
echo ⚠️  IMPORTANTE: 
echo    - Si tu portátil se suspende, ejecuta este script de nuevo
echo    - Para evitar suspensión: Configuración → Energía → Suspender "Nunca"
echo    - Este script detecta servicios activos y no los duplica
echo.
echo 📱 Luego abre en tu móvil: http://192.168.0.101:4200/test-network.html
echo.
pause