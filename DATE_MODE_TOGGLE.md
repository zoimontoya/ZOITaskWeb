# Toggle de Fecha Límite - Una vs Individual

## Descripción
Nueva funcionalidad que permite al usuario elegir entre asignar una fecha límite única para todos los invernaderos seleccionados o fechas individuales para cada invernadero.

## Características Principales

### 🔄 **Toggle Inteligente**
- **Solo aparece** cuando se seleccionan múltiples invernaderos
- **Estado por defecto**: "Una fecha para todos" (más común)
- **Switch visual**: Toggle moderno con animaciones suaves
- **Feedback inmediato**: Cambia la interfaz al activar/desactivar

### 📱 **Estados de la Interfaz**

#### **Estado 1: Un Solo Invernadero Seleccionado**
```
┌─────────────────────────────────────────────┐
│ Estimación (horas): [5]                     │
│                                             │
│ Fecha límite para A1:                       │
│ [2025-09-30]                               │
└─────────────────────────────────────────────┘
```
*No se muestra el toggle, solo un campo de fecha*

#### **Estado 2: Múltiples Invernaderos - Fecha Única**
```
┌─────────────────────────────────────────────┐
│ Estimación (horas): [8]                     │
│                                             │
│ Fecha límite: [●────○] Una fecha para todos │ ← Toggle ON
│                                             │
│ Fecha límite para todos los invernaderos:   │
│ [2025-09-30]                               │
└─────────────────────────────────────────────┘
```

#### **Estado 3: Múltiples Invernaderos - Fechas Individuales**
```
┌─────────────────────────────────────────────┐
│ Estimación (horas): [8]                     │
│                                             │
│ Fecha límite: [○────●] Fecha individual por invernadero │ ← Toggle OFF
│                                             │
│ Fechas límite por invernadero:              │
│ A1: [2025-09-30]                           │
│ A2: [2025-10-05]                           │
│ B1: [2025-10-02]                           │
└─────────────────────────────────────────────┘
```

## Lógica de Funcionamiento

### 🎯 **Comportamiento del Toggle**

#### **Inicialización**
```typescript
useSingleDate = true;  // Por defecto, fecha única
singleDate = '';       // Campo para la fecha única
dueDates = {};         // Objeto para fechas individuales
```

#### **Al Cambiar Selección de Invernaderos**
1. **Limpia** campos de fecha anteriores
2. **Evalúa** cuántos invernaderos están seleccionados
3. **Muestra/oculta** el toggle según corresponda
4. **Configura** campos de fecha según el modo actual

#### **Al Cambiar el Toggle**
```typescript
onDateModeToggle() {
  this.useSingleDate = !this.useSingleDate;
  this.updateDateFields(); // Reconfigura campos de fecha
}
```

### 📊 **Validación Inteligente**

#### **Modo Fecha Única**
```typescript
if (this.useSingleDate) {
  if (!this.singleDate) {
    alert('Por favor, selecciona la fecha límite.');
    return;
  }
}
```

#### **Modo Fechas Individuales**
```typescript
if (!this.useSingleDate) {
  const missingDates = selectedInvernaderos.some(g => !this.dueDates[g]);
  if (missingDates) {
    alert('Por favor, selecciona una fecha límite para cada invernadero.');
    return;
  }
}
```

### 🔄 **Generación de Tareas**

#### **Asignación de Fechas**
```typescript
const fechaLimite = this.useSingleDate ? this.singleDate : this.dueDates[g];

const data = {
  invernadero: g,
  fecha_limite: fechaLimite,
  // ... otros campos
};
```

#### **Resultado Final**
- **Fecha única**: Todas las tareas tienen la misma fecha límite
- **Fechas individuales**: Cada tarea tiene su fecha específica

## Experiencia de Usuario

### ✨ **Casos de Uso Comunes**

#### **Caso 1: Tarea Urgente para Múltiples Invernaderos**
```
Usuario: "Necesito fumigar A1, A2 y B1 antes del viernes"
Acción: Toggle ON → Fecha única → 2025-09-27
Resultado: 3 tareas con fecha límite 2025-09-27
```

#### **Caso 2: Tarea Escalonada por Prioridades**
```
Usuario: "Riego de A1 el lunes, A2 el miércoles, B1 el viernes"
Acción: Toggle OFF → Fechas individuales
Resultado: 
- A1: 2025-09-23
- A2: 2025-09-25  
- B1: 2025-09-27
```

#### **Caso 3: Un Solo Invernadero**
```
Usuario: Selecciona solo A1
Interface: No muestra toggle, solo campo de fecha simple
Comportamiento: Igual que antes, directo y simple
```

### 🎨 **Elementos Visuales**

#### **Toggle Switch**
- **Estado ON**: Verde (#73ca7a), slider a la derecha
- **Estado OFF**: Gris (#ccc), slider a la izquierda
- **Animación**: Transición suave de 0.3s
- **Texto dinámico**: Cambia según el estado

#### **Campos de Fecha**
- **Fecha única**: Fondo verde claro, más prominente
- **Fechas individuales**: Fondo gris claro, lista vertical
- **Validación visual**: Bordes rojos para campos requeridos vacíos

#### **Responsive Design**
- **Desktop**: Toggle horizontal con texto completo
- **Mobile**: Toggle más compacto, texto abreviado
- **Accesibilidad**: Navegable por teclado, labels claros

## Beneficios de la Implementación

### 🚀 **Para el Usuario**
- **Flexibilidad total**: Puede elegir el modo más apropiado
- **Ahorro de tiempo**: Fecha única para casos comunes
- **Precisión**: Fechas individuales cuando es necesario
- **Interfaz intuitiva**: Toggle claro y fácil de entender

### 📈 **Para el Workflow**
- **Tareas homogéneas**: Misma fecha para operaciones coordinadas
- **Tareas escalonadas**: Fechas específicas para planificación detallada
- **Adaptabilidad**: Se ajusta a diferentes tipos de operaciones
- **Consistencia**: Mantiene la lógica existente del sistema

### 🛠️ **Para el Desarrollo**
- **Código limpio**: Lógica bien separada entre modos
- **Reutilizable**: Toggle puede usarse en otros formularios
- **Mantenible**: Estados y validaciones claramente definidas
- **Escalable**: Fácil agregar nuevas opciones de fecha en el futuro

Esta implementación mejora significativamente la usabilidad del formulario de creación de tareas, permitiendo a los usuarios elegir la estrategia de fechas más adecuada para cada situación específica.