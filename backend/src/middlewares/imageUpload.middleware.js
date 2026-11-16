const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Solo se aceptan imágenes JPEG, PNG o WebP.'));
    }
    return callback(null, true);
  },
});

module.exports = (req, res, next) => {
  upload.single('image')(req, res, error => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'La imagen supera el límite permitido de 8 MB.' });
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'Solo se permite una imagen en el campo image.' });
      }
      return res.status(400).json({ message: 'No se pudo recibir la imagen.' });
    }
    if (error) {
      return res.status(400).json({ message: error.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Selecciona una imagen para continuar.' });
    }
    return next();
  });
};
