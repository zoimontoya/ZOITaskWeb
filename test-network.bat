@echo off
echo 🚀 SCRIPT DE DIAGNÓSTICO DE RED
echo ================================

echo.
echo 📋 Paso 1: Verificar IP actual
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo Tu IP es: %%b
    )
)

echo.
echo 📋 Paso 2: Iniciando Backend en localhost:3000
echo Presiona Ctrl+C para parar el backend cuando termine
start cmd /k "cd backend && echo Backend iniciado... && node index.js"

echo.
echo ⏳ Esperando 3 segundos para que inicie el backend...
timeout /t 3 /nobreak >nul

echo.
echo 📋 Paso 3: Probando backend desde localhost
curl -s http://localhost:3000/health
if %errorlevel%==0 (
    echo ✅ Backend responde correctamente
) else (
    echo ❌ Backend no responde - verifica que esté iniciado
    pause
    exit
)

echo.
echo 📋 Paso 4: Iniciando Frontend con proxy de red
echo Esto abrirá el frontend en http://192.168.0.101:4200
start cmd /k "echo Frontend iniciado... && ng serve --host 0.0.0.0 --disable-host-check --proxy-config proxy-network.conf.json"

echo.
echo 🎯 INSTRUCCIONES:
echo ================
echo 1. Abre tu navegador de PC en: http://localhost:4200
echo 2. Ve a: http://localhost:4200/test-network.html
echo 3. Haz clic en los botones de prueba
echo 4. Si funciona en PC, prueba desde el móvil: http://192.168.0.101:4200/test-network.html
echo.
echo 📱 En el móvil, toca los botones de prueba para ver qué pasa
echo.
pause