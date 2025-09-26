# 📦 Instalación de Docker para ZOI Task Web

## 🚀 Guía de Instalación Rápida

### Windows

1. **Descargar Docker Desktop:**
   - Ve a: https://www.docker.com/products/docker-desktop/
   - Descarga "Docker Desktop for Windows"
   - Ejecuta el instalador

2. **Requisitos:**
   - Windows 10/11 (64-bit)
   - Habilitar WSL 2 (Windows Subsystem for Linux)
   - Habilitar Hyper-V (se hace automáticamente)

3. **Instalación:**
   - Ejecuta el instalador descargado
   - Sigue las instrucciones del asistente
   - Reinicia cuando se solicite
   - Inicia Docker Desktop desde el menú de inicio

4. **Verificar instalación:**
   ```cmd
   docker --version
   docker compose version
   ```

### macOS

1. **Descargar Docker Desktop:**
   - Ve a: https://www.docker.com/products/docker-desktop/
   - Descarga "Docker Desktop for Mac"

2. **Instalación:**
   - Abre el archivo .dmg descargado
   - Arrastra Docker a Applications
   - Inicia Docker desde Applications

### Linux (Ubuntu/Debian)

```bash
# Actualizar paquetes
sudo apt update

# Instalar dependencias
sudo apt install apt-transport-https ca-certificates curl gnupg lsb-release

# Añadir clave GPG de Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Añadir repositorio
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Añadir usuario al grupo docker
sudo usermod -aG docker $USER

# Cerrar y abrir sesión, luego verificar
docker --version
docker compose version
```

## ✅ Verificación Post-Instalación

Después de instalar Docker, verifica que todo funciona:

```bash
# Verificar Docker
docker --version

# Verificar Docker Compose
docker compose version

# Probar Docker con un contenedor de prueba
docker run hello-world
```

## 🎯 Siguiente Paso

Una vez instalado Docker, regresa al archivo `DOCKER_README.md` para desplegar tu aplicación ZOI Task Web.

## 🆘 Problemas Comunes

### Windows: "Docker Desktop starting..." por mucho tiempo
**Solución:**
1. Reinicia Docker Desktop
2. Reinicia tu computadora
3. Verifica que WSL 2 esté instalado
4. Ejecuta como administrador si es necesario

### Linux: "Permission denied" al ejecutar docker
**Solución:**
```bash
sudo usermod -aG docker $USER
# Cerrar y abrir sesión
```

### macOS: "Docker Desktop is starting"
**Solución:**
1. Verifica que tengas suficiente espacio en disco
2. Reinicia Docker Desktop
3. Reinicia tu Mac si es necesario

## 📚 Recursos Adicionales

- [Documentación oficial de Docker](https://docs.docker.com/get-started/)
- [Guía de Docker Compose](https://docs.docker.com/compose/gettingstarted/)
- [Troubleshooting Docker Desktop](https://docs.docker.com/desktop/troubleshoot/overview/)