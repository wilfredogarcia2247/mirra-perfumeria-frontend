import { useState, useEffect } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  onImageUpload: (url: string) => void;
  existingImageUrl?: string;
}

export default function ImageUpload({ onImageUpload, existingImageUrl }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(existingImageUrl || '');
  const [error, setError] = useState('');

  // For debugging - check if env vars are loaded
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dugehux1b'; // Using your cloud name from the error
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'aroma-zenith'; // Make sure this matches your Cloudinary upload preset

  // Log environment variables (remove in production)
  useEffect(() => {
    console.log('Cloudinary Config:', {
      cloudName: CLOUD_NAME,
      uploadPreset: UPLOAD_PRESET,
      env: {
        VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
        VITE_CLOUDINARY_UPLOAD_PRESET: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
      }
    });
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match('image.*')) {
      setError('Por favor, sube un archivo de imagen válido');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe pesar más de 5MB');
      return;
    }

    setError('');
    setPreviewUrl(URL.createObjectURL(file));
    await uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      const errorMsg = 'Error de configuración: faltan credenciales de Cloudinary';
      console.error(errorMsg, { CLOUD_NAME, UPLOAD_PRESET });
      setError(errorMsg);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('cloud_name', CLOUD_NAME);
    formData.append('folder', 'aroma-zenith/products');

    console.log('Uploading file to Cloudinary...', {
      cloudName: CLOUD_NAME,
      uploadPreset: UPLOAD_PRESET,
      file: { name: file.name, type: file.type, size: file.size }
    });

    try {
      setIsUploading(true);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const responseData = await response.json();
      console.log('Cloudinary response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || 'Error al subir la imagen');
      }

      onImageUpload(responseData.secure_url);
    } catch (err) {
      console.error('Error uploading image:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al subir la imagen';
      setError(`Error: ${errorMessage}. Por favor, verifica tus credenciales de Cloudinary.`);
      setPreviewUrl('');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center justify-center w-full">
        <label
          htmlFor="file-upload"
          className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer ${
            isUploading ? 'bg-gray-50' : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-gray-400'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center p-6">
              <Loader2 className="w-8 h-8 mb-2 text-gray-500 animate-spin" />
              <span className="text-sm text-gray-500">Subiendo imagen...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center p-6">
              <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">
                <span className="font-medium text-indigo-600 hover:text-indigo-500">Sube un archivo</span> o arrástralo aquí
              </p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF hasta 5MB</p>
            </div>
          )}
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>

      {previewUrl && !isUploading && (
        <div className="mt-2">
          <p className="text-sm text-gray-600 mb-1">Vista previa:</p>
          <div className="relative w-full h-40 bg-gray-100 rounded-md overflow-hidden">
            <img
              src={previewUrl}
              alt="Vista previa"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      
      {!CLOUD_NAME || !UPLOAD_PRESET ? (
        <p className="text-sm text-red-600">
          Advertencia: Las credenciales de Cloudinary no están configuradas correctamente.
        </p>
      ) : null}
    </div>
  );
}
