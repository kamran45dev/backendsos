import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { authenticate } from '../middleware/auth.js';
import { File } from '../models/index.js';
import { validateFile } from '../utils/fileValidator.js';

dotenv.config();

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cloudprint/files',
    allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
    resource_type: 'auto'
  }
});

const upload = multer({ storage: storage });

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const validation = validateFile({
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    if (!validation.valid) {
      if (req.file.public_id) {
        await cloudinary.uploader.destroy(req.file.public_id);
      }
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const file = new File({
      userId: req.userId,
      filename: req.file.originalname,
      originalName: req.file.originalname,
      fileType: validation.fileType,
      mimeType: req.file.mimetype,
      size: req.file.size,
      fileUrl: req.file.path,
      thumbnailUrl: req.file.path,
      pageCount: 1
    });

    await file.save();

    res.status(201).json({
      success: true,
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          fileType: file.fileType,
          size: file.size,
          formattedSize: file.formattedSize,
          fileUrl: file.fileUrl,
          pageCount: file.pageCount,
          createdAt: file.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/files
router.get('/', authenticate, async (req, res) => {
  try {
    const { fileType = 'all', search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const files = await File.getByUser(req.userId, {
      fileType: fileType !== 'all' ? fileType : null,
      search: search || null,
      limit: parseInt(limit),
      skip
    });

    const total = await File.countDocuments({ userId: req.userId, isDeleted: false });

    res.json({
      success: true,
      data: {
        files: files.map(f => ({
          id: f._id,
          filename: f.filename,
          fileType: f.fileType,
          size: f.size,
          formattedSize: f.formattedSize,
          fileUrl: f.fileUrl,
          pageCount: f.pageCount,
          printCount: f.printCount,
          createdAt: f.createdAt,
          iconType: f.iconType
        })),
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/files/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.userId, isDeleted: false });
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    file.isDeleted = true;
    await file.save();
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;