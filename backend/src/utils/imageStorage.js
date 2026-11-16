const fs = require('fs/promises');
const path = require('path');
const { Jimp, JimpMime } = require('jimp');
const { imageSize } = require('image-size');
const { v4: uuidv4 } = require('uuid');

const storageRoot = path.resolve(__dirname, '../../uploads');
const allowedCategories = new Set(['products', 'invoices']);
const maxInputPixels = 40000000;
let webpDecoderPromise;

const getImage = async (buffer, format) => {
  if (format === 'png' || format === 'jpg') {
    return Jimp.fromBuffer(buffer);
  }

  if (!webpDecoderPromise) {
    webpDecoderPromise = (async () => {
      const { default: decode, init } = await import('@jsquash/webp/decode.js');
      const wasmPath = require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm');
      const wasmModule = await WebAssembly.compile(await fs.readFile(wasmPath));
      await init(wasmModule);
      return decode;
    })();
  }

  const decodeWebp = await webpDecoderPromise;
  const input = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const bitmap = await decodeWebp(input);
  return Jimp.fromBitmap({
    data: Buffer.from(bitmap.data),
    width: bitmap.width,
    height: bitmap.height,
  });
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
    || !/^(?:product|invoice)-\d+-[a-f0-9-]+\.(?:png|webp)$/i.test(filename)
    || !allowedCategories.has(category)
  ) {
    return null;
  }
  return path.join(getDirectory(category), filename);
};

const storeImage = async (category, recordId, buffer) => {
  const directory = getDirectory(category);
  const prefix = category === 'products' ? 'product' : 'invoice';
  const filename = `${prefix}-${recordId}-${uuidv4()}.png`;
  const filePath = path.join(directory, filename);

  const { type, width: inputWidth, height: inputHeight } = imageSize(buffer);
  if (!['jpg', 'png', 'webp'].includes(type)) {
    throw new Error('Solo se aceptan imágenes JPEG, PNG o WebP.');
  }
  if (!inputWidth || !inputHeight || inputWidth * inputHeight > maxInputPixels) {
    throw new Error('La imagen supera la resolución máxima permitida.');
  }

  const image = await getImage(buffer, type);
  const { width, height } = image.bitmap;
  if (!width || !height || width * height > maxInputPixels) {
    throw new Error('La imagen supera la resolución máxima permitida.');
  }

  if (width > 1280 || height > 1280) {
    image.scaleToFit(1280, 1280);
  }

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(filePath, await image.getBuffer(JimpMime.png));

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
