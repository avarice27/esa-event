export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // Mock dashboard data
    const dashboardData = {
      totalRevenue: 125000,
      totalExpenses: 85000,
      netProfit: 40000,
      activeEvents: 12,
      recentTransactions: [
        {
          id: 1,
          description: 'Wedding Photography Package',
          amount: 15000,
          type: 'income',
          date: '2024-01-15'
        },
        {
          id: 2,
          description: 'Equipment Rental',
          amount: -3500,
          type: 'expense',
          date: '2024-01-14'
        }
      ]
    };

    res.status(200).json(dashboardData);
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}