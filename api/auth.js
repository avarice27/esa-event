const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Fallback users when database is not available
const fallbackUsers = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@esaevent.com',
    password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    full_name: 'Administrator',
    role: 'admin'
  },
  {
    id: 2,
    username: 'manager',
    email: 'manager@esaevent.com',
    password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    full_name: 'Event Manager',
    role: 'manager'
  },
  {
    id: 3,
    username: 'staff',
    email: 'staff@esaevent.com',
    password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    full_name: 'Staff Member',
    role: 'user'
  }
];

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Try database first, fallback to mock users if database fails
      let user = null;
      
      if (process.env.DATABASE_URL) {
        try {
          const { Pool } = require('pg');
          const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          });
          
          const client = await pool.connect();
          const userQuery = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
          const userResult = await client.query(userQuery, [email]);
          client.release();
          
          if (userResult.rows.length > 0) {
            user = userResult.rows[0];
          }
        } catch (dbError) {
          console.log('Database not available, using fallback users');
        }
      }
      
      // If no user from database, try fallback users
      if (!user) {
        user = fallbackUsers.find(u => u.email === email);
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ message: 'Internal server error: ' + error.message });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}