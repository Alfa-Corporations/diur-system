const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_DIMENSION = 1280;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

const readImage = async (file: File): Promise<DecodedImage> => {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
        image.src = url;
      });
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'No se pudo leer la imagen seleccionada.') throw error;
    throw new Error('No se pudo leer la imagen seleccionada.');
  }
};

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('No se pudo convertir la imagen.'));
  }, 'image/jpeg', quality);
});

export const compressImage = async (file: File): Promise<File> => {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Selecciona una imagen JPEG, PNG o WebP.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('La imagen debe pesar 8 MB o menos.');
  }

  const image = await readImage(file);
  try {
    if (!image.width || !image.height || image.width * image.height > MAX_IMAGE_PIXELS) {
      throw new Error('La imagen supera la resolución máxima permitida.');
    }

    const scale = Math.min(1, MAX_DIMENSION / image.width, MAX_DIMENSION / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen para guardarla.');

    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

    let blob: Blob | undefined;
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      blob = await canvasToJpeg(canvas, quality);
      if (blob.size <= MAX_FILE_SIZE) break;
    }

    if (!blob || blob.size > MAX_FILE_SIZE) {
      throw new Error('No se pudo reducir la imagen al límite de 8 MB.');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    image.release();
  }
};
