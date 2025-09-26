# Dockerfile simplificado para el backend
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar el código fuente
COPY index.js ./

# Exponer el puerto
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["node", "index.js"]