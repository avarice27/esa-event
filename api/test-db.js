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

  if (req.method === 'GET') {
    const client = await pool.connect();
    
    try {
      // Test database connection
      const result = await client.query('SELECT NOW() as current_time');
      
      // Check if users table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      // Count users if table exists
      let userCount = 0;
      if (tableCheck.rows[0].exists) {
        const userCountResult = await client.query('SELECT COUNT(*) as count FROM users');
        userCount = parseInt(userCountResult.rows[0].count);
      }
      
      res.status(200).json({
        message: 'Database connection successful!',
        current_time: result.rows[0].current_time,
        users_table_exists: tableCheck.rows[0].exists,
        user_count: userCount,
        database_url_configured: !!process.env.DATABASE_URL
      });
    } catch (error) {
      console.error('Database test error:', error);
      res.status(500).json({ 
        message: 'Database connection failed', 
        error: error.message,
        database_url_configured: !!process.env.DATABASE_URL
      });
    } finally {
      client.release();
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}