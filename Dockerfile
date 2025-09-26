# Dockerfile simplificado para Angular
FROM node:18-alpine AS build

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json primero para aprovechar cache
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY src/ ./src/
COPY angular.json tsconfig*.json ./

# Construir aplicación
RUN npm run build

# Etapa de producción con Nginx
FROM nginx:alpine

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copiar archivos compilados
COPY --from=build /app/dist/essentials /usr/share/nginx/html

# Exponer puerto
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]