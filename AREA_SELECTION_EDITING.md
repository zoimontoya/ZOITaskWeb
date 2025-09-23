# Implementación de Barras de Selección de Área para Edición de Tareas

## ✅ Funcionalidades Implementadas

### 1. **Creación de Tareas**
- ✅ Barras de selección de área por invernadero
- ✅ Validación de área > 0 para cada invernadero
- ✅ Sincronización entre slider y input numérico
- ✅ Envío del valor exacto como `dimension_total`

### 2. **Edición de Tareas** (NUEVO)
- ✅ Selección automática del invernadero existente
- ✅ Barra de área pre-configurada con el valor actual
- ✅ Posibilidad de modificar el área durante la edición
- ✅ Preservación del valor editado al guardar

## 🔧 Cambios Implementados

### Frontend (newTask.component.ts)
```typescript
// Método mejorado para manejar edición
initFormFromTask() {
  if (this.task) {
    // Configurar área de trabajo actual de la tarea
    if (this.task.invernadero) {
      this.workingAreas = {};
      const currentArea = parseFloat(this.task.dimension_total) || 0;
      this.workingAreas[this.task.invernadero] = currentArea;
    }
    // ... resto de la inicialización
  }
}

// Método mejorado para mostrar invernaderos durante edición
getSelectedInvernaderos(): string[] {
  // Durante la edición, mostrar el invernadero aunque aún no esté seleccionado
  if (this.task && this.task.invernadero && (!this.invernaderoSelection || this.invernaderoSelection.invernaderos.length === 0)) {
    return [this.task.invernadero];
  }
  return this.invernaderoSelection?.invernaderos || [];
}
```

### Frontend (newTask.component.html)
```html
<!-- Pasar el invernadero inicial al selector -->
<app-invernadero-selector
  [initialValue]="task?.invernadero || ''"
  (selectionChange)="onInvernaderoSelectionChange($event)">
</app-invernadero-selector>
```

### Componente Selector (invernadero-selector.component.ts)
```typescript
// Nuevo método para selección automática
selectInitialValue() {
  // Buscar el invernadero en los cabezales y seleccionarlo
  for (const cabezal of this.cabezales) {
    const invernadero = cabezal.invernaderos.find(inv => inv.nombre === this.initialValue);
    if (invernadero) {
      // Seleccionar el invernadero
      this.selectedInvernaderos.add(this.initialValue);
      // Expandir el cabezal correspondiente
      this.expandedCabezales.add(cabezal.nombre);
      // Emitir la selección
      this.emitSelection();
      break;
    }
  }
}
```

### Backend (index.js)
```javascript
// Ya estaba implementado correctamente:
// UPDATE (edit task)
Number(req.body.dimension_total) || 0, // Línea 450
// CREATE (new task)  
dimensionTotalSeleccionada, // Línea 619
```

## 🎯 Flujo de Edición

1. **Usuario hace clic en "Editar Tarea"**
   - `onStartEditTask()` pasa la tarea al componente newTask
   - `initFormFromTask()` configura `workingAreas[invernadero] = currentArea`

2. **Componente se inicializa**
   - `invernadero-selector` recibe `initialValue = task.invernadero`
   - Se llama `selectInitialValue()` que selecciona automáticamente el invernadero
   - `getSelectedInvernaderos()` devuelve el invernadero (incluso antes de la selección automática)

3. **Barras de área se muestran**
   - La barra muestra el valor actual de `task.dimension_total`
   - Usuario puede ajustar el área con slider o input numérico
   - `updateWorkingArea()` actualiza el valor en tiempo real

4. **Usuario guarda cambios**
   - `onSubmit()` envía `dimension_total: workingArea` (valor de la barra)
   - Backend recibe y guarda el nuevo valor en Google Sheets

## 🔄 Casos de Uso

### Caso 1: Editar área sin cambiar invernadero
```
Tarea original: Invernadero A, 5.2 hectáreas
Usuario ajusta barra: 3.8 hectáreas
Resultado: Se guarda con 3.8 hectáreas
```

### Caso 2: Cambiar invernadero durante edición
```
Tarea original: Invernadero A, 5.2 hectáreas
Usuario selecciona: Invernadero B (7 hectáreas máx)
Barra se inicializa: 7 hectáreas (área máxima del nuevo invernadero)
Usuario ajusta: 4.5 hectáreas
Resultado: Se guarda Invernadero B con 4.5 hectáreas
```

## ✅ Testing Manual

1. **Crear una tarea nueva**: ✅ Funciona
2. **Editar tarea existente**: ✅ Se muestra área actual
3. **Cambiar área durante edición**: ✅ Se guarda nuevo valor
4. **Cambiar invernadero durante edición**: ✅ Se resetea área
5. **Validaciones**: ✅ Área debe ser > 0

## 🎉 Resultado Final

La funcionalidad de barras de selección de área ahora funciona completamente tanto para **creación** como para **edición** de tareas. Los usuarios pueden:

- ✅ Ver el área actual de una tarea al editarla
- ✅ Modificar el área usando las barras intuitivas
- ✅ Cambiar de invernadero y configurar nueva área
- ✅ Guardar los cambios con el valor exacto seleccionado