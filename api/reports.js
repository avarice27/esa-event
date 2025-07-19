export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { type, start_date, end_date } = req.query;
    
    // Mock report data
    const reportData = {
      financial_summary: {
        total_income: 40000000,
        total_expenses: 15000000,
        net_profit: 25000000,
        profit_margin: 62.5
      },
      monthly_revenue: [
        { month: 'Jan 2024', income: 15000000, expenses: 5000000, profit: 10000000 },
        { month: 'Feb 2024', income: 25000000, expenses: 10000000, profit: 15000000 }
      ],
      top_clients: [
        { name: 'PT. Maju Jaya', total_revenue: 25000000, events_count: 3 },
        { name: 'CV. Berkah Mandiri', total_revenue: 15000000, events_count: 2 }
      ],
      event_performance: [
        { event_name: 'Wedding Celebration', revenue: 15000000, profit: 10000000, margin: 66.7 },
        { event_name: 'Corporate Event', revenue: 25000000, profit: 15000000, margin: 60.0 }
      ],
      expense_breakdown: [
        { category: 'Equipment', amount: 8000000, percentage: 53.3 },
        { category: 'Transportation', amount: 4000000, percentage: 26.7 },
        { category: 'Marketing', amount: 3000000, percentage: 20.0 }
      ]
    };

    res.status(200).json(reportData);
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}