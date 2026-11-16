const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const storageRoot = path.resolve(__dirname, '../../uploads');
const allowedCategories = new Set(['products', 'invoices']);

const getDirectory = category => {
  if (!allowedCategories.has(category)) {
    throw new Error('Invalid image category');
  }
  return path.join(storageRoot, category);
};

const getStoredImagePath = (category, filename) => {
  if (
    typeof filename !== 'string'
    || !/^(?:product|invoice)-\d+-[a-f0-9-]+\.webp$/i.test(filename)
    || !allowedCategories.has(category)
  ) {
    return null;
  }
  return path.join(getDirectory(category), filename);
};

const storeImage = async (category, recordId, buffer) => {
  const directory = getDirectory(category);
  const prefix = category === 'products' ? 'product' : 'invoice';
  const filename = `${prefix}-${recordId}-${uuidv4()}.webp`;
  const filePath = path.join(directory, filename);

  await fs.mkdir(directory, { recursive: true });
  const image = sharp(buffer, { failOn: 'error', limitInputPixels: 40000000 });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) {
    throw new Error('Solo se aceptan imágenes JPEG, PNG o WebP.');
  }

  await image
    .rotate()
    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toFile(filePath);

  return { filename, filePath };
};

const removeStoredImage = async (category, filename) => {
  const filePath = getStoredImagePath(category, filename);
  if (filePath) {
    await fs.unlink(filePath).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
};

module.exports = { getStoredImagePath, removeStoredImage, storeImage };
