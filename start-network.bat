@echo off
echo 🚀 ZOI Task - Iniciar Servidores de Red
echo ========================================

echo.
echo 📋 Tu IP actual:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo    http://%%b:4200
    )
)

echo.
echo � Cerrando procesos anteriores...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo �🔧 Iniciando Backend (localhost:3000)...
start "Backend ZOI" cmd /k "cd backend && echo 🚀 Iniciando backend... && node index.js && echo ❌ Backend se cerró inesperadamente && pause"

echo.
echo ⏳ Esperando que inicie el backend...
timeout /t 5 /nobreak >nul

echo.
echo 🧪 Probando si el backend responde...
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Backend está funcionando correctamente
) else (
    echo ❌ PROBLEMA: Backend no responde en localhost:3000
    echo 🔍 Verifica el terminal del backend para ver errores
    echo.
    pause
)

echo.
echo 🔧 Iniciando Frontend con proxy de red...
start "Frontend ZOI" cmd /k "echo 🚀 Iniciando frontend con proxy... && ng serve --host 0.0.0.0 --disable-host-check --proxy-config proxy-network.conf.json"

echo.
echo 🎯 URLs IMPORTANTES:
echo ===================
echo 📱 Página de pruebas: http://192.168.0.101:4200/test-network.html
echo 🏠 App principal: http://192.168.0.101:4200
echo 🖥️ En tu PC: http://localhost:4200/test-network.html
echo.
echo ⚠️  IMPORTANTE: 
echo    1. Espera 10-15 segundos a que compile Angular
echo    2. Verifica que el terminal del Backend no muestre errores
echo    3. Si hay errores, cierra todo y ejecuta de nuevo
echo.
echo 📱 Luego abre en tu móvil: http://192.168.0.101:4200/test-network.html
echo.
pause