const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all vendors
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, serviceCategory, isActive } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (search) {
      whereClause += ` AND (company_name ILIKE $${++paramCount} OR contact_person ILIKE $${++paramCount} OR email ILIKE $${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 2;
    }

    if (serviceCategory) {
      whereClause += ` AND service_category = $${++paramCount}`;
      params.push(serviceCategory);
    }

    if (isActive !== undefined) {
      whereClause += ` AND is_active = $${++paramCount}`;
      params.push(isActive === 'true');
    }

    const vendorsResult = await query(`
      SELECT 
        v.*,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(t.amount), 0) as total_paid,
        COUNT(DISTINCT t.event_id) as events_worked
      FROM vendors v
      LEFT JOIN transactions t ON v.id = t.vendor_id AND t.status = 'completed'
      ${whereClause}
      GROUP BY v.id
      ORDER BY v.company_name
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `, [...params, limit, offset]);

    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM vendors v
      ${whereClause}
    `, params.slice(0, paramCount - 2));

    const vendors = vendorsResult.rows.map(vendor => ({
      ...vendor,
      rating: parseFloat(vendor.rating || 0),
      total_paid: parseFloat(vendor.total_paid || 0),
      transaction_count: parseInt(vendor.transaction_count || 0),
      events_worked: parseInt(vendor.events_worked || 0)
    }));

    res.json({
      success: true,
      data: {
        vendors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendors'
    });
  }
});

// Get single vendor
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const vendorResult = await query(`
      SELECT 
        v.*,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(t.amount), 0) as total_paid,
        COUNT(DISTINCT t.event_id) as events_worked,
        AVG(CASE WHEN t.amount > 0 THEN t.amount END) as avg_transaction_amount
      FROM vendors v
      LEFT JOIN transactions t ON v.id = t.vendor_id AND t.status = 'completed'
      WHERE v.id = $1
      GROUP BY v.id
    `, [req.params.id]);

    if (vendorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const vendor = vendorResult.rows[0];

    // Get recent transactions
    const recentTransactionsResult = await query(`
      SELECT 
        t.*,
        e.name as event_name
      FROM transactions t
      JOIN events e ON t.event_id = e.id
      WHERE t.vendor_id = $1
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [req.params.id]);

    // Get communication logs
    const communicationLogsResult = await query(`
      SELECT 
        cl.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM communication_logs cl
      LEFT JOIN users u ON cl.created_by = u.id
      WHERE cl.entity_type = 'vendor' AND cl.entity_id = $1
      ORDER BY cl.communication_date DESC
      LIMIT 10
    `, [req.params.id]);

    // Get performance metrics by month
    const performanceResult = await query(`
      SELECT 
        DATE_TRUNC('month', t.transaction_date) as month,
        COUNT(t.id) as transaction_count,
        SUM(t.amount) as total_amount,
        COUNT(DISTINCT t.event_id) as events_count
      FROM transactions t
      WHERE t.vendor_id = $1 
        AND t.status = 'completed'
        AND t.transaction_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', t.transaction_date)
      ORDER BY month DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        vendor: {
          ...vendor,
          rating: parseFloat(vendor.rating || 0),
          total_paid: parseFloat(vendor.total_paid || 0),
          transaction_count: parseInt(vendor.transaction_count || 0),
          events_worked: parseInt(vendor.events_worked || 0),
          avg_transaction_amount: parseFloat(vendor.avg_transaction_amount || 0)
        },
        recentTransactions: recentTransactionsResult.rows.map(transaction => ({
          ...transaction,
          amount: parseFloat(transaction.amount)
        })),
        communicationLogs: communicationLogsResult.rows,
        performanceMetrics: performanceResult.rows.map(row => ({
          month: row.month,
          transactionCount: parseInt(row.transaction_count),
          totalAmount: parseFloat(row.total_amount),
          eventsCount: parseInt(row.events_count)
        }))
      }
    });
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor'
    });
  }
});

// Create new vendor
router.post('/', authenticateToken, [
  body('companyName').trim().isLength({ min: 1 }),
  body('contactPerson').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('country').optional().trim(),
  body('serviceCategory').optional().trim(),
  body('rating').optional().isFloat({ min: 0, max: 5 }),
  body('paymentTerms').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      companyName,
      contactPerson,
      email,
      phone,
      address,
      city,
      country,
      serviceCategory,
      rating = 0,
      paymentTerms = 30
    } = req.body;

    // Check if vendor with same email already exists
    if (email) {
      const existingVendor = await query(
        'SELECT id FROM vendors WHERE email = $1',
        [email]
      );
      
      if (existingVendor.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Vendor with this email already exists'
        });
      }
    }

    const result = await query(`
      INSERT INTO vendors (
        company_name, contact_person, email, phone, address, 
        city, country, service_category, rating, payment_terms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      companyName, contactPerson, email, phone, address,
      city, country, serviceCategory, rating, paymentTerms
    ]);

    const vendor = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: {
        vendor: {
          ...vendor,
          rating: parseFloat(vendor.rating || 0)
        }
      }
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create vendor'
    });
  }
});

// Update vendor
router.put('/:id', authenticateToken, [
  body('companyName').optional().trim().isLength({ min: 1 }),
  body('contactPerson').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('country').optional().trim(),
  body('serviceCategory').optional().trim(),
  body('rating').optional().isFloat({ min: 0, max: 5 }),
  body('paymentTerms').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Check if vendor exists
    const existingVendor = await query('SELECT id FROM vendors WHERE id = $1', [req.params.id]);
    if (existingVendor.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fieldMap = {
      companyName: 'company_name',
      contactPerson: 'contact_person',
      serviceCategory: 'service_category',
      paymentTerms: 'payment_terms',
      isActive: 'is_active'
    };

    const allowedFields = [
      'company_name', 'contact_person', 'email', 'phone', 'address',
      'city', 'country', 'service_category', 'rating', 'payment_terms', 'is_active'
    ];

    Object.keys(req.body).forEach(key => {
      const dbField = fieldMap[key] || key;
      if (allowedFields.includes(dbField)) {
        updates.push(`${dbField} = $${paramCount++}`);
        values.push(req.body[key]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(req.params.id);

    const result = await query(`
      UPDATE vendors 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    const vendor = result.rows[0];

    res.json({
      success: true,
      message: 'Vendor updated successfully',
      data: {
        vendor: {
          ...vendor,
          rating: parseFloat(vendor.rating || 0)
        }
      }
    });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vendor'
    });
  }
});

// Delete vendor
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if vendor has transactions
    const dependencyCheck = await query(`
      SELECT COUNT(t.id) as transaction_count
      FROM vendors v
      LEFT JOIN transactions t ON v.id = t.vendor_id
      WHERE v.id = $1
      GROUP BY v.id
    `, [req.params.id]);

    if (dependencyCheck.rows.length > 0) {
      const { transaction_count } = dependencyCheck.rows[0];
      if (parseInt(transaction_count) > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete vendor with existing transactions'
        });
      }
    }

    const result = await query('DELETE FROM vendors WHERE id = $1 RETURNING *', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vendor'
    });
  }
});

// Add communication log
router.post('/:id/communications', authenticateToken, [
  body('communicationType').trim().isLength({ min: 1 }),
  body('subject').optional().trim(),
  body('content').optional().trim(),
  body('communicationDate').optional().isISO8601()
], logActivity('vendor_communication_add'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      communicationType,
      subject,
      content,
      communicationDate = new Date().toISOString()
    } = req.body;

    // Verify vendor exists
    const vendorCheck = await query('SELECT id FROM vendors WHERE id = $1', [req.params.id]);
    if (vendorCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const result = await query(`
      INSERT INTO communication_logs (
        entity_type, entity_id, communication_type, subject, 
        content, communication_date, created_by
      )
      VALUES ('vendor', $1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.params.id, communicationType, subject, content, communicationDate, req.user.id]);

    res.status(201).json({
      success: true,
      message: 'Communication log added successfully',
      data: {
        communication: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Add communication error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add communication log'
    });
  }
});

// Get vendor service categories
router.get('/categories/list', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT service_category
      FROM vendors
      WHERE service_category IS NOT NULL AND service_category != ''
      ORDER BY service_category
    `);

    res.json({
      success: true,
      data: {
        categories: result.rows.map(row => row.service_category)
      }
    });
  } catch (error) {
    console.error('Get service categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service categories'
    });
  }
});

// Get vendor statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(DISTINCT t.id) as total_transactions,
        COALESCE(SUM(t.amount), 0) as total_paid,
        COUNT(DISTINCT t.event_id) as events_worked,
        AVG(t.amount) as avg_transaction_amount,
        MIN(t.transaction_date) as first_transaction_date,
        MAX(t.transaction_date) as last_transaction_date
      FROM vendors v
      LEFT JOIN transactions t ON v.id = t.vendor_id AND t.status = 'completed'
      WHERE v.id = $1
      GROUP BY v.id
    `, [req.params.id]);

    const categoryStatsResult = await query(`
      SELECT 
        t.category,
        COUNT(t.id) as transaction_count,
        SUM(t.amount) as total_amount
      FROM transactions t
      WHERE t.vendor_id = $1 AND t.status = 'completed'
      GROUP BY t.category
      ORDER BY total_amount DESC
    `, [req.params.id]);

    const stats = statsResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        overview: {
          totalTransactions: parseInt(stats.total_transactions || 0),
          totalPaid: parseFloat(stats.total_paid || 0),
          eventsWorked: parseInt(stats.events_worked || 0),
          avgTransactionAmount: parseFloat(stats.avg_transaction_amount || 0),
          firstTransactionDate: stats.first_transaction_date,
          lastTransactionDate: stats.last_transaction_date
        },
        categoryBreakdown: categoryStatsResult.rows.map(row => ({
          category: row.category,
          transactionCount: parseInt(row.transaction_count),
          totalAmount: parseFloat(row.total_amount)
        }))
      }
    });
  } catch (error) {
    console.error('Vendor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor statistics'
    });
  }
});

module.exports = router;