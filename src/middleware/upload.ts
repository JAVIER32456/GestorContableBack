import multer from 'multer';

// Guarda el archivo en memoria (buffer) para subirlo directo a Cloudinary sin tocar disco
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Formato de imagen no permitido. Usa JPG, PNG o WEBP'));
    }
    cb(null, true);
  },
});
