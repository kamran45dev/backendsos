import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { File, User, PrintJob } from '../models/index.js';
import { 
  calculatePrintCost, 
  parsePageRange, 
  validatePageRange,
  getLayoutConfig 
} from '../utils/printCalculator.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// @route   POST /api/print/calculate
// @desc    Calculate print cost without executing
// @access  Private
router.post(
  '/calculate',
  authenticate,
  [
    body('fileId').isMongoId().withMessage('Valid file ID is required'),
    body('settings').isObject().withMessage('Settings object is required'),
    body('settings.pages').optional().isString(),
    body('settings.paperSize').optional().isIn(['A4', 'A3', 'Letter', 'Legal']),
    body('settings.layout').optional().isIn(['full', '1', '2', '3', '4h', '6h', '9h', '4v', '6v', '9v']),
    body('settings.color').optional().isIn(['bw', 'color']),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { fileId, settings } = req.body;

      const file = await File.findOne({
        _id: fileId,
        userId: req.userId,
        isDeleted: false
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const pages = settings.pages || 'all';
      const pageValidation = validatePageRange(pages, file.pageCount);
      
      if (!pageValidation.valid) {
        return res.status(400).json({
          success: false,
          message: pageValidation.error
        });
      }

      const calculation = calculatePrintCost({
        pageCount: pageValidation.pages,
        color: settings.color || 'bw',
        paperSize: settings.paperSize || 'A4',
        layout: settings.layout || 'full'
      });

      res.json({
        success: true,
        data: {
          file: {
            id: file._id,
            filename: file.filename,
            totalPages: file.pageCount
          },
          settings: {
            pages,
            parsedPages: parsePageRange(pages, file.pageCount),
            paperSize: settings.paperSize || 'A4',
            layout: settings.layout || 'full',
            layoutConfig: getLayoutConfig(settings.layout || 'full'),
            color: settings.color || 'bw'
          },
          calculation: {
            pageCount: calculation.pageCount,
            costPerPage: calculation.costPerPage,
            totalCost: calculation.totalCost,
            breakdown: calculation.breakdown
          },
          canAfford: req.user.balance >= calculation.totalCost
        }
      });
    } catch (error) {
      console.error('Calculate error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error calculating print cost'
      });
    }
  }
);

// @route   POST /api/print/execute
// @desc    Execute print job (deduct balance and record)
// @access  Private
router.post(
  '/execute',
  authenticate,
  [
    body('fileId').isMongoId().withMessage('Valid file ID is required'),
    body('pageCount').optional().isInt({ min: 1 }),
    body('cost').optional().isFloat({ min: 0 }),
    body('settings').isObject().withMessage('Settings object is required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { fileId, settings, pageCount: frontendPageCount, cost: frontendCost } = req.body;

      const file = await File.findOne({
        _id: fileId,
        userId: req.userId,
        isDeleted: false
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      // Use frontend values if provided, otherwise calculate
      let pageCount = frontendPageCount;
      let totalCost = frontendCost;
      
      if (!pageCount || !totalCost) {
        const pages = settings.pages || 'all';
        const pageValidation = validatePageRange(pages, file.pageCount);
        
        if (!pageValidation.valid) {
          return res.status(400).json({
            success: false,
            message: pageValidation.error
          });
        }
        
        pageCount = pageValidation.pages;
        
        const calculation = calculatePrintCost({
          pageCount: pageCount,
          color: settings.color || 'bw',
          paperSize: settings.paperSize || 'A4',
          layout: settings.layout || 'full'
        });
        
        totalCost = calculation.totalCost;
      }

      if (req.user.balance < totalCost) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance',
          data: {
            required: totalCost,
            available: req.user.balance,
            shortfall: totalCost - req.user.balance
          }
        });
      }

      await req.user.deductBalance(totalCost);
      await req.user.incrementPagesPrinted(pageCount);
      await file.incrementPrintCount();

      const printJob = new PrintJob({
        userId: req.userId,
        fileId: file._id,
        filename: file.filename,
        settings: {
          pages: settings.pages || 'all',
          paperSize: settings.paperSize || 'A4',
          layout: settings.layout || 'full',
          color: settings.color || 'bw'
        },
        pageCount: pageCount,
        cost: totalCost,
        status: 'completed',
        printedAt: new Date()
      });

      await printJob.save();

      res.json({
        success: true,
        message: 'Print job executed successfully',
        data: {
          printJob: {
            id: printJob._id,
            filename: printJob.filename,
            pageCount: printJob.pageCount,
            cost: printJob.cost,
            formattedCost: printJob.formattedCost,
            settings: printJob.settings,
            printedAt: printJob.printedAt
          },
          remainingBalance: req.user.balance - totalCost
        }
      });
    } catch (error) {
      console.error('Execute print error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error executing print job'
      });
    }
  }
);

// @route   GET /api/print/history
// @desc    Get user's print history
// @access  Private
router.get('/history', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const printJobs = await PrintJob.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('fileId', 'filename fileType');

    const total = await PrintJob.countDocuments({ userId: req.userId });

    res.json({
      success: true,
      data: {
        history: printJobs.map(job => ({
          id: job._id,
          filename: job.filename,
          pageCount: job.pageCount,
          cost: job.cost,
          formattedCost: job.formattedCost,
          settings: job.settings,
          status: job.status,
          printedAt: job.printedAt,
          createdAt: job.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching print history'
    });
  }
});

export default router;