# Reglas de estabilidad y cambios seguros

Estas instrucciones aplican a todo el proyecto.

## Prioridad principal
- No romper funcionalidades existentes que ya dan el resultado esperado.
- Si una mejora u optimizacion pone en riesgo comportamiento actual, priorizar estabilidad sobre cambio agresivo.

## Cambios en flujo
- Mantener los flujos actuales tal como estan, salvo que el usuario pida explicitamente cambiarlos.
- No alterar contratos de entrada/salida, rutas, validaciones o formatos sin autorizacion explicita.

## Mejoras y optimizaciones
- Proponer mejoras de forma incremental y reversible.
- Preferir cambios minimos con el mismo resultado funcional.
- Evitar refactors grandes si no son necesarios para el objetivo pedido.

## Cambios grandes
- Antes de cambios grandes, explicar con claridad:
  - que va a cambiar,
  - que partes puede impactar,
  - que se mantiene igual,
  - como se validara que no se rompio nada.
- Pedir confirmacion antes de aplicar cambios de alto impacto.

## Verificacion obligatoria
- Tras cada cambio relevante, ejecutar verificaciones tecnicas disponibles (build, lint, pruebas, o smoke checks equivalentes).
- Si no es posible verificar automaticamente, indicarlo de forma explicita y proponer pasos concretos de validacion manual.

## Regla de comunicacion
- Nunca asumir que un flujo puede cambiarse "porque parece mejor".
- Si hay duda entre mejorar y conservar, conservar y consultar primero.
