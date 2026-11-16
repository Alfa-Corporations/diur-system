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
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ message: 'La imagen supera el límite permitido de 8 MB.' });
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
