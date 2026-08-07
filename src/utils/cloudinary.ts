import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sube un buffer de imagen a Cloudinary y retorna la URL segura
 */
export const uploadImageBuffer = (
  buffer: Buffer,
  folder: string = 'gestor_contable/users'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Elimina una imagen de Cloudinary a partir de su URL
 */
export const deleteImageByUrl = async (imageUrl: string): Promise<void> => {
  const publicId = extractPublicId(imageUrl);
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
};

const extractPublicId = (imageUrl: string): string | null => {
  const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/);
  return match ? match[1] : null;
};

export default cloudinary;
