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
      const { start_date, end_date } = req.query;
      const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const endDate = end_date || new Date().toISOString().split('T')[0];

      // Financial Summary
      const financialQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net_profit
        FROM transactions 
        WHERE transaction_date BETWEEN $1 AND $2 AND status = 'completed'
      `;
      const financialResult = await client.query(financialQuery, [startDate, endDate]);
      const financial = financialResult.rows[0];
      const profitMargin = financial.total_income > 0 ? (financial.net_profit / financial.total_income * 100) : 0;

      // Monthly Revenue Trend
      const monthlyQuery = `
        SELECT 
          TO_CHAR(transaction_date, 'Mon YYYY') as month,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as profit
        FROM transactions 
        WHERE transaction_date BETWEEN $1 AND $2 AND status = 'completed'
        GROUP BY TO_CHAR(transaction_date, 'YYYY-MM'), TO_CHAR(transaction_date, 'Mon YYYY')
        ORDER BY TO_CHAR(transaction_date, 'YYYY-MM')
      `;
      const monthlyResult = await client.query(monthlyQuery, [startDate, endDate]);

      // Top Clients
      const clientsQuery = `
        SELECT 
          c.name,
          COALESCE(SUM(t.amount), 0) as total_revenue,
          COUNT(DISTINCT e.id) as events_count
        FROM clients c
        LEFT JOIN events e ON c.id = e.client_id
        LEFT JOIN transactions t ON e.id = t.event_id AND t.type = 'income' AND t.status = 'completed'
        WHERE t.transaction_date BETWEEN $1 AND $2 OR t.transaction_date IS NULL
        GROUP BY c.id, c.name
        HAVING COALESCE(SUM(t.amount), 0) > 0
        ORDER BY total_revenue DESC
        LIMIT 10
      `;
      const clientsResult = await client.query(clientsQuery, [startDate, endDate]);

      // Event Performance
      const eventsQuery = `
        SELECT 
          e.name as event_name,
          COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as revenue,
          COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expenses,
          COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as profit
        FROM events e
        LEFT JOIN transactions t ON e.id = t.event_id AND t.status = 'completed'
        WHERE t.transaction_date BETWEEN $1 AND $2 OR t.transaction_date IS NULL
        GROUP BY e.id, e.name
        HAVING COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) > 0
        ORDER BY revenue DESC
        LIMIT 10
      `;
      const eventsResult = await client.query(eventsQuery, [startDate, endDate]);

      // Expense Breakdown
      const expenseQuery = `
        SELECT 
          category,
          SUM(amount) as amount
        FROM transactions 
        WHERE type = 'expense' AND transaction_date BETWEEN $1 AND $2 AND status = 'completed'
        GROUP BY category
        ORDER BY amount DESC
      `;
      const expenseResult = await client.query(expenseQuery, [startDate, endDate]);
      
      const totalExpenses = parseFloat(financial.total_expenses);
      const expenseBreakdown = expenseResult.rows.map(row => ({
        category: row.category,
        amount: parseFloat(row.amount),
        percentage: totalExpenses > 0 ? (parseFloat(row.amount) / totalExpenses * 100).toFixed(1) : 0
      }));

      const reportData = {
        financial_summary: {
          total_income: parseFloat(financial.total_income),
          total_expenses: parseFloat(financial.total_expenses),
          net_profit: parseFloat(financial.net_profit),
          profit_margin: parseFloat(profitMargin.toFixed(1))
        },
        monthly_revenue: monthlyResult.rows.map(row => ({
          month: row.month,
          income: parseFloat(row.income),
          expenses: parseFloat(row.expenses),
          profit: parseFloat(row.profit)
        })),
        top_clients: clientsResult.rows.map(row => ({
          name: row.name,
          total_revenue: parseFloat(row.total_revenue),
          events_count: parseInt(row.events_count)
        })),
        event_performance: eventsResult.rows.map(row => {
          const revenue = parseFloat(row.revenue);
          const expenses = parseFloat(row.expenses);
          const profit = parseFloat(row.profit);
          const margin = revenue > 0 ? (profit / revenue * 100) : 0;
          
          return {
            event_name: row.event_name,
            revenue,
            profit,
            margin: parseFloat(margin.toFixed(1))
          };
        }),
        expense_breakdown: expenseBreakdown
      };

      res.status(200).json(reportData);
    } catch (error) {
      console.error('Reports API error:', error);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}