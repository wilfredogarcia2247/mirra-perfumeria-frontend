# Etapa 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar dependencias primero (mejor cache)
COPY package*.json ./
RUN npm ci

# Copiar el resto del código
COPY . .

# --- Build-time args (lo que Vite necesita EN build) ---
ARG VITE_API_URL
ARG VITE_MINIO_ENDPOINT
ARG VITE_MINIO_BUCKET
ARG VITE_CLOUDINARY_CLOUD_NAME
ARG VITE_CLOUDINARY_UPLOAD_PRESET

# Exportarlos al entorno SOLO para el build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MINIO_ENDPOINT=${VITE_MINIO_ENDPOINT}
ENV VITE_MINIO_BUCKET=${VITE_MINIO_BUCKET}
ENV VITE_CLOUDINARY_CLOUD_NAME=${VITE_CLOUDINARY_CLOUD_NAME}
ENV VITE_CLOUDINARY_UPLOAD_PRESET=${VITE_CLOUDINARY_UPLOAD_PRESET}

# (Opcional pero útil) imprime para verificar en logs que llegaron los args
RUN echo "VITE_API_URL=$VITE_API_URL" && npm run build


# Etapa 2: Production
FROM node:20-alpine AS production
WORKDIR /app

RUN npm install -g sirv-cli

# Copiar build final
COPY --from=builder /app/dist ./dist

# Puerto del contenedor (Dokploy apunta a 80)
EXPOSE 80

# Importante: usar exec form y sh -c para expandir ${PORT}
CMD ["sh", "-c", "npx sirv dist --single --host 0.0.0.0 --port ${PORT:-80}"]
