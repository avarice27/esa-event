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
        SELECT id, name, company, email, phone, address, credit_limit, 
               credit_terms as payment_terms, is_active as active, 
               created_at, updated_at
        FROM clients 
        WHERE is_active = true 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query);
      res.status(200).json(result.rows);
    } 
    else if (req.method === 'POST') {
      const { name, company, email, phone, address, credit_limit, payment_terms, active } = req.body;
      
      const insertQuery = `
        INSERT INTO clients (name, company, email, phone, address, credit_limit, credit_terms, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const values = [
        name,
        company || '',
        email || '',
        phone || '',
        address || '',
        parseFloat(credit_limit) || 0,
        parseInt(payment_terms) || 30,
        active !== false
      ];
      
      const result = await client.query(insertQuery, values);
      const newClient = result.rows[0];
      
      res.status(201).json({ 
        message: 'Client berhasil ditambahkan', 
        client: {
          ...newClient,
          payment_terms: newClient.credit_terms,
          active: newClient.is_active
        }
      });
    }
    else if (req.method === 'PUT') {
      const { id, name, company, email, phone, address, credit_limit, payment_terms, active } = req.body;
      
      const updateQuery = `
        UPDATE clients 
        SET name = $1, company = $2, email = $3, phone = $4, address = $5, 
            credit_limit = $6, credit_terms = $7, is_active = $8, updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `;
      
      const values = [
        name,
        company || '',
        email || '',
        phone || '',
        address || '',
        parseFloat(credit_limit) || 0,
        parseInt(payment_terms) || 30,
        active !== false,
        parseInt(id)
      ];
      
      const result = await client.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Client tidak ditemukan' });
      }
      
      const updatedClient = result.rows[0];
      res.status(200).json({ 
        message: 'Client berhasil diupdate', 
        client: {
          ...updatedClient,
          payment_terms: updatedClient.credit_terms,
          active: updatedClient.is_active
        }
      });
    }
    else if (req.method === 'DELETE') {
      const { id } = req.query;
      
      // Soft delete - set is_active to false
      const deleteQuery = `
        UPDATE clients 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await client.query(deleteQuery, [parseInt(id)]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Client tidak ditemukan' });
      }
      
      res.status(200).json({ message: 'Client berhasil dihapus' });
    }
    else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Clients API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
}