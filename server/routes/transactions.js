const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all transactions with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      event_id, 
      category,
      status,
      start_date,
      end_date,
      search,
      sort_by = 'transaction_date',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    if (type) {
      whereConditions.push(`t.type = $${paramCount++}`);
      queryParams.push(type);
    }

    if (event_id) {
      whereConditions.push(`t.event_id = $${paramCount++}`);
      queryParams.push(event_id);
    }

    if (category) {
      whereConditions.push(`t.category = $${paramCount++}`);
      queryParams.push(category);
    }

    if (status) {
      whereConditions.push(`t.status = $${paramCount++}`);
      queryParams.push(status);
    }

    if (start_date) {
      whereConditions.push(`t.transaction_date >= $${paramCount++}`);
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push(`t.transaction_date <= $${paramCount++}`);
      queryParams.push(end_date);
    }

    if (search) {
      whereConditions.push(`(t.description ILIKE $${paramCount} OR t.reference_number ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const validSortColumns = ['transaction_date', 'amount', 'type', 'category', 'status', 'created_at'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'transaction_date';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get transactions with related information
    const transactionsQuery = `
      SELECT t.*, e.name as event_name,
             COALESCE(c.name, v.name) as entity_name,
             CASE WHEN t.client_id IS NOT NULL THEN 'client' ELSE 'vendor' END as entity_type,
             u.full_name as created_by_name
      FROM transactions t
      LEFT JOIN events e ON t.event_id = e.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN vendors v ON t.vendor_id = v.id
      LEFT JOIN users u ON t.created_by = u.id
      ${whereClause}
      ORDER BY t.${sortColumn} ${sortDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    queryParams.push(limit, offset);

    const transactionsResult = await db.query(transactionsQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      LEFT JOIN events e ON t.event_id = e.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN vendors v ON t.vendor_id = v.id
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const totalTransactions = parseInt(countResult.rows[0].total);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
        COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
      FROM transactions t
      ${whereClause}
    `;

    const summaryResult = await db.query(summaryQuery, queryParams.slice(0, -2));

    res.json({
      transactions: transactionsResult.rows,
      summary: summaryResult.rows[0],
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: totalTransactions,
        total_pages: Math.ceil(totalTransactions / limit)
      }
    });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get single transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const transactionResult = await db.query(`
      SELECT t.*, e.name as event_name,
             COALESCE(c.name, v.name) as entity_name,
             CASE WHEN t.client_id IS NOT NULL THEN 'client' ELSE 'vendor' END as entity_type,
             u.full_name as created_by_name
      FROM transactions t
      LEFT JOIN events e ON t.event_id = e.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN vendors v ON t.vendor_id = v.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = $1
    `, [id]);

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction: transactionResult.rows[0] });
  } catch (error) {
    console.error('Transaction fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create new transaction
router.post('/', authenticateToken, [
  body('event_id').isInt(),
  body('type').isIn(['income', 'expense']),
  body('category').isLength({ min: 1 }).trim().escape(),
  body('description').isLength({ min: 1 }).trim().escape(),
  body('amount').isFloat({ min: 0.01 }),
  body('transaction_date').isISO8601().toDate(),
  body('vendor_id').optional().isInt(),
  body('client_id').optional().isInt(),
  body('payment_method').optional().trim().escape(),
  body('reference_number').optional().trim().escape(),
  body('currency').optional().isLength({ min: 3, max: 3 })
], logActivity, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await client.query('BEGIN');

    const {
      event_id,
      type,
      category,
      description,
      amount,
      currency = 'IDR',
      transaction_date,
      vendor_id,
      client_id,
      payment_method,
      reference_number,
      receipt_url,
      status = 'completed'
    } = req.body;

    // Verify event exists
    const eventCheck = await client.query('SELECT id FROM events WHERE id = $1', [event_id]);
    if (eventCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Event not found' });
    }

    // Create transaction
    const transactionResult = await client.query(`
      INSERT INTO transactions (event_id, type, category, description, amount, currency,
                               transaction_date, vendor_id, client_id, payment_method,
                               reference_number, receipt_url, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [event_id, type, category, description, amount, currency, transaction_date,
        vendor_id, client_id, payment_method, reference_number, receipt_url, status, req.user.id]);

    // Update event financials if transaction is completed
    if (status === 'completed') {
      const financialResult = await client.query(`
        SELECT 
          SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as actual_cost
        FROM transactions
        WHERE event_id = $1
      `, [event_id]);

      const { revenue = 0, actual_cost = 0 } = financialResult.rows[0];
      const profit_margin = revenue > 0 ? ((revenue - actual_cost) / revenue * 100) : 0;

      await client.query(`
        UPDATE events 
        SET revenue = $1, actual_cost = $2, profit_margin = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [revenue, actual_cost, profit_margin, event_id]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction: transactionResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction creation error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  } finally {
    client.release();
  }
});

// Update transaction
router.put('/:id', authenticateToken, [
  body('type').optional().isIn(['income', 'expense']),
  body('category').optional().isLength({ min: 1 }).trim().escape(),
  body('description').optional().isLength({ min: 1 }).trim().escape(),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('transaction_date').optional().isISO8601().toDate(),
  body('status').optional().isIn(['pending', 'completed', 'cancelled'])
], logActivity, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await client.query('BEGIN');

    const { id } = req.params;
    
    // Get current transaction to check event_id
    const currentTransaction = await client.query('SELECT event_id, status FROM transactions WHERE id = $1', [id]);
    if (currentTransaction.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const event_id = currentTransaction.rows[0].event_id;
    const oldStatus = currentTransaction.rows[0].status;

    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'type', 'category', 'description', 'amount', 'currency', 'transaction_date',
      'vendor_id', 'client_id', 'payment_method', 'reference_number', 'receipt_url', 'status'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await client.query(`
      UPDATE transactions SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    // Update event financials if status changed or amount changed
    const newStatus = req.body.status || oldStatus;
    if (oldStatus !== newStatus || req.body.amount !== undefined) {
      const financialResult = await client.query(`
        SELECT 
          SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as actual_cost
        FROM transactions
        WHERE event_id = $1
      `, [event_id]);

      const { revenue = 0, actual_cost = 0 } = financialResult.rows[0];
      const profit_margin = revenue > 0 ? ((revenue - actual_cost) / revenue * 100) : 0;

      await client.query(`
        UPDATE events 
        SET revenue = $1, actual_cost = $2, profit_margin = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [revenue, actual_cost, profit_margin, event_id]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Transaction updated successfully',
      transaction: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction update error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  } finally {
    client.release();
  }
});

// Delete transaction
router.delete('/:id', authenticateToken, logActivity, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get transaction info before deletion
    const transactionResult = await client.query('SELECT event_id FROM transactions WHERE id = $1', [id]);
    if (transactionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const event_id = transactionResult.rows[0].event_id;

    // Delete transaction
    await client.query('DELETE FROM transactions WHERE id = $1', [id]);

    // Update event financials
    const financialResult = await client.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as actual_cost
      FROM transactions
      WHERE event_id = $1
    `, [event_id]);

    const { revenue = 0, actual_cost = 0 } = financialResult.rows[0];
    const profit_margin = revenue > 0 ? ((revenue - actual_cost) / revenue * 100) : 0;

    await client.query(`
      UPDATE events 
      SET revenue = $1, actual_cost = $2, profit_margin = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [revenue, actual_cost, profit_margin, event_id]);

    await client.query('COMMIT');

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction deletion error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  } finally {
    client.release();
  }
});

// Get transaction categories
router.get('/categories/list', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query;
    
    let whereClause = '';
    let queryParams = [];
    
    if (type) {
      whereClause = 'WHERE type = $1';
      queryParams.push(type);
    }

    const result = await db.query(`
      SELECT * FROM budget_categories 
      ${whereClause}
      ORDER BY type, name
    `, queryParams);

    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;