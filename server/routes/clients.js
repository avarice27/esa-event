const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all clients with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      sort_by = 'name',
      sort_order = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereCondition = '';
    let queryParams = [];

    if (search) {
      whereCondition = 'WHERE name ILIKE $1 OR email ILIKE $1 OR company ILIKE $1';
      queryParams.push(`%${search}%`);
    }

    const validSortColumns = ['name', 'email', 'company', 'created_at'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'name';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Get clients with event statistics
    const clientsResult = await query(
      `SELECT 
        c.*,
        COUNT(e.id) as total_events,
        COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as completed_events,
        COALESCE(SUM(e.actual_revenue), 0) as total_revenue,
        MAX(e.event_date) as last_event_date
       FROM clients c
       LEFT JOIN events e ON c.id = e.client_id
       ${whereCondition}
       GROUP BY c.id
       ORDER BY ${sortColumn} ${sortDirection}
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM clients ${whereCondition}`,
      queryParams
    );

    const clients = clientsResult.rows.map(client => ({
      ...client,
      credit_limit: parseFloat(client.credit_limit),
      total_revenue: parseFloat(client.total_revenue),
      total_events: parseInt(client.total_events),
      completed_events: parseInt(client.completed_events)
    }));

    res.json({
      clients: clients
    });
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get clients'
    });
  }
});

// Get single client by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const clientResult = await query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    // Get client events
    const eventsResult = await query(
      `SELECT 
        id, name, event_date, status, actual_revenue, total_expenses,
        (actual_revenue - total_expenses) as profit
       FROM events 
       WHERE client_id = $1 
       ORDER BY event_date DESC`,
      [id]
    );

    // Get client invoices
    const invoicesResult = await query(
      `SELECT 
        id, invoice_number, issue_date, due_date, total_amount, paid_amount, status
       FROM invoices 
       WHERE client_id = $1 
       ORDER BY issue_date DESC`,
      [id]
    );

    // Get communication history
    const communicationResult = await query(
      `SELECT 
        cl.*,
        u.full_name as created_by_name
       FROM communication_logs cl
       LEFT JOIN users u ON cl.created_by = u.id
       WHERE cl.entity_type = 'client' AND cl.entity_id = $1
       ORDER BY cl.date DESC
       LIMIT 10`,
      [id]
    );

    const client = {
      ...clientResult.rows[0],
      credit_limit: parseFloat(clientResult.rows[0].credit_limit)
    };

    const events = eventsResult.rows.map(event => ({
      ...event,
      actual_revenue: parseFloat(event.actual_revenue),
      total_expenses: parseFloat(event.total_expenses),
      profit: parseFloat(event.profit)
    }));

    const invoices = invoicesResult.rows.map(invoice => ({
      ...invoice,
      total_amount: parseFloat(invoice.total_amount),
      paid_amount: parseFloat(invoice.paid_amount)
    }));

    res.json({
      client,
      events,
      invoices,
      communication_history: communicationResult.rows
    });
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get client'
    });
  }
});

// Create new client
router.post('/', authenticateToken, [
  body('name').notEmpty().withMessage('Client name is required'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('credit_limit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a positive number'),
  body('payment_terms').optional().isInt({ min: 0 }).withMessage('Payment terms must be a positive integer')
], logActivity('client_create'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const {
      name,
      email,
      phone,
      address,
      company,
      contact_person,
      credit_limit = 0,
      payment_terms = 30,
      notes
    } = req.body;

    // Check if client with same email already exists
    if (email) {
      const existingClient = await query(
        'SELECT id FROM clients WHERE email = $1',
        [email]
      );

      if (existingClient.rows.length > 0) {
        return res.status(400).json({
          error: 'Client Already Exists',
          message: 'A client with this email already exists'
        });
      }
    }

    const result = await query(
      `INSERT INTO clients (name, email, phone, address, company, contact_person, credit_limit, payment_terms, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, email, phone, address, company, contact_person, credit_limit, payment_terms, notes]
    );

    const client = {
      ...result.rows[0],
      credit_limit: parseFloat(result.rows[0].credit_limit)
    };

    res.status(201).json({
      message: 'Client created successfully',
      client
    });
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create client'
    });
  }
});

// Update client
router.put('/:id', authenticateToken, [
  body('name').optional().notEmpty().withMessage('Client name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('credit_limit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a positive number'),
  body('payment_terms').optional().isInt({ min: 0 }).withMessage('Payment terms must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['name', 'email', 'phone', 'address', 'company', 'contact_person', 'credit_limit', 'payment_terms', 'notes'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }

    // Check if email is being updated and already exists
    if (req.body.email) {
      const existingClient = await query(
        'SELECT id FROM clients WHERE email = $1 AND id != $2',
        [req.body.email, id]
      );

      if (existingClient.rows.length > 0) {
        return res.status(400).json({
          error: 'Email Already Exists',
          message: 'Another client with this email already exists'
        });
      }
    }

    values.push(id);

    const result = await query(
      `UPDATE clients SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    const client = {
      ...result.rows[0],
      credit_limit: parseFloat(result.rows[0].credit_limit)
    };

    res.json({
      message: 'Client updated successfully',
      client
    });
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update client'
    });
  }
});

// Delete client
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client has associated events
    const eventsResult = await query(
      'SELECT COUNT(*) as count FROM events WHERE client_id = $1',
      [id]
    );

    if (parseInt(eventsResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot Delete',
        message: 'Client has associated events and cannot be deleted'
      });
    }

    const result = await query(
      'DELETE FROM clients WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    res.json({
      message: 'Client deleted successfully'
    });
  } catch (err) {
    console.error('Delete client error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete client'
    });
  }
});

// Add communication log
router.post('/:id/communication', authenticateToken, [
  body('type').isIn(['email', 'phone', 'meeting', 'note']).withMessage('Invalid communication type'),
  body('subject').optional().notEmpty().withMessage('Subject cannot be empty'),
  body('content').notEmpty().withMessage('Content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { type, subject, content } = req.body;

    // Verify client exists
    const clientResult = await query('SELECT id FROM clients WHERE id = $1', [id]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    const result = await query(
      `INSERT INTO communication_logs (entity_type, entity_id, type, subject, content, created_by)
       VALUES ('client', $1, $2, $3, $4, $5)
       RETURNING *`,
      [id, type, subject, content, req.user.id]
    );

    res.status(201).json({
      message: 'Communication log added successfully',
      communication: result.rows[0]
    });
  } catch (err) {
    console.error('Add communication error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add communication log'
    });
  }
});

module.exports = router;