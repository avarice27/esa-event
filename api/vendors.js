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
        SELECT id, name, company, email, phone, address, service_category as service_type, 
               rating, payment_terms, is_active as active, created_at, updated_at
        FROM vendors 
        WHERE is_active = true 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query);
      res.status(200).json(result.rows);
    } 
    else if (req.method === 'POST') {
      const { name, company, email, phone, address, service_type, active } = req.body;
      
      const insertQuery = `
        INSERT INTO vendors (name, company, email, phone, address, service_category, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const values = [
        name,
        company || '',
        email || '',
        phone || '',
        address || '',
        service_type || '',
        active !== false
      ];
      
      const result = await client.query(insertQuery, values);
      const newVendor = result.rows[0];
      
      res.status(201).json({ 
        message: 'Vendor berhasil ditambahkan', 
        vendor: {
          ...newVendor,
          service_type: newVendor.service_category,
          active: newVendor.is_active
        }
      });
    }
    else if (req.method === 'PUT') {
      const { id, name, company, email, phone, address, service_type, active } = req.body;
      
      const updateQuery = `
        UPDATE vendors 
        SET name = $1, company = $2, email = $3, phone = $4, address = $5, 
            service_category = $6, is_active = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `;
      
      const values = [
        name,
        company || '',
        email || '',
        phone || '',
        address || '',
        service_type || '',
        active !== false,
        parseInt(id)
      ];
      
      const result = await client.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Vendor tidak ditemukan' });
      }
      
      const updatedVendor = result.rows[0];
      res.status(200).json({ 
        message: 'Vendor berhasil diupdate', 
        vendor: {
          ...updatedVendor,
          service_type: updatedVendor.service_category,
          active: updatedVendor.is_active
        }
      });
    }
    else if (req.method === 'DELETE') {
      const { id } = req.query;
      
      // Soft delete - set is_active to false
      const deleteQuery = `
        UPDATE vendors 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await client.query(deleteQuery, [parseInt(id)]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Vendor tidak ditemukan' });
      }
      
      res.status(200).json({ message: 'Vendor berhasil dihapus' });
    }
    else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Vendors API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
}