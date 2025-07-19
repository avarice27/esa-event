const bcrypt = require('bcryptjs');
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

  if (req.method === 'POST') {
    const client = await pool.connect();
    
    try {
      // Check if users already exist
      const checkQuery = 'SELECT COUNT(*) as count FROM users';
      const checkResult = await client.query(checkQuery);
      const userCount = parseInt(checkResult.rows[0].count);
      
      if (userCount > 0) {
        return res.status(200).json({ 
          message: 'Database already initialized', 
          userCount: userCount 
        });
      }

      // Hash password for 'password'
      const hashedPassword = await bcrypt.hash('password', 10);

      // Insert initial users
      const insertUsersQuery = `
        INSERT INTO users (username, email, password_hash, full_name, role) VALUES
        ('admin', 'admin@esaevent.com', $1, 'Administrator', 'admin'),
        ('manager', 'manager@esaevent.com', $1, 'Event Manager', 'manager'),
        ('staff', 'staff@esaevent.com', $1, 'Staff Member', 'user'),
        ('demo', 'demo@esaevent.com', $1, 'Demo User', 'user')
        RETURNING id, username, email, full_name, role
      `;
      
      const result = await client.query(insertUsersQuery, [hashedPassword]);
      
      res.status(201).json({
        message: 'Database initialized successfully!',
        users: result.rows,
        credentials: {
          admin: { email: 'admin@esaevent.com', password: 'password' },
          manager: { email: 'manager@esaevent.com', password: 'password' },
          staff: { email: 'staff@esaevent.com', password: 'password' },
          demo: { email: 'demo@esaevent.com', password: 'password' }
        }
      });
    } catch (error) {
      console.error('Database initialization error:', error);
      res.status(500).json({ 
        message: 'Failed to initialize database', 
        error: error.message 
      });
    } finally {
      client.release();
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}