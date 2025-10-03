@echo off
echo 🚀 ZOI Task - Configuración Simple de Red
echo =========================================

echo.
echo 🛑 Cerrando procesos anteriores...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo 📋 Tu IP actual:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo    Backend: http://%%b:3000
        echo    Frontend: http://%%b:4200
    )
)

echo.
echo 🔧 Iniciando Backend en TODA LA RED (0.0.0.0:3000)...
start "Backend ZOI" cmd /k "cd backend && echo 🚀 Backend accesible desde cualquier dispositivo && node index.js"

echo.
echo ⏳ Esperando que inicie el backend...
timeout /t 5 /nobreak >nul

echo.
echo 🧪 Probando backend desde localhost...
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Backend funciona localmente
) else (
    echo ❌ PROBLEMA: Backend no responde
    pause
    exit
)

echo.
echo 🔧 Iniciando Frontend SIN PROXY (más simple)...
start "Frontend ZOI" cmd /k "echo 🚀 Frontend sin proxy - conexión directa al backend && ng serve --host 0.0.0.0 --disable-host-check"

echo.
echo 🎯 URLs PARA PROBAR:
echo ===================
echo 📱 MÓVIL - App principal: http://192.168.0.101:4200
echo 📱 MÓVIL - Página de test: http://192.168.0.101:4200/test-network.html  
echo 📱 MÓVIL - Backend directo: http://192.168.0.101:3000/health
echo.
echo 🖥️  PC - App principal: http://localhost:4200
echo 🖥️  PC - Página de test: http://localhost:4200/test-network.html
echo 🖥️  PC - Backend directo: http://localhost:3000/health
echo.
echo ⚠️  IMPORTANTE: 
echo    - Espera 15 segundos a que compile Angular
echo    - Ambos servidores están accesibles desde cualquier dispositivo
echo    - NO usamos proxy, conexión directa al backend
echo.
pause