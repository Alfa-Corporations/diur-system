const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storageRoot = path.resolve(__dirname, '../../uploads');
const allowedCategories = new Set(['products', 'invoices']);
const createValidationError = message => Object.assign(new Error(message), { code: 'INVALID_IMAGE' });

const isJpeg = buffer => (
  buffer.length >= 4
  && buffer[0] === 0xff
  && buffer[1] === 0xd8
  && buffer[2] === 0xff
);

const isPng = buffer => (
  buffer.length >= 24
  && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  && buffer.toString('ascii', 12, 16) === 'IHDR'
  && buffer.readUInt32BE(16) > 0
  && buffer.readUInt32BE(20) > 0
);

const isWebp = buffer => (
  buffer.length >= 20
  && buffer.toString('ascii', 0, 4) === 'RIFF'
  && buffer.toString('ascii', 8, 12) === 'WEBP'
  && ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))
  && buffer.readUInt32LE(4) + 8 <= buffer.length
);

const imageTypes = {
  'image/jpeg': {
    extension: 'jpg',
    matches: isJpeg,
  },
  'image/png': {
    extension: 'png',
    matches: isPng,
  },
  'image/webp': {
    extension: 'webp',
    matches: isWebp,
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
  const imageType = Object.prototype.hasOwnProperty.call(imageTypes, mimeType)
    ? imageTypes[mimeType]
    : null;
  if (!imageType || !Buffer.isBuffer(buffer) || !buffer.length || !imageType.matches(buffer)) {
    throw createValidationError('Solo se aceptan imágenes JPEG, PNG o WebP válidas.');
  }

  const id = Number(recordId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createValidationError('El identificador del registro no es válido.');
  }

  const prefix = category === 'products' ? 'product' : 'invoice';
  const filename = `${prefix}-${id}-${uuidv4()}.${imageType.extension}`;
  const filePath = path.join(directory, filename);

  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(filePath, buffer, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      await fs.unlink(filePath).catch(cleanupError => {
        if (cleanupError.code !== 'ENOENT') {
          console.error('Could not remove incomplete image file:', cleanupError);
        }
      });
    }
    throw error;
  }

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
