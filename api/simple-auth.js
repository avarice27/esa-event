const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

      // Simple hardcoded check
      if (email === 'admin@esaevent.com' && password === 'password') {
        const token = jwt.sign(
          { userId: 1, email: 'admin@esaevent.com', role: 'admin' },
          'simple-secret-key',
          { expiresIn: '24h' }
        );

        return res.status(200).json({
          message: 'Login successful',
          token,
          user: {
            id: 1,
            username: 'admin',
            email: 'admin@esaevent.com',
            full_name: 'Administrator',
            role: 'admin'
          }
        });
      }

      return res.status(401).json({ message: 'Invalid credentials' });
    } catch (error) {
      console.error('Simple auth error:', error);
      return res.status(500).json({ message: 'Server error: ' + error.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}