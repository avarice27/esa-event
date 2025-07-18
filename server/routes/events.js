const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all events with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      client_id, 
      search,
      start_date,
      end_date,
      sort_by = 'event_date',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`e.status = $${paramCount++}`);
      queryParams.push(status);
    }

    if (client_id) {
      whereConditions.push(`e.client_id = $${paramCount++}`);
      queryParams.push(client_id);
    }

    if (search) {
      whereConditions.push(`(e.name ILIKE $${paramCount} OR e.description ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    if (start_date) {
      whereConditions.push(`e.event_date >= $${paramCount++}`);
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push(`e.event_date <= $${paramCount++}`);
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const validSortColumns = ['event_date', 'name', 'status', 'budget', 'revenue', 'created_at'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'event_date';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get events with client information
    const eventsQuery = `
      SELECT e.*, c.name as client_name, c.email as client_email,
             u.full_name as created_by_name,
             (e.revenue - e.actual_cost) as profit
      FROM events e
      LEFT JOIN clients c ON e.client_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      ${whereClause}
      ORDER BY e.${sortColumn} ${sortDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    queryParams.push(limit, offset);

    const eventsResult = await db.query(eventsQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM events e
      LEFT JOIN clients c ON e.client_id = c.id
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const totalEvents = parseInt(countResult.rows[0].total);

    res.json({
      events: eventsResult.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: totalEvents,
        total_pages: Math.ceil(totalEvents / limit)
      }
    });
  } catch (error) {
    console.error('Events fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const eventResult = await db.query(`
      SELECT e.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
             u.full_name as created_by_name
      FROM events e
      LEFT JOIN clients c ON e.client_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1
    `, [id]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get event transactions
    const transactionsResult = await db.query(`
      SELECT t.*, 
             COALESCE(c.name, v.name) as entity_name,
             CASE WHEN t.client_id IS NOT NULL THEN 'client' ELSE 'vendor' END as entity_type
      FROM transactions t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN vendors v ON t.vendor_id = v.id
      WHERE t.event_id = $1
      ORDER BY t.transaction_date DESC
    `, [id]);

    // Get event budget breakdown
    const budgetResult = await db.query(`
      SELECT eb.*, bc.name as category_name, bc.type as category_type
      FROM event_budgets eb
      JOIN budget_categories bc ON eb.category_id = bc.id
      WHERE eb.event_id = $1
      ORDER BY bc.type, bc.name
    `, [id]);

    const event = eventResult.rows[0];
    event.transactions = transactionsResult.rows;
    event.budget_breakdown = budgetResult.rows;
    event.profit = (event.revenue || 0) - (event.actual_cost || 0);

    res.json({ event });
  } catch (error) {
    console.error('Event fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create new event
router.post('/', authenticateToken, [
  body('name').isLength({ min: 1 }).trim().escape(),
  body('event_date').isISO8601().toDate(),
  body('budget').isFloat({ min: 0 }),
  body('client_id').optional().isInt(),
  body('description').optional().trim().escape(),
  body('venue').optional().trim().escape(),
  body('expected_attendees').optional().isInt({ min: 0 }),
  body('currency').optional().isLength({ min: 3, max: 3 })
], logActivity, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      client_id,
      event_date,
      end_date,
      venue,
      expected_attendees,
      budget,
      currency = 'IDR'
    } = req.body;

    const result = await db.query(`
      INSERT INTO events (name, description, client_id, event_date, end_date, venue, 
                         expected_attendees, budget, currency, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [name, description, client_id, event_date, end_date, venue, 
        expected_attendees, budget, currency, req.user.id]);

    res.status(201).json({
      message: 'Event created successfully',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Event creation error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event
router.put('/:id', authenticateToken, [
  body('name').optional().isLength({ min: 1 }).trim().escape(),
  body('event_date').optional().isISO8601().toDate(),
  body('budget').optional().isFloat({ min: 0 }),
  body('client_id').optional().isInt(),
  body('status').optional().isIn(['planning', 'confirmed', 'in_progress', 'completed', 'cancelled'])
], logActivity, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'name', 'description', 'client_id', 'event_date', 'end_date', 
      'venue', 'expected_attendees', 'status', 'budget', 'currency'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(`
      UPDATE events SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      message: 'Event updated successfully',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Event update error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:id', authenticateToken, logActivity, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event has transactions
    const transactionCheck = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE event_id = $1',
      [id]
    );

    if (parseInt(transactionCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete event with existing transactions. Please delete transactions first.' 
      });
    }

    const result = await db.query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Event deletion error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Update event financial summary (called when transactions change)
router.put('/:id/update-financials', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Calculate totals from transactions
    const financialResult = await db.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as actual_cost
      FROM transactions
      WHERE event_id = $1
    `, [id]);

    const { revenue = 0, actual_cost = 0 } = financialResult.rows[0];
    const profit_margin = revenue > 0 ? ((revenue - actual_cost) / revenue * 100) : 0;

    // Update event
    const result = await db.query(`
      UPDATE events 
      SET revenue = $1, actual_cost = $2, profit_margin = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [revenue, actual_cost, profit_margin, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      message: 'Event financials updated successfully',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Event financial update error:', error);
    res.status(500).json({ error: 'Failed to update event financials' });
  }
});

module.exports = router;