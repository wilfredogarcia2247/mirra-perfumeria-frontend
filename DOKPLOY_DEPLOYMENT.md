# 🚀 Guía de Despliegue en Dokploy

## Prerrequisitos

- Cuenta en Dokploy
- Repositorio Git con tu código
- Variables de entorno configuradas

## 📝 Pasos para Desplegar

### 1. Crear Nuevo Proyecto en Dokploy

1. Accede a tu panel de Dokploy
2. Click en **"New Application"** o **"Crear Aplicación"**
3. Selecciona **"Git Repository"**

### 2. Configurar el Repositorio

- **Repository URL**: Tu URL de GitHub/GitLab
- **Branch**: `main` o la rama que uses
- **Build Method**: Selecciona **"Dockerfile"**

### 3. Variables de Entorno Requeridas

En la sección de **Environment Variables**, agrega las siguientes variables (ajusta según tu `.env`):

```env
# API Backend
VITE_API_URL=https://tu-backend.dokploy.app

# Cloudinary (si aplica)
VITE_CLOUDINARY_CLOUD_NAME=tu_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=tu_preset

# MinIO (si aplica)
VITE_MINIO_ENDPOINT=https://tu-minio.dokploy.app
VITE_MINIO_BUCKET=mirra-img

# Otras variables que tengas en tu .env
```

> [!IMPORTANT]
> **NO** incluyas el archivo `.env` en tu repositorio. Todas las variables deben configurarse en Dokploy.

### 4. Configuración de Puerto

Dokploy asigna automáticamente el puerto mediante la variable `PORT`. El Dockerfile ya está configurado para usar esta variable.

### 5. Desplegar

1. Click en **"Deploy"** o **"Desplegar"**
2. Espera a que el build termine (puede tomar 2-5 minutos)
3. Una vez completado, Dokploy te dará una URL pública

## 🔧 Configuración Adicional (Opcional)

### Dominio Personalizado

1. Ve a la sección **"Domains"** en tu aplicación
2. Agrega tu dominio personalizado
3. Configura los DNS según las instrucciones de Dokploy

### Health Checks

Dokploy puede verificar que tu app esté funcionando:

- **Health Check Path**: `/`
- **Port**: El puerto asignado por Dokploy

### Recursos

Ajusta los recursos según tus necesidades:

- **Memory**: 512MB - 1GB (recomendado para frontend)
- **CPU**: 0.5 - 1 vCPU

## 🐛 Troubleshooting

### Build Falla

1. Verifica que todas las dependencias estén en `package.json`
2. Revisa los logs de build en Dokploy
3. Asegúrate de que `npm run build` funcione localmente

### App no Carga

1. Verifica que las variables de entorno estén correctamente configuradas
2. Revisa los logs de la aplicación
3. Asegúrate de que el puerto esté correctamente expuesto

### Errores de CORS

Si tu frontend no puede conectarse al backend:

1. Verifica que `VITE_API_URL` apunte al backend correcto
2. Configura CORS en tu backend para permitir el dominio de Dokploy

## 📊 Monitoreo

Dokploy proporciona:

- **Logs en tiempo real**: Para debugging
- **Métricas de uso**: CPU, memoria, red
- **Historial de deploys**: Para rollback si es necesario

## 🔄 Actualizar la Aplicación

Para desplegar cambios:

1. Haz push a tu repositorio Git
2. Dokploy detectará los cambios automáticamente (si tienes auto-deploy activado)
3. O manualmente click en **"Redeploy"**

## ✅ Verificación Post-Despliegue

1. Accede a la URL proporcionada por Dokploy
2. Verifica que la aplicación cargue correctamente
3. Prueba las funcionalidades principales
4. Verifica la conexión con el backend

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs en Dokploy
2. Verifica la documentación oficial de Dokploy
3. Contacta al soporte de Dokploy si es necesario
