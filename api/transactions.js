// Mock transactions data
let transactions = [
  {
    id: 1,
    type: 'income',
    category: 'event',
    description: 'Wedding Photography Package',
    amount: 15000000,
    date: '2024-01-15',
    status: 'approved',
    created_at: '2024-01-15'
  },
  {
    id: 2,
    type: 'expense',
    category: 'equipment',
    description: 'Camera Equipment Rental',
    amount: 3500000,
    date: '2024-01-14',
    status: 'approved',
    created_at: '2024-01-14'
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

  if (req.method === 'GET') {
    res.status(200).json(transactions);
  } 
  else if (req.method === 'POST') {
    const { type, category, description, amount, date, status } = req.body;
    
    const newTransaction = {
      id: transactions.length + 1,
      type,
      category,
      description,
      amount: parseInt(amount) || 0,
      date,
      status: status || 'pending',
      created_at: new Date().toISOString().split('T')[0]
    };
    
    transactions.push(newTransaction);
    res.status(201).json({ message: 'Transaksi berhasil ditambahkan', transaction: newTransaction });
  }
  else if (req.method === 'PUT') {
    const { id, type, category, description, amount, date, status } = req.body;
    
    const transactionIndex = transactions.findIndex(t => t.id === parseInt(id));
    if (transactionIndex === -1) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }
    
    transactions[transactionIndex] = {
      ...transactions[transactionIndex],
      type,
      category,
      description,
      amount: parseInt(amount) || 0,
      date,
      status: status || 'pending'
    };
    
    res.status(200).json({ message: 'Transaksi berhasil diupdate', transaction: transactions[transactionIndex] });
  }
  else if (req.method === 'DELETE') {
    const { id } = req.query;
    
    const transactionIndex = transactions.findIndex(t => t.id === parseInt(id));
    if (transactionIndex === -1) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }
    
    transactions.splice(transactionIndex, 1);
    res.status(200).json({ message: 'Transaksi berhasil dihapus' });
  }
  else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}