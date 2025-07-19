const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

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
        SELECT t.*, e.name as event_name, c.name as client_name, v.name as vendor_name
        FROM transactions t
        LEFT JOIN events e ON t.event_id = e.id
        LEFT JOIN clients c ON t.client_id = c.id
        LEFT JOIN vendors v ON t.vendor_id = v.id
        ORDER BY t.transaction_date DESC, t.created_at DESC
      `;
      const result = await client.query(query);
      
      // Transform data to match frontend expectations
      const transactions = result.rows.map(row => ({
        id: row.id,
        type: row.type,
        category: row.category,
        description: row.description,
        amount: parseFloat(row.amount),
        date: row.transaction_date,
        status: row.status,
        event_name: row.event_name,
        client_name: row.client_name,
        vendor_name: row.vendor_name,
        payment_method: row.payment_method,
        reference_number: row.reference_number,
        created_at: row.created_at
      }));
      
      res.status(200).json(transactions);
    } 
    else if (req.method === 'POST') {
      const { type, category, description, amount, date, status, event_id, client_id, vendor_id, payment_method, reference_number } = req.body;
      
      const insertQuery = `
        INSERT INTO transactions (type, category, description, amount, transaction_date, status, event_id, client_id, vendor_id, payment_method, reference_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const values = [
        type,
        category,
        description,
        parseFloat(amount) || 0,
        date,
        status || 'pending',
        event_id || null,
        client_id || null,
        vendor_id || null,
        payment_method || null,
        reference_number || null
      ];
      
      const result = await client.query(insertQuery, values);
      const newTransaction = result.rows[0];
      
      res.status(201).json({ 
        message: 'Transaksi berhasil ditambahkan', 
        transaction: {
          ...newTransaction,
          amount: parseFloat(newTransaction.amount),
          date: newTransaction.transaction_date
        }
      });
    }
    else if (req.method === 'PUT') {
      const { id, type, category, description, amount, date, status, event_id, client_id, vendor_id, payment_method, reference_number } = req.body;
      
      const updateQuery = `
        UPDATE transactions 
        SET type = $1, category = $2, description = $3, amount = $4, transaction_date = $5, 
            status = $6, event_id = $7, client_id = $8, vendor_id = $9, payment_method = $10, 
            reference_number = $11, updated_at = NOW()
        WHERE id = $12
        RETURNING *
      `;
      
      const values = [
        type,
        category,
        description,
        parseFloat(amount) || 0,
        date,
        status || 'pending',
        event_id || null,
        client_id || null,
        vendor_id || null,
        payment_method || null,
        reference_number || null,
        parseInt(id)
      ];
      
      const result = await client.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
      }
      
      const updatedTransaction = result.rows[0];
      res.status(200).json({ 
        message: 'Transaksi berhasil diupdate', 
        transaction: {
          ...updatedTransaction,
          amount: parseFloat(updatedTransaction.amount),
          date: updatedTransaction.transaction_date
        }
      });
    }
    else if (req.method === 'DELETE') {
      const { id } = req.query;
      
      const deleteQuery = 'DELETE FROM transactions WHERE id = $1 RETURNING id';
      const result = await client.query(deleteQuery, [parseInt(id)]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
      }
      
      res.status(200).json({ message: 'Transaksi berhasil dihapus' });
    }
    else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Transactions API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
}