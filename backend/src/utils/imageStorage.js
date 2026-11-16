const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storageRoot = path.resolve(__dirname, '../../uploads');
const allowedCategories = new Set(['products', 'invoices']);
const imageTypes = {
  'image/jpeg': {
    extension: 'jpg',
    matches: buffer => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    matches: buffer => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp',
    matches: buffer => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
};

const getDirectory = category => {
  if (!allowedCategories.has(category)) {
    throw new Error('Invalid image category');
  }
  return path.join(storageRoot, category);
};

const getStoredImagePath = (category, filename) => {
  if (
    typeof filename !== 'string'
    || !/^(?:product|invoice)-\d+-[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(filename)
    || !allowedCategories.has(category)
  ) {
    return null;
  }
  return path.join(getDirectory(category), filename);
};

const storeImage = async (category, recordId, buffer, mimeType) => {
  const directory = getDirectory(category);
  const imageType = imageTypes[mimeType];
  if (!imageType || !Buffer.isBuffer(buffer) || !buffer.length || !imageType.matches(buffer)) {
    throw new Error('Solo se aceptan imágenes JPEG, PNG o WebP válidas.');
  }

  const id = Number(recordId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid image record ID');
  }

  const prefix = category === 'products' ? 'product' : 'invoice';
  const filename = `${prefix}-${id}-${uuidv4()}.${imageType.extension}`;
  const filePath = path.join(directory, filename);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(filePath, buffer);

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
