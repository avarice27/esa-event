const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active
    const userResult = await db.query(
      'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const logActivity = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log successful operations
      if (res.statusCode < 400 && req.user) {
        const logData = {
          user_id: req.user.id,
          action: action || `${req.method} ${req.route?.path || req.path}`,
          entity_type: req.params.id ? req.baseUrl.split('/').pop() : null,
          entity_id: req.params.id || null,
          details: {
            method: req.method,
            path: req.path,
            body: req.method !== 'GET' ? req.body : null
          },
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        };

        db.query(
          `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [logData.user_id, logData.action, logData.entity_type, logData.entity_id, 
           JSON.stringify(logData.details), logData.ip_address, logData.user_agent]
        ).catch(err => console.error('Activity logging error:', err));
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  logActivity
};