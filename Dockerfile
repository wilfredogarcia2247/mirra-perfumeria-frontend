# Etapa 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto del código
COPY . .

# Declarar argumentos de build para variables de entorno
ARG VITE_API_URL
ARG VITE_MINIO_ENDPOINT
ARG VITE_MINIO_BUCKET
ARG VITE_CLOUDINARY_CLOUD_NAME
ARG VITE_CLOUDINARY_UPLOAD_PRESET

# Exportar como variables de entorno para el build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MINIO_ENDPOINT=$VITE_MINIO_ENDPOINT
ENV VITE_MINIO_BUCKET=$VITE_MINIO_BUCKET
ENV VITE_CLOUDINARY_CLOUD_NAME=$VITE_CLOUDINARY_CLOUD_NAME
ENV VITE_CLOUDINARY_UPLOAD_PRESET=$VITE_CLOUDINARY_UPLOAD_PRESET

# Build de la aplicación
RUN npm run build

# Etapa 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Instalar sirv-cli globalmente para servir archivos estáticos
RUN npm install -g sirv-cli

# Copiar los archivos construidos desde la etapa de build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Exponer el puerto (Dokploy usa la variable PORT)
EXPOSE 80

# Comando para iniciar la aplicación
CMD npx sirv dist --single --host 0.0.0.0 --port ${PORT:-80}
