export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const status = {
      message: 'API is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database_url_configured: !!process.env.DATABASE_URL,
      jwt_secret_configured: !!process.env.JWT_SECRET,
      vercel_deployment: !!process.env.VERCEL,
      status: 'OK'
    };

    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 'ERROR'
    });
  }
}