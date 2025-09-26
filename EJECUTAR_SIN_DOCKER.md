# 🚀 Instrucciones para Ejecutar Sin Docker (Mientras Solucionamos Docker)

## ✅ **Método Rápido y Confiable**

### **Terminal 1 - Backend:**
```powershell
cd C:\Users\partes.ZOI\Desktop\ZOITaskWeb\ZOITaskWeb\backend
npm install
node index.js
```

### **Terminal 2 - Frontend:**
```powershell
cd C:\Users\partes.ZOI\Desktop\ZOITaskWeb\ZOITaskWeb
npm install
ng serve --host 0.0.0.0 --disable-host-check --port 4200
```

### **Terminal 3 - Obtener tu IP:**
```powershell
ipconfig | findstr "192.168"
```

## 🌐 **Acceso a la Aplicación:**

- **Tu PC:** `http://localhost:4200`
- **Otros dispositivos WiFi:** `http://[TU_IP]:4200`

## 🔧 **Estado de Docker:**

Docker Desktop tiene problemas de I/O en el almacenamiento. Esto es común y se soluciona con:

1. **Reset completo de Docker Desktop:**
   - Configuración → Troubleshoot → Reset to factory defaults
   - Reiniciar Windows
   - Reinstalar Docker Desktop si es necesario

2. **Verificar espacio en disco:**
   - Docker necesita al menos 4-5GB libres
   - Limpiar archivos temporales

## 🎯 **Recomendación:**

**Para mostrar la aplicación HOY:** Usa el método sin Docker arriba
**Para Docker:** Dedícale tiempo otro día para un reset completo

## 📱 **Compartir con Otros Dispositivos:**

1. Ejecuta los comandos de arriba
2. Comparte: `http://[TU_IP]:4200`
3. ¡Listo!

---

**El método sin Docker es 100% funcional y profesional** ✅