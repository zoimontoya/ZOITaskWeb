@echo off
chcp 65001 > nul
echo 🔍 Script de diagnóstico de red y servicios
echo ==========================================
echo.

echo 📍 1. Verificando IP actual de tu PC...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set IP=%%a
    set IP=!IP: =!
    echo    IP encontrada: !IP!
)

echo.
echo 🔌 2. Verificando puertos en uso...
echo    Puerto 3000 (Backend):
netstat -an | findstr ":3000" | findstr "LISTENING"
if %errorlevel% == 0 (echo    ✅ Backend corriendo) else (echo    ❌ Backend NO corriendo)

echo    Puerto 4200 (Frontend):
netstat -an | findstr ":4200" | findstr "LISTENING" 
if %errorlevel% == 0 (echo    ✅ Frontend corriendo) else (echo    ❌ Frontend NO corriendo)

echo.
echo 🔥 3. Verificando Firewall (requiere permisos admin)...
netsh advfirewall firewall show rule name="Node.js Backend" > nul 2>&1
if %errorlevel% == 0 (echo    ✅ Regla firewall Backend existe) else (echo    ⚠️  Regla firewall Backend no encontrada)

netsh advfirewall firewall show rule name="Angular Frontend" > nul 2>&1
if %errorlevel% == 0 (echo    ✅ Regla firewall Frontend existe) else (echo    ⚠️  Regla firewall Frontend no encontrada)

echo.
echo 🌐 4. URLs para probar:
echo    Desde este PC:
echo       http://localhost:4200
echo       http://localhost:3000/health
echo.
echo    Desde otros dispositivos (actualiza la IP si es diferente):
echo       http://192.168.0.101:4200
echo       http://192.168.0.101:3000/health
echo.

echo ⚙️  5. Configuración de energía actual:
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | findstr "Configuración actual"

echo.
echo 💡 SOLUCIONES RÁPIDAS:
echo ====================
echo 1. Si backend/frontend no están corriendo: ejecuta start-network-safe.bat
echo 2. Si firewall bloquea (como admin): 
echo    netsh advfirewall firewall add rule name="Node.js Backend" dir=in action=allow protocol=TCP localport=3000
echo    netsh advfirewall firewall add rule name="Angular Frontend" dir=in action=allow protocol=TCP localport=4200
echo 3. Si IP cambió: actualiza environment.ts y proxy-network.conf.json
echo 4. Para evitar suspensión: Configuración Windows → Energía → Suspender "Nunca"
echo.
pause