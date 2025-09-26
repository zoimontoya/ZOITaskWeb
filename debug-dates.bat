@echo off
echo 🔍 Debug Toggle Fechas - ZOI Task
echo ==================================

echo.
echo 🔧 Iniciando Backend...
start "Backend" cmd /k "cd backend && echo ✅ Backend iniciado && node index.js"

echo.
echo ⏳ Esperando backend (3 segundos)...
timeout /t 3 /nobreak >nul

echo.
echo 🔧 Iniciando Frontend...
start "Frontend" cmd /k "echo ✅ Frontend iniciado && ng serve"

echo.
echo 🎯 PRUEBA DEL TOGGLE DE FECHAS - MEJORADO:
echo ==========================================
echo 1. Ve a http://localhost:4200
echo 2. Crear nueva tarea
echo 3. Selecciona 2+ invernaderos
echo 4. Fíjate en el DEBUG amarillo que muestra el estado
echo 5. Por defecto useIndividualDates = false
echo 6. Debería aparecer "Fecha para todos" arriba
echo 7. PRUEBA BIDIRECCIONAL:
echo    A) Activa el toggle "Fecha individual por invernadero"
echo       → useIndividualDates = true
echo       → "Fecha para todos" desaparece (display: none)
echo       → Fechas individuales aparecen en cada bloque
echo    
echo    B) Desactiva el toggle (vuélvelo a OFF)
echo       → useIndividualDates = false  
echo       → Fechas individuales desaparecen (display: none)
echo       → "Fecha para todos" vuelve a aparecer (display: block)
echo
echo 8. PRUEBA MANUAL: Usa botón "🔄 Cambiar Toggle Manual"
echo 9. Abre F12 para ver mensajes detallados en consola
echo.
echo 🔍 CAMBIOS TÉCNICOS:
echo - Cambié *ngIf por [style.display] para evitar problemas de Angular
echo - Cambié (change) por (ngModelChange) para mejor timing
echo - Agregué botón manual para debug independiente del toggle
echo.
pause