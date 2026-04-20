import express from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { User, TopUpCode } from '../models/index.js';

const router = express.Router();

// Rate limit for top-up attempts
const topUpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many top-up attempts, please try again later.'
});

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

// @route   GET /api/balance
// @desc    Get user's balance
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        balance: req.user.balance,
        formattedBalance: req.user.formattedBalance,
        pagesPrinted: req.user.pagesPrinted,
        pagesPrintedThisMonth: req.user.pagesPrintedThisMonth
      }
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching balance'
    });
  }
});

// @route   POST /api/balance/topup
// @desc    Redeem a top-up code
// @access  Private
router.post(
  '/topup',
  authenticate,
  topUpLimiter,
  [
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Top-up code is required')
      .isLength({ min: 4, max: 32 })
      .withMessage('Invalid code format'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { code } = req.body;

      // Redeem the code
      const topUpCode = await TopUpCode.redeemCode(code, req.userId);

      // Add balance to user
      await req.user.addBalance(topUpCode.value);

      res.json({
        success: true,
        message: 'Balance added successfully',
        data: {
          addedAmount: topUpCode.value,
          formattedAmount: topUpCode.formattedValue,
          newBalance: req.user.balance,
          formattedNewBalance: req.user.formattedBalance
        }
      });
    } catch (error) {
      console.error('Top-up error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to redeem code'
      });
    }
  }
);

// @route   GET /api/balance/transactions
// @desc    Get user's transaction history (placeholder for future Stripe integration)
// @access  Private
router.get('/transactions', authenticate, async (req, res) => {
  try {
    // For now, return top-up code redemptions as transactions
    const redemptions = await TopUpCode.find({
      usedBy: req.userId,
      isUsed: true
    })
      .sort({ usedAt: -1 })
      .select('code value usedAt')
      .limit(50);

    const transactions = redemptions.map(r => ({
      id: r._id,
      type: 'topup',
      description: `Redeemed code: ${r.code}`,
      amount: r.value,
      formattedAmount: `+RM${r.value.toFixed(2)}`,
      date: r.usedAt
    }));

    res.json({
      success: true,
      data: {
        transactions
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching transactions'
    });
  }
});

export default router;