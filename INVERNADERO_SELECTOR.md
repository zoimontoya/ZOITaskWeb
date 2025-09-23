# Selector Jerárquico de Invernaderos - Versión con Desplegable Principal

## Descripción
El componente `InvernaderoSelectorComponent` permite seleccionar múltiples invernaderos usando checkboxes, organizados jerárquicamente por cabezal dentro de un desplegable principal.

## Estructura de Navegación

### 🔽 **Nivel 1: Desplegable Principal**
- **Estado inicial**: Cerrado, muestra "Seleccionar invernaderos..."
- **Con selecciones**: Muestra "X invernadero(s) seleccionado(s)"
- **Click para abrir/cerrar**: Acceso a toda la lista de cabezales

### 🔽 **Nivel 2: Cabezales (dentro del desplegable)**
- **Estado inicial**: Todos contraídos, solo se ven nombres de cabezales
- **Flechita expandir/contraer**: ▶ / ▼ para mostrar/ocultar invernaderos
- **Checkbox cabezal**: Seleccionar todo el cabezal completo

### ☑️ **Nivel 3: Invernaderos (dentro de cada cabezal)**
- **Checkboxes individuales**: Para selección específica
- **Información detallada**: Nombre e área (m²)

## Interfaz Visual Completa

```
┌─────────────────────────────────────────────────────────┐
│ Invernaderos:                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 3 invernadero(s) seleccionado(s)              ▼    │ │ ← Desplegable Principal
│ ├─────────────────────────────────────────────────────┤ │
│ │ 📂 Cabezal A (3 invernaderos) ☐ Todo el cabezal ▶ │ │ ← Cabezal contraído
│ │ 📂 Cabezal B (2 invernaderos) ☑ Todo el cabezal ▼ │ │ ← Cabezal expandido
│ │    🏠 B1 (100m²) ☑                               │ │ ← Invernadero individual
│ │    🏠 B2 (95m²) ☑                                │ │
│ │ 📂 Cabezal C (4 invernaderos) ▣ Todo el cabezal ▼ │ │ ← Cabezal parcialmente seleccionado
│ │    🏠 C1 (120m²) ☑                               │ │
│ │    🏠 C2 (110m²) ☐                               │ │
│ │    🏠 C3 (105m²) ☑                               │ │
│ │    🏠 C4 (115m²) ☐                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Seleccionados (3):                                      │ ← Resumen de selección
│ 🏭 Cabezal B (cabezal completo)                         │
│ 🏠 C1                                                   │
│ 🏠 C3                                                   │
└─────────────────────────────────────────────────────────┘
```

## Flujo de Interacción

### 📱 **Secuencia de Uso**
1. **Click en desplegable principal** → Se abre la lista de cabezales
2. **Ver cabezales disponibles** → Todos aparecen contraídos inicialmente
3. **Click en flechita de cabezal** → Expande para mostrar invernaderos
4. **Selección rápida** → Checkbox del cabezal para seleccionar todos
5. **Selección específica** → Checkboxes individuales según necesidad
6. **Revisar selección** → Panel de resumen muestra todas las selecciones
7. **Click fuera o en header** → Cierra el desplegable manteniendo selecciones

### 🎯 **Estados del Desplegable Principal**
- **Cerrado + Sin selecciones**: "Seleccionar invernaderos..."
- **Cerrado + Con selecciones**: "X invernadero(s) seleccionado(s)"
- **Abierto**: Muestra toda la estructura de cabezales

### � **Estados de los Cabezales**
- **Contraído**: Solo nombre y contador de invernaderos
- **Expandido**: Muestra lista completa de invernaderos
- **Checkbox estados**:
  - ☐ **Vacío**: Ningún invernadero seleccionado
  - ☑ **Marcado**: Todo el cabezal seleccionado
  - ▣ **Indeterminado**: Algunos invernaderos seleccionados

## Características Técnicas

### 🔧 **Interfaz de Datos**
```typescript
interface InvernaderoSelection {
  invernaderos: string[];  // Todos los invernaderos seleccionados
  cabezales: string[];     // Cabezales completos seleccionados
}
```

### 🎨 **Controles de Estado**
```typescript
// Estados del componente
isMainDropdownOpen: boolean;     // Desplegable principal abierto/cerrado
expandedCabezales: Set<string>;  // Cabezales expandidos
selectedInvernaderos: Set<string>; // Invernaderos individuales
selectedCabezales: Set<string>;   // Cabezales completos
```

### 📊 **Métodos Principales**
```typescript
toggleMainDropdown()     // Abrir/cerrar desplegable principal
toggleCabezal(nombre)    // Expandir/contraer cabezal específico
toggleCabezalSelection() // Seleccionar/deseleccionar cabezal completo
toggleInvernaderoSelection() // Seleccionar/deseleccionar individual
```

## Ventajas del Diseño en 3 Niveles

### 🎯 **Eficiencia de Espacio**
- **Compacto**: Solo ocupa una línea cuando está cerrado
- **Escalable**: Maneja cualquier cantidad de cabezales e invernaderos
- **Ordenado**: Estructura jerárquica clara y navegable

### ⚡ **Facilidad de Uso**
- **Rápido**: Un click para abrir, otro para seleccionar cabezal completo
- **Específico**: Drill-down para selecciones detalladas
- **Visual**: Estados claros con iconos y colores diferenciados

### � **Flexibilidad**
- **Combinable**: Mezcla selecciones de cabezales completos e individuales
- **Persistente**: Mantiene selecciones al cerrar/abrir desplegable
- **Intuitivo**: Sigue patrones estándar de UI/UX

Esta implementación proporciona la máxima funcionalidad en el mínimo espacio, con una experiencia de usuario intuitiva y eficiente.