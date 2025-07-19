const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Generate invoice number
function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-4);
  return `INV-${year}${month}-${timestamp}`;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();

  try {
    if (req.method === 'GET') {
      const query = `
        SELECT i.*, c.name as client_name, e.name as event_name
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN events e ON i.event_id = e.id
        ORDER BY i.issue_date DESC, i.created_at DESC
      `;
      const result = await client.query(query);
      
      // Transform data to match frontend expectations
      const invoices = result.rows.map(row => ({
        id: row.id,
        invoice_number: row.invoice_number,
        client_id: row.client_id,
        client_name: row.client_name,
        event_id: row.event_id,
        event_name: row.event_name,
        amount: parseFloat(row.amount || 0),
        tax_amount: parseFloat(row.tax_amount || 0),
        total_amount: parseFloat(row.total_amount),
        status: row.status,
        issue_date: row.issue_date,
        due_date: row.due_date,
        paid_date: row.status === 'paid' ? row.issue_date : null,
        notes: row.notes,
        created_at: row.created_at
      }));
      
      res.status(200).json(invoices);
    } 
    else if (req.method === 'POST') {
      const { client_id, event_id, amount, tax_amount, due_date, notes } = req.body;
      
      // Get client and event names
      const clientQuery = 'SELECT name FROM clients WHERE id = $1';
      const eventQuery = 'SELECT name FROM events WHERE id = $1';
      
      const clientResult = await client.query(clientQuery, [client_id]);
      const eventResult = event_id ? await client.query(eventQuery, [event_id]) : { rows: [] };
      
      const insertQuery = `
        INSERT INTO invoices (invoice_number, client_id, event_id, issue_date, due_date, amount, tax_amount, total_amount, status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const invoiceNumber = generateInvoiceNumber();
      const totalAmount = (parseFloat(amount) || 0) + (parseFloat(tax_amount) || 0);
      
      const values = [
        invoiceNumber,
        parseInt(client_id),
        event_id ? parseInt(event_id) : null,
        new Date().toISOString().split('T')[0],
        due_date,
        parseFloat(amount) || 0,
        parseFloat(tax_amount) || 0,
        totalAmount,
        'pending',
        notes || ''
      ];
      
      const result = await client.query(insertQuery, values);
      const newInvoice = result.rows[0];
      
      res.status(201).json({ 
        message: 'Invoice berhasil dibuat', 
        invoice: {
          ...newInvoice,
          client_name: clientResult.rows[0]?.name || '',
          event_name: eventResult.rows[0]?.name || '',
          amount: parseFloat(newInvoice.amount),
          tax_amount: parseFloat(newInvoice.tax_amount),
          total_amount: parseFloat(newInvoice.total_amount)
        }
      });
    }
    else if (req.method === 'PUT') {
      const { id, status, amount, tax_amount, due_date, notes } = req.body;
      
      const updateQuery = `
        UPDATE invoices 
        SET status = $1, amount = $2, tax_amount = $3, total_amount = $4, due_date = $5, notes = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;
      
      const totalAmount = (parseFloat(amount) || 0) + (parseFloat(tax_amount) || 0);
      
      const values = [
        status || 'pending',
        parseFloat(amount) || 0,
        parseFloat(tax_amount) || 0,
        totalAmount,
        due_date,
        notes || '',
        parseInt(id)
      ];
      
      const result = await client.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Invoice tidak ditemukan' });
      }
      
      const updatedInvoice = result.rows[0];
      res.status(200).json({ 
        message: 'Invoice berhasil diupdate', 
        invoice: {
          ...updatedInvoice,
          amount: parseFloat(updatedInvoice.amount),
          tax_amount: parseFloat(updatedInvoice.tax_amount),
          total_amount: parseFloat(updatedInvoice.total_amount)
        }
      });
    }
    else if (req.method === 'DELETE') {
      const { id } = req.query;
      
      const deleteQuery = 'DELETE FROM invoices WHERE id = $1 RETURNING id';
      const result = await client.query(deleteQuery, [parseInt(id)]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Invoice tidak ditemukan' });
      }
      
      res.status(200).json({ message: 'Invoice berhasil dihapus' });
    }
    else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Invoices API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
}