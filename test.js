import cloudinary from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const v2 = cloudinary.v2;

v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Test upload
const testUpload = async () => {
  try {
    const result = await v2.uploader.upload('https://cloudinary-devs.github.io/cld-docs-assets/assets/images/butterfly.jpeg', {
      folder: 'test-folder'
    });
    console.log('✅ Cloudinary working!');
    console.log('Upload result:', result.secure_url);
  } catch (error) {
    console.error('❌ Cloudinary error:', error.message);
  }
};

testUpload();
