@echo off
echo 🎯 ZOI Task - Test Nueva Funcionalidad de Bloques
echo =================================================

echo.
echo 🔧 Iniciando Backend...
start "Backend ZOI" cmd /k "cd backend && echo ✅ Backend iniciado && node index.js"

echo.
echo ⏳ Esperando backend (5 segundos)...
timeout /t 5 /nobreak >nul

echo.
echo 🔧 Iniciando Frontend...
start "Frontend ZOI" cmd /k "echo ✅ Frontend iniciado && ng serve"

echo.
echo 🎯 URLs DE PRUEBA:
echo ==================
echo 🖥️  PC: http://localhost:4200
echo.
echo ✨ NUEVA FUNCIONALIDAD INTELIGENTE:
echo =====================================
echo.
echo 🔸 CON 1 INVERNADERO:
echo   - No aparecen toggles (innecesarios)
echo   - Título: "Configuración de la Tarea"
echo   - Un bloque simple con todos los campos
echo.
echo 🔸 CON MÚLTIPLES INVERNADEROS:
echo   - Aparecen toggles para fechas y encargados
echo   - Título: "Configuración por Invernadero"
echo   - Un bloque separado para cada invernadero
echo.
echo 🎛️ TOGGLES INTELIGENTES:
echo   📅 Toggle Fechas OFF → Campo "Fecha para todos" (global)
echo   📅 Toggle Fechas ON  → Campo fecha en cada bloque individual  
echo   👥 Toggle Encargado OFF → Campo "Encargado para todos" (global)
echo   👥 Toggle Encargado ON  → Campo encargado en cada bloque individual
echo.
echo 🎯 PRUEBAS SUGERIDAS:
echo   1. Selecciona 1 invernadero → Sin toggles, interfaz simple
echo   2. Selecciona 3 invernaderos → Toggles aparecen
echo   3. Activa/desactiva toggles → Campos aparecen/desaparecen
echo.
pause