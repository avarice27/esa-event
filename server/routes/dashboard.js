const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard overview data
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Total events
    const eventsResult = await db.query(
      'SELECT COUNT(*) as total, status FROM events GROUP BY status'
    );

    // Revenue and expenses for current month
    const financialResult = await db.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
        COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
      FROM transactions 
      WHERE EXTRACT(MONTH FROM transaction_date) = $1 
      AND EXTRACT(YEAR FROM transaction_date) = $2
      AND status = 'completed'
    `, [currentMonth, currentYear]);

    // Upcoming events (next 30 days)
    const upcomingEventsResult = await db.query(`
      SELECT e.*, c.name as client_name
      FROM events e
      LEFT JOIN clients c ON e.client_id = c.id
      WHERE e.event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND e.status IN ('planning', 'confirmed')
      ORDER BY e.event_date ASC
      LIMIT 5
    `);

    // Recent transactions (last 10)
    const recentTransactionsResult = await db.query(`
      SELECT t.*, e.name as event_name, 
             COALESCE(c.name, v.name) as entity_name
      FROM transactions t
      LEFT JOIN events e ON t.event_id = e.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN vendors v ON t.vendor_id = v.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    // Monthly revenue trend (last 6 months)
    const monthlyTrendResult = await db.query(`
      SELECT 
        DATE_TRUNC('month', transaction_date) as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE transaction_date >= CURRENT_DATE - INTERVAL '6 months'
      AND status = 'completed'
      GROUP BY DATE_TRUNC('month', transaction_date)
      ORDER BY month ASC
    `);

    // Outstanding invoices
    const outstandingInvoicesResult = await db.query(`
      SELECT COUNT(*) as count, SUM(total_amount) as total_amount
      FROM invoices
      WHERE status IN ('sent', 'overdue')
    `);

    // Top performing events (by profit)
    const topEventsResult = await db.query(`
      SELECT e.name, e.revenue, e.actual_cost, 
             (e.revenue - e.actual_cost) as profit,
             e.profit_margin
      FROM events e
      WHERE e.status = 'completed'
      AND e.revenue > 0
      ORDER BY (e.revenue - e.actual_cost) DESC
      LIMIT 5
    `);

    const financial = financialResult.rows[0];
    const profit = (financial.total_revenue || 0) - (financial.total_expenses || 0);
    const profitMargin = financial.total_revenue > 0 
      ? ((profit / financial.total_revenue) * 100).toFixed(2)
      : 0;

    res.json({
      summary: {
        total_events: eventsResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        events_by_status: eventsResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        total_revenue: financial.total_revenue || 0,
        total_expenses: financial.total_expenses || 0,
        profit: profit,
        profit_margin: profitMargin,
        outstanding_invoices: {
          count: parseInt(outstandingInvoicesResult.rows[0].count) || 0,
          amount: outstandingInvoicesResult.rows[0].total_amount || 0
        }
      },
      upcoming_events: upcomingEventsResult.rows,
      recent_transactions: recentTransactionsResult.rows,
      monthly_trend: monthlyTrendResult.rows,
      top_events: topEventsResult.rows
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get financial KPIs
router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = "AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "AND transaction_date >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      case 'quarter':
        dateFilter = "AND transaction_date >= CURRENT_DATE - INTERVAL '90 days'";
        break;
      case 'year':
        dateFilter = "AND transaction_date >= CURRENT_DATE - INTERVAL '365 days'";
        break;
    }

    // Financial KPIs
    const kpisResult = await db.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        COUNT(DISTINCT event_id) as active_events,
        AVG(CASE WHEN type = 'income' THEN amount END) as avg_revenue_per_transaction,
        AVG(CASE WHEN type = 'expense' THEN amount END) as avg_expense_per_transaction
      FROM transactions
      WHERE status = 'completed' ${dateFilter}
    `);

    // Event completion rate
    const eventStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_events,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_events,
        AVG(CASE WHEN status = 'completed' THEN (revenue - actual_cost) END) as avg_profit_per_event
      FROM events
      WHERE created_at >= CURRENT_DATE - INTERVAL '${period === 'week' ? '7' : period === 'month' ? '30' : period === 'quarter' ? '90' : '365'} days'
    `);

    const kpis = kpisResult.rows[0];
    const eventStats = eventStatsResult.rows[0];
    
    const profit = (kpis.revenue || 0) - (kpis.expenses || 0);
    const profitMargin = kpis.revenue > 0 ? ((profit / kpis.revenue) * 100) : 0;
    const completionRate = eventStats.total_events > 0 
      ? ((eventStats.completed_events / eventStats.total_events) * 100) 
      : 0;

    res.json({
      period,
      kpis: {
        revenue: kpis.revenue || 0,
        expenses: kpis.expenses || 0,
        profit: profit,
        profit_margin: profitMargin.toFixed(2),
        active_events: parseInt(kpis.active_events) || 0,
        avg_revenue_per_transaction: kpis.avg_revenue_per_transaction || 0,
        avg_expense_per_transaction: kpis.avg_expense_per_transaction || 0,
        avg_profit_per_event: eventStats.avg_profit_per_event || 0,
        event_completion_rate: completionRate.toFixed(2),
        total_events: parseInt(eventStats.total_events) || 0,
        completed_events: parseInt(eventStats.completed_events) || 0,
        cancelled_events: parseInt(eventStats.cancelled_events) || 0
      }
    });
  } catch (error) {
    console.error('KPIs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// Get revenue vs expenses chart data
router.get('/revenue-expenses-chart', authenticateToken, async (req, res) => {
  try {
    const { period = 'month', months = 6 } = req.query;
    
    let dateInterval = '';
    let dateFormat = '';
    
    switch (period) {
      case 'day':
        dateInterval = `${months * 30} days`;
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateInterval = `${months * 4} weeks`;
        dateFormat = 'YYYY-"W"WW';
        break;
      case 'month':
        dateInterval = `${months} months`;
        dateFormat = 'YYYY-MM';
        break;
      case 'year':
        dateInterval = `${months} years`;
        dateFormat = 'YYYY';
        break;
      default:
        dateInterval = '6 months';
        dateFormat = 'YYYY-MM';
    }

    const chartDataResult = await db.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('${period}', transaction_date), '${dateFormat}') as period,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE transaction_date >= CURRENT_DATE - INTERVAL '${dateInterval}'
      AND status = 'completed'
      GROUP BY DATE_TRUNC('${period}', transaction_date)
      ORDER BY DATE_TRUNC('${period}', transaction_date) ASC
    `);

    res.json({
      period,
      data: chartDataResult.rows.map(row => ({
        period: row.period,
        revenue: parseFloat(row.revenue) || 0,
        expenses: parseFloat(row.expenses) || 0,
        profit: (parseFloat(row.revenue) || 0) - (parseFloat(row.expenses) || 0)
      }))
    });
  } catch (error) {
    console.error('Chart data fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

module.exports = router;