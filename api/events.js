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
        SELECT e.*, c.name as client_name
        FROM events e
        LEFT JOIN clients c ON e.client_id = c.id
        ORDER BY e.event_date DESC, e.created_at DESC
      `;
      const result = await client.query(query);
      
      // Transform data to match frontend expectations
      const events = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        start_date: row.event_date,
        end_date: row.end_date,
        location: row.venue,
        status: row.status,
        budget: parseFloat(row.budget),
        client_id: row.client_id,
        client_name: row.client_name,
        actual_cost: parseFloat(row.actual_cost) || 0,
        revenue: parseFloat(row.revenue) || 0,
        created_at: row.created_at
      }));
      
      res.status(200).json(events);
    } 
    else if (req.method === 'POST') {
      const { name, description, start_date, end_date, location, status, budget, client_id } = req.body;
      
      const insertQuery = `
        INSERT INTO events (name, description, event_date, end_date, venue, status, budget, client_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const values = [
        name,
        description || '',
        start_date,
        end_date || start_date,
        location || '',
        status || 'planning',
        parseFloat(budget) || 0,
        client_id || null
      ];
      
      const result = await client.query(insertQuery, values);
      const newEvent = result.rows[0];
      
      res.status(201).json({ 
        message: 'Event berhasil ditambahkan', 
        event: {
          ...newEvent,
          start_date: newEvent.event_date,
          end_date: newEvent.end_date,
          location: newEvent.venue,
          budget: parseFloat(newEvent.budget)
        }
      });
    }
    else if (req.method === 'PUT') {
      const { id, name, description, start_date, end_date, location, status, budget, client_id } = req.body;
      
      const updateQuery = `
        UPDATE events 
        SET name = $1, description = $2, event_date = $3, end_date = $4, venue = $5, 
            status = $6, budget = $7, client_id = $8, updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `;
      
      const values = [
        name,
        description || '',
        start_date,
        end_date || start_date,
        location || '',
        status || 'planning',
        parseFloat(budget) || 0,
        client_id || null,
        parseInt(id)
      ];
      
      const result = await client.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Event tidak ditemukan' });
      }
      
      const updatedEvent = result.rows[0];
      res.status(200).json({ 
        message: 'Event berhasil diupdate', 
        event: {
          ...updatedEvent,
          start_date: updatedEvent.event_date,
          end_date: updatedEvent.end_date,
          location: updatedEvent.venue,
          budget: parseFloat(updatedEvent.budget)
        }
      });
    }
    else if (req.method === 'DELETE') {
      const { id } = req.query;
      
      const deleteQuery = 'DELETE FROM events WHERE id = $1 RETURNING id';
      const result = await client.query(deleteQuery, [parseInt(id)]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Event tidak ditemukan' });
      }
      
      res.status(200).json({ message: 'Event berhasil dihapus' });
    }
    else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Events API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
}