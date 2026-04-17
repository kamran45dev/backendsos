import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { User, File, TopUpCode, PrintJob } from '../models/index.js';

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

// Verify admin action code
const verifyAdminCode = (req, res, next) => {
  const { adminCode } = req.body;
  const expectedCode = process.env.ADMIN_ACTION_CODE;
  
  if (!expectedCode) {
    return res.status(500).json({
      success: false,
      message: 'Admin action code not configured'
    });
  }
  
  if (adminCode !== expectedCode) {
    return res.status(403).json({
      success: false,
      message: 'Invalid admin action code'
    });
  }
  
  next();
};

// Apply authentication and admin check to all routes
router.use(authenticate, requireAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Admin
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalFiles,
      totalPrints,
      printsThisMonth,
      totalRevenue,
      revenueThisMonth
    ] = await Promise.all([
      User.countDocuments(),
      File.countDocuments({ isDeleted: false }),
      PrintJob.countDocuments(),
      PrintJob.countDocuments({ createdAt: { $gte: startOfMonth } }),
      PrintJob.aggregate([{ $group: { _id: null, total: { $sum: '$cost' } } }]),
      PrintJob.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$cost' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalFiles,
          totalPrints,
          printsThisMonth,
          totalRevenue: totalRevenue[0]?.total || 0,
          revenueThisMonth: revenueThisMonth[0]?.total || 0
        }
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard stats'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Admin
router.get('/users', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 25 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (search) {
      query.username = { $regex: search, $options: 'i' };
    }

    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users: users.map(u => ({
          id: u._id,
          username: u.username,
          role: u.role,
          balance: u.balance,
          formattedBalance: u.formattedBalance,
          pagesPrinted: u.pagesPrinted,
          pagesPrintedThisMonth: u.pagesPrintedThisMonth,
          createdAt: u.createdAt
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
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    });
  }
});

// @route   PATCH /api/admin/users/:id/balance
// @desc    Update user balance
// @access  Admin
router.patch(
  '/users/:id/balance',
  [
    param('id').isMongoId().withMessage('Valid user ID is required'),
    body('amount')
      .isFloat({ min: -1000, max: 1000 })
      .withMessage('Amount must be between -1000 and 1000'),
    body('adminCode').notEmpty().withMessage('Admin action code is required'),
    handleValidationErrors,
    verifyAdminCode
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, reason = 'Admin adjustment' } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const newBalance = user.balance + amount;
      if (newBalance < 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reduce balance below zero'
        });
      }

      user.balance = newBalance;
      await user.save();

      res.json({
        success: true,
        message: 'Balance updated successfully',
        data: {
          user: {
            id: user._id,
            username: user.username,
            balance: user.balance,
            formattedBalance: user.formattedBalance
          },
          adjustment: amount,
          reason
        }
      });
    } catch (error) {
      console.error('Update balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error updating balance'
      });
    }
  }
);

// @route   GET /api/admin/files
// @desc    Get all files
// @access  Admin
router.get('/files', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 25 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { isDeleted: false };
    if (search) {
      query.filename = { $regex: search, $options: 'i' };
    }

    const files = await File.find(query)
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await File.countDocuments(query);

    res.json({
      success: true,
      data: {
        files: files.map(f => ({
          id: f._id,
          filename: f.filename,
          fileType: f.fileType,
          size: f.size,
          formattedSize: f.formattedSize,
          pageCount: f.pageCount,
          printCount: f.printCount,
          user: f.userId ? {
            id: f.userId._id,
            username: f.userId.username
          } : null,
          createdAt: f.createdAt
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
    console.error('Get admin files error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching files'
    });
  }
});

// @route   GET /api/admin/topup-codes
// @desc    Get all top-up codes
// @access  Admin
router.get('/topup-codes', async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 25 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status === 'available') {
      query.isUsed = false;
      query.$or = [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ];
    } else if (status === 'used') {
      query.isUsed = true;
    } else if (status === 'expired') {
      query.isUsed = false;
      query.expiresAt = { $lt: new Date() };
    }

    const codes = await TopUpCode.find(query)
      .populate('usedBy', 'username')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TopUpCode.countDocuments(query);

    res.json({
      success: true,
      data: {
        codes: codes.map(c => ({
          id: c._id,
          code: c.code,
          value: c.value,
          formattedValue: c.formattedValue,
          isUsed: c.isUsed,
          usedBy: c.usedBy ? { id: c.usedBy._id, username: c.usedBy.username } : null,
          usedAt: c.usedAt,
          expiresAt: c.expiresAt,
          createdBy: c.createdBy ? { id: c.createdBy._id, username: c.createdBy.username } : null,
          createdAt: c.createdAt
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
    console.error('Get top-up codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching top-up codes'
    });
  }
});

// @route   POST /api/admin/topup-codes
// @desc    Generate new top-up code(s)
// @access  Admin
router.post(
  '/topup-codes',
  [
    body('value')
      .isFloat({ min: 0.01, max: 1000 })
      .withMessage('Value must be between $0.01 and $1000'),
    body('quantity')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Quantity must be between 1 and 100'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Invalid expiration date'),
    body('adminCode').notEmpty().withMessage('Admin action code is required'),
    handleValidationErrors,
    verifyAdminCode
  ],
  async (req, res) => {
    try {
      const { value, quantity = 1, expiresAt = null } = req.body;

      const codes = [];
      for (let i = 0; i < quantity; i++) {
        const code = await TopUpCode.generateCode(
          value,
          req.userId,
          expiresAt ? new Date(expiresAt) : null
        );
        codes.push({
          id: code._id,
          code: code.code,
          value: code.value,
          formattedValue: code.formattedValue,
          expiresAt: code.expiresAt
        });
      }

      res.status(201).json({
        success: true,
        message: `${quantity} top-up code(s) generated successfully`,
        data: {
          codes
        }
      });
    } catch (error) {
      console.error('Generate codes error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error generating top-up codes'
      });
    }
  }
);

// @route   DELETE /api/admin/topup-codes/:id
// @desc    Revoke (delete) a top-up code
// @access  Admin
router.delete(
  '/topup-codes/:id',
  [
    param('id').isMongoId().withMessage('Valid code ID is required'),
    body('adminCode').notEmpty().withMessage('Admin action code is required'),
    handleValidationErrors,
    verifyAdminCode
  ],
  async (req, res) => {
    try {
      const { id } = req.params;

      const code = await TopUpCode.findById(id);
      if (!code) {
        return res.status(404).json({
          success: false,
          message: 'Top-up code not found'
        });
      }

      if (code.isUsed) {
        return res.status(400).json({
          success: false,
          message: 'Cannot revoke a used code'
        });
      }

      await TopUpCode.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Top-up code revoked successfully'
      });
    } catch (error) {
      console.error('Revoke code error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error revoking code'
      });
    }
  }
);

// @route   GET /api/admin/print-jobs
// @desc    Get all print jobs
// @access  Admin
router.get('/print-jobs', async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await PrintJob.find()
      .populate('userId', 'username')
      .populate('fileId', 'filename fileType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PrintJob.countDocuments();

    res.json({
      success: true,
      data: {
        jobs: jobs.map(j => ({
          id: j._id,
          filename: j.filename,
          user: j.userId ? { id: j.userId._id, username: j.userId.username } : null,
          pageCount: j.pageCount,
          cost: j.cost,
          formattedCost: j.formattedCost,
          settings: j.settings,
          status: j.status,
          printedAt: j.printedAt,
          createdAt: j.createdAt
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
    console.error('Get print jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching print jobs'
    });
  }
});

export default router;
