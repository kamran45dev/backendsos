import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const makePublic = async () => {
  try {
    // List all resources in your folder
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'cloudprint/files/',
      max_results: 100
    });
    
    // Update each resource to public
    for (const resource of result.resources) {
      await cloudinary.api.update(resource.public_id, {
        access_mode: 'public'
      });
      console.log(`Updated: ${resource.public_id}`);
    }
    
    console.log('All files updated to public!');
  } catch (error) {
    console.error('Error:', error);
  }
};

makePublic();