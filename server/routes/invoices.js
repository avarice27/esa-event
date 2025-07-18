const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { authenticateToken, logActivity, checkResourceOwnership } = require('../middleware/auth');

const router = express.Router();

// Get all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      clientId, 
      eventId,
      startDate,
      endDate,
      search 
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `WHERE (e.created_by = $1 OR $2 IN ('admin', 'manager'))`;
    let params = [req.user.id, req.user.role];
    let paramCount = 2;

    if (status) {
      whereClause += ` AND i.status = $${++paramCount}`;
      params.push(status);
    }

    if (clientId) {
      whereClause += ` AND i.client_id = $${++paramCount}`;
      params.push(clientId);
    }

    if (eventId) {
      whereClause += ` AND i.event_id = $${++paramCount}`;
      params.push(eventId);
    }

    if (startDate) {
      whereClause += ` AND i.issue_date >= $${++paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND i.issue_date <= $${++paramCount}`;
      params.push(endDate);
    }

    if (search) {
      whereClause += ` AND (i.invoice_number ILIKE $${++paramCount} OR c.company_name ILIKE $${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount++;
    }

    const invoicesResult = await query(`
      SELECT 
        i.*,
        c.company_name as client_name,
        e.name as event_name,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN events e ON i.event_id = e.id
      LEFT JOIN users u ON i.created_by = u.id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `, [...params, limit, offset]);

    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN events e ON i.event_id = e.id
      ${whereClause}
    `, params.slice(0, paramCount - 2));

    const invoices = invoicesResult.rows.map(invoice => ({
      ...invoice,
      subtotal: parseFloat(invoice.subtotal),
      tax_rate: parseFloat(invoice.tax_rate || 0),
      tax_amount: parseFloat(invoice.tax_amount || 0),
      total_amount: parseFloat(invoice.total_amount),
      days_overdue: invoice.status === 'overdue' 
        ? Math.floor((new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24))
        : 0
    }));

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices'
    });
  }
});

// Get single invoice with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const invoiceResult = await query(`
      SELECT 
        i.*,
        c.company_name as client_name,
        c.contact_person as client_contact,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        c.city as client_city,
        c.country as client_country,
        e.name as event_name,
        e.event_date,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN events e ON i.event_id = e.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check access permissions
    const invoice = invoiceResult.rows[0];
    if (!['admin', 'manager'].includes(req.user.role)) {
      const eventCheck = await query(
        'SELECT created_by FROM events WHERE id = $1',
        [invoice.event_id]
      );
      
      if (eventCheck.rows.length === 0 || eventCheck.rows[0].created_by !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get invoice items
    const itemsResult = await query(`
      SELECT * FROM invoice_items 
      WHERE invoice_id = $1 
      ORDER BY created_at
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        invoice: {
          ...invoice,
          subtotal: parseFloat(invoice.subtotal),
          tax_rate: parseFloat(invoice.tax_rate || 0),
          tax_amount: parseFloat(invoice.tax_amount || 0),
          total_amount: parseFloat(invoice.total_amount),
          days_overdue: invoice.status === 'overdue' 
            ? Math.floor((new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24))
            : 0
        },
        items: itemsResult.rows.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          total_price: parseFloat(item.total_price)
        }))
      }
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice'
    });
  }
});

// Create new invoice
router.post('/', authenticateToken, [
  body('clientId').isUUID(),
  body('eventId').optional().isUUID(),
  body('issueDate').isISO8601(),
  body('dueDate').isISO8601(),
  body('items').isArray({ min: 1 }),
  body('items.*.description').trim().isLength({ min: 1 }),
  body('items.*.quantity').isNumeric().custom(value => value > 0),
  body('items.*.unitPrice').isNumeric().custom(value => value > 0),
  body('taxRate').optional().isNumeric().custom(value => value >= 0 && value <= 100),
  body('notes').optional().trim(),
  body('currency').optional().isLength({ min: 3, max: 3 })
], logActivity('invoice_create'), async (req, res) => {
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
      clientId,
      eventId,
      issueDate,
      dueDate,
      items,
      taxRate = 0,
      notes,
      currency = 'USD'
    } = req.body;

    // Verify client exists
    const clientCheck = await query('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Verify event exists and user has access (if eventId provided)
    if (eventId) {
      const eventCheck = await query(
        'SELECT id FROM events WHERE id = $1 AND (created_by = $2 OR $3 IN (\'admin\', \'manager\'))',
        [eventId, req.user.id, req.user.role]
      );
      
      if (eventCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Event not found or access denied'
        });
      }
    }

    const result = await transaction(async (client) => {
      // Generate invoice number
      const invoiceNumberResult = await client.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+') AS INTEGER)), 0) + 1 as next_number
        FROM invoices
        WHERE invoice_number ~ '^INV-[0-9]+$'
      `);
      
      const invoiceNumber = `INV-${String(invoiceNumberResult.rows[0].next_number).padStart(6, '0')}`;

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const taxAmount = (subtotal * taxRate) / 100;
      const totalAmount = subtotal + taxAmount;

      // Create invoice
      const invoiceResult = await client.query(`
        INSERT INTO invoices (
          invoice_number, event_id, client_id, issue_date, due_date,
          subtotal, tax_rate, tax_amount, total_amount, currency, notes, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        invoiceNumber, eventId, clientId, issueDate, dueDate,
        subtotal, taxRate, taxAmount, totalAmount, currency, notes, req.user.id
      ]);

      const invoice = invoiceResult.rows[0];

      // Create invoice items
      for (const item of items) {
        const totalPrice = item.quantity * item.unitPrice;
        await client.query(`
          INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5)
        `, [invoice.id, item.description, item.quantity, item.unitPrice, totalPrice]);
      }

      return invoice;
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: {
        invoice: {
          ...result,
          subtotal: parseFloat(result.subtotal),
          tax_rate: parseFloat(result.tax_rate || 0),
          tax_amount: parseFloat(result.tax_amount || 0),
          total_amount: parseFloat(result.total_amount)
        }
      }
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice'
    });
  }
});

// Update invoice
router.put('/:id', authenticateToken, [
  body('issueDate').optional().isISO8601(),
  body('dueDate').optional().isISO8601(),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.description').optional().trim().isLength({ min: 1 }),
  body('items.*.quantity').optional().isNumeric().custom(value => value > 0),
  body('items.*.unitPrice').optional().isNumeric().custom(value => value > 0),
  body('taxRate').optional().isNumeric().custom(value => value >= 0 && value <= 100),
  body('notes').optional().trim(),
  body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
], logActivity('invoice_update'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Check if invoice exists and user has access
    const invoiceCheck = await query(`
      SELECT i.*, e.created_by as event_owner
      FROM invoices i
      LEFT JOIN events e ON i.event_id = e.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (invoiceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const currentInvoice = invoiceCheck.rows[0];
    
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role) && 
        currentInvoice.event_owner !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await transaction(async (client) => {
      const { items, ...invoiceData } = req.body;
      
      // Update invoice if there are invoice fields to update
      if (Object.keys(invoiceData).length > 0) {
        const updates = [];
        const values = [];
        let paramCount = 1;

        const allowedFields = ['issue_date', 'due_date', 'tax_rate', 'notes', 'status'];
        const fieldMap = {
          issueDate: 'issue_date',
          dueDate: 'due_date',
          taxRate: 'tax_rate'
        };

        Object.keys(invoiceData).forEach(key => {
          const dbField = fieldMap[key] || key;
          if (allowedFields.includes(dbField)) {
            updates.push(`${dbField} = $${paramCount++}`);
            values.push(invoiceData[key]);
          }
        });

        if (updates.length > 0) {
          values.push(req.params.id);
          await client.query(`
            UPDATE invoices 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
          `, values);
        }
      }

      // Update items if provided
      if (items && items.length > 0) {
        // Delete existing items
        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);

        // Calculate new totals
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const taxRate = req.body.taxRate !== undefined ? req.body.taxRate : currentInvoice.tax_rate;
        const taxAmount = (subtotal * taxRate) / 100;
        const totalAmount = subtotal + taxAmount;

        // Update invoice totals
        await client.query(`
          UPDATE invoices 
          SET subtotal = $1, tax_amount = $2, total_amount = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [subtotal, taxAmount, totalAmount, req.params.id]);

        // Create new items
        for (const item of items) {
          const totalPrice = item.quantity * item.unitPrice;
          await client.query(`
            INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
            VALUES ($1, $2, $3, $4, $5)
          `, [req.params.id, item.description, item.quantity, item.unitPrice, totalPrice]);
        }
      }

      // Get updated invoice
      const updatedResult = await client.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
      return updatedResult.rows[0];
    });

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: {
        invoice: {
          ...result,
          subtotal: parseFloat(result.subtotal),
          tax_rate: parseFloat(result.tax_rate || 0),
          tax_amount: parseFloat(result.tax_amount || 0),
          total_amount: parseFloat(result.total_amount)
        }
      }
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice'
    });
  }
});

// Delete invoice
router.delete('/:id', authenticateToken, logActivity('invoice_delete'), async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      // Check if invoice exists and user has access
      const invoiceCheck = await client.query(`
        SELECT i.*, e.created_by as event_owner
        FROM invoices i
        LEFT JOIN events e ON i.event_id = e.id
        WHERE i.id = $1
      `, [req.params.id]);

      if (invoiceCheck.rows.length === 0) {
        throw new Error('Invoice not found');
      }

      const invoice = invoiceCheck.rows[0];
      
      // Check permissions
      if (!['admin', 'manager'].includes(req.user.role) && 
          invoice.event_owner !== req.user.id) {
        throw new Error('Access denied');
      }

      // Don't allow deletion of paid invoices
      if (invoice.status === 'paid') {
        throw new Error('Cannot delete paid invoices');
      }

      // Delete invoice items first
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
      
      // Delete invoice
      await client.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);

      return invoice;
    });

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete invoice'
    });
  }
});

// Mark invoice as sent
router.put('/:id/send', authenticateToken, logActivity('invoice_send'), async (req, res) => {
  try {
    const result = await query(`
      UPDATE invoices 
      SET status = 'sent', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'draft'
      RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or cannot be sent'
      });
    }

    res.json({
      success: true,
      message: 'Invoice marked as sent',
      data: {
        invoice: {
          ...result.rows[0],
          subtotal: parseFloat(result.rows[0].subtotal),
          tax_rate: parseFloat(result.rows[0].tax_rate || 0),
          tax_amount: parseFloat(result.rows[0].tax_amount || 0),
          total_amount: parseFloat(result.rows[0].total_amount)
        }
      }
    });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invoice'
    });
  }
});

// Mark invoice as paid
router.put('/:id/pay', authenticateToken, logActivity('invoice_pay'), async (req, res) => {
  try {
    const result = await query(`
      UPDATE invoices 
      SET status = 'paid', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('sent', 'overdue')
      RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or cannot be marked as paid'
      });
    }

    res.json({
      success: true,
      message: 'Invoice marked as paid',
      data: {
        invoice: {
          ...result.rows[0],
          subtotal: parseFloat(result.rows[0].subtotal),
          tax_rate: parseFloat(result.rows[0].tax_rate || 0),
          tax_amount: parseFloat(result.rows[0].tax_amount || 0),
          total_amount: parseFloat(result.rows[0].total_amount)
        }
      }
    });
  } catch (error) {
    console.error('Pay invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark invoice as paid'
    });
  }
});

// Get invoice statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_invoices,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_invoices,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total_amount ELSE 0 END), 0) as outstanding_amount
      FROM invoices i
      LEFT JOIN events e ON i.event_id = e.id
      WHERE (e.created_by = $1 OR $2 IN ('admin', 'manager') OR i.event_id IS NULL)
    `, [req.user.id, req.user.role]);

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        totalInvoices: parseInt(stats.total_invoices),
        draftInvoices: parseInt(stats.draft_invoices),
        sentInvoices: parseInt(stats.sent_invoices),
        paidInvoices: parseInt(stats.paid_invoices),
        overdueInvoices: parseInt(stats.overdue_invoices),
        totalAmount: parseFloat(stats.total_amount),
        paidAmount: parseFloat(stats.paid_amount),
        outstandingAmount: parseFloat(stats.outstanding_amount),
        collectionRate: stats.total_amount > 0 
          ? ((stats.paid_amount / stats.total_amount) * 100).toFixed(2)
          : 0
      }
    });
  } catch (error) {
    console.error('Invoice stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice statistics'
    });
  }
});

module.exports = router;