
import { useState, useEffect, useRef } from 'react';
import { Loader2, UploadCloud, X as XIcon, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImage as uploadImageToAPI } from '@/integrations/api';

interface ImageUploadProps {
  onImageUpload: (url: string) => void;
  existingImageUrl?: string;
  originalImageUrl?: string;
}

export default function ImageUpload({ onImageUpload, existingImageUrl, originalImageUrl }: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string>((existingImageUrl || '').replace('https://', 'http://'));
  const [error, setError] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);


  // Sync when parent tells us there's an existing image (e.g., opening the edit modal)
  useEffect(() => {
    setPreviewUrl((existingImageUrl || '').replace('https://', 'http://'));
  }, [existingImageUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAndUpload(file);
  };

  const processAndUpload = async (file: File) => {
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
    await handleImageUpload(file);
  };

  const handleImageUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadSuccess(false);

      // Simulate progress for better UX since we can't track real progress with fetch
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev === null) return 10;
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const response = await uploadImageToAPI(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.ok && response.url) {
        const httpUrl = response.url.replace('https://', 'http://');
        setPreviewUrl(httpUrl);
        onImageUpload(httpUrl);
        setUploadSuccess(true);
        toast.success('Imagen subida correctamente');
      } else {
        throw new Error(response.error || 'Error al subir la imagen');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error uploading image:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al subir la imagen';
      setError(`Error: ${errorMessage}`);
      setPreviewUrl('');
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 700);
      setTimeout(() => setUploadSuccess(false), 1200);
    }
  };

  const onDropHandler = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
      processAndUpload(file);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center justify-center w-full">
        <label
          htmlFor="file-upload"
          onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
          onDrop={onDropHandler}
          className={`relative flex items-center justify-center w-full h-48 border-2 rounded-lg cursor-pointer overflow-hidden transition-shadow ${
            isUploading ? 'bg-gray-50 shadow-inner' : 'bg-white hover:shadow-lg border-gray-200'
          } ${isDragOver ? 'ring-4 ring-primary/40' : ''}`}
        >
          <input
            ref={fileInputRef}
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />

          {/* Preview elegante */}
          {previewUrl ? (
            <div className="relative w-full h-full">
              <img
                src={previewUrl.replace('https://', 'http://')}
                alt="Vista previa"
                className="w-full h-full object-contain bg-gray-100"
              />

              {/* pequeño icono para eliminar la imagen (no un botón grande) */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreviewUrl(''); onImageUpload(''); }}
                className="absolute right-2 top-2 bg-white/80 rounded-full p-1 shadow-sm hover:bg-white"
                aria-label="Eliminar imagen"
              >
                <XIcon className="w-4 h-4 text-gray-600" />
              </button>

              {/* Badge que indica si es la imagen actual o una nueva */}
              <div className="absolute left-2 top-2 bg-white/90 px-2 py-0.5 rounded text-xs font-medium text-gray-700 shadow-sm">
                {originalImageUrl && previewUrl === originalImageUrl ? 'Imagen actual' : 'Nueva imagen'}
              </div>

              {/* overlay tipo Facebook al pasar hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
                <div className="bg-white/90 px-3 py-1 rounded-full flex items-center gap-2 shadow">
                  <Camera className="w-4 h-4 text-primary-600" />
                  <span className="text-sm text-primary-700 font-medium">Cambiar foto</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center">
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 mb-2 text-gray-500 animate-spin" />
                  <span className="text-sm text-gray-500">Subiendo imagen...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <UploadCloud className="w-10 h-10 mb-2 text-primary-600" />
                  <p className="text-sm text-gray-700">Haz clic o arrastra para subir</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF — máximo 5MB</p>
                </div>
              )}
            </div>
          )}

          {/* Progress bar (visible durante la subida) dentro del área */}
          {uploadProgress !== null && (
            <div className="absolute left-0 right-0 bottom-0 p-2">
              <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className="h-2 bg-primary"
                  style={{ width: `${uploadProgress}%`, transition: 'width 200ms linear' }}
                />
              </div>
              <div className="mt-1 text-xs text-center text-gray-600">{uploadProgress}%</div>
            </div>
          )}

        </label>
      </div>

      {previewUrl && !isUploading && (
        <div className="mt-1 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">Vista previa lista</p>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

    </div>
  );
}

