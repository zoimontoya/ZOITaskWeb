---
applyTo: "**/*"
description: "Validacion minima obligatoria tras cambios en Angular, backend Node y despliegue Docker; usar cuando se implementan fixes, optimizaciones o refactors."
---

# Validacion minima obligatoria por tecnologia

## Regla general
- Tras cualquier cambio de codigo o configuracion, ejecutar verificaciones tecnicas minimas antes de cerrar la tarea.
- Si una verificacion no puede ejecutarse, indicarlo de forma explicita y proponer validacion manual equivalente.

## Frontend (Angular)
- Ejecutar build de frontend: npm run build
- Si el build falla, corregir errores relacionados con el cambio antes de continuar.
- Como smoke check, validar carga basica de la app y ruta principal.

## Backend (Node)
- Verificar sintaxis del backend cuando aplique: node -c backend/index.js
- Si se modifica logica de API, validar arranque y endpoint de salud: GET /health
- Confirmar que variables de entorno requeridas siguen presentes cuando el cambio las afecte.

## Despliegue (Docker)
- Validar compose y build de servicios afectados: docker compose build
- En cambios de despliegue, levantar y comprobar estado: docker compose up -d y docker compose ps
- Ejecutar health check posterior al despliegue y revisar logs si hay errores.

## Criterio de salida
- No marcar como completado un cambio relevante sin evidencia de verificacion minima (automatica o manual).
- Priorizar siempre estabilidad funcional sobre optimizacion agresiva.
