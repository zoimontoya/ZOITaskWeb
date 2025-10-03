# 🔋 Problema de Suspensión del Portátil

## 🚨 Problema Identificado
Cuando el portátil se suspende automáticamente:
- El backend Node.js se pausa
- El servidor Angular se pausa  
- Los dispositivos de la red pierden conexión
- Los servicios no se reinician automáticamente

## 💡 Soluciones Implementadas

### 1. Scripts Mejorados
- **`start-network-safe.bat`**: Verifica si los servicios ya están corriendo antes de iniciarlos
- **`diagnose-network.bat`**: Diagnóstica problemas de red y servicios

### 2. Configuración de Energía
Para evitar que el portátil se suspenda durante desarrollo:

**Método 1 - PowerShell (temporal):**
```powershell
# Evitar suspensión cuando está conectado
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 30
```

**Método 2 - Configuración Windows:**
1. `Configuración` → `Sistema` → `Energía y suspensión`
2. Configurar **"Suspender"** en **"Nunca"** (cuando está conectado)

### 3. Configuración de Firewall (si es necesario)
```powershell
# Ejecutar como administrador
netsh advfirewall firewall add rule name="Node.js Backend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Angular Frontend" dir=in action=allow protocol=TCP localport=4200
```

## 🔧 Uso de los Scripts

### Inicio Seguro
```batch
start-network-safe.bat
```
- Detecta si los servicios ya están corriendo
- Solo inicia los servicios que faltan
- No duplica procesos

### Diagnóstico
```batch
diagnose-network.bat  
```
- Verifica IP actual
- Comprueba puertos en uso
- Revisa configuración de firewall
- Muestra URLs para probar

## ⚠️ Recomendaciones de Desarrollo

1. **Durante desarrollo**: Configurar suspensión en "Nunca"
2. **Al terminar**: Restaurar configuración normal de energía
3. **Si se suspende accidentalmente**: Ejecutar `start-network-safe.bat`
4. **Problemas de conectividad**: Usar `diagnose-network.bat`

## 📱 URLs de Prueba
- **PC Local**: `http://localhost:4200`
- **Red Local**: `http://192.168.0.101:4200` (actualizar IP si cambia)
- **Backend Health**: `http://192.168.0.101:3000/health`
- **Test Network**: `http://192.168.0.101:4200/test-network.html`