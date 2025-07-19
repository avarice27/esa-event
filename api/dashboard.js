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
      // Get current month date range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Financial Summary for current month
      const financialQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net_profit
        FROM transactions 
        WHERE transaction_date BETWEEN $1 AND $2 AND status = 'completed'
      `;
      const financialResult = await client.query(financialQuery, [startOfMonth, endOfMonth]);
      const financial = financialResult.rows[0];

      // Active Events Count
      const eventsQuery = `
        SELECT COUNT(*) as active_events
        FROM events 
        WHERE status IN ('planning', 'confirmed', 'in_progress')
      `;
      const eventsResult = await client.query(eventsQuery);
      const activeEvents = parseInt(eventsResult.rows[0].active_events);

      // Recent Transactions
      const recentQuery = `
        SELECT id, description, amount, type, transaction_date as date
        FROM transactions 
        ORDER BY created_at DESC 
        LIMIT 10
      `;
      const recentResult = await client.query(recentQuery);
      const recentTransactions = recentResult.rows.map(row => ({
        id: row.id,
        description: row.description,
        amount: row.type === 'expense' ? -parseFloat(row.amount) : parseFloat(row.amount),
        type: row.type,
        date: row.date
      }));

      // Pending Invoices Count
      const invoicesQuery = `
        SELECT COUNT(*) as pending_invoices, COALESCE(SUM(total_amount), 0) as pending_amount
        FROM invoices 
        WHERE status IN ('draft', 'sent')
      `;
      const invoicesResult = await client.query(invoicesQuery);
      const invoiceData = invoicesResult.rows[0];

      const dashboardData = {
        totalRevenue: parseFloat(financial.total_revenue),
        totalExpenses: parseFloat(financial.total_expenses),
        netProfit: parseFloat(financial.net_profit),
        activeEvents: activeEvents,
        pendingInvoices: parseInt(invoiceData.pending_invoices),
        pendingAmount: parseFloat(invoiceData.pending_amount),
        recentTransactions: recentTransactions
      };

      res.status(200).json(dashboardData);
    } catch (error) {
      console.error('Dashboard API error:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}