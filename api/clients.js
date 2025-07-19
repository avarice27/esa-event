// Mock clients data
let clients = [
  {
    id: 1,
    name: 'PT. Maju Jaya',
    company: 'PT. Maju Jaya',
    email: 'contact@majujaya.com',
    phone: '021-12345678',
    address: 'Jl. Sudirman No. 123, Jakarta',
    credit_limit: 50000000,
    payment_terms: 30,
    active: true,
    created_at: '2024-01-15'
  },
  {
    id: 2,
    name: 'CV. Berkah Mandiri',
    company: 'CV. Berkah Mandiri',
    email: 'info@berkahmandiri.com',
    phone: '021-87654321',
    address: 'Jl. Thamrin No. 456, Jakarta',
    credit_limit: 25000000,
    payment_terms: 14,
    active: true,
    created_at: '2024-01-10'
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
    res.status(200).json(clients);
  } 
  else if (req.method === 'POST') {
    const { name, company, email, phone, address, credit_limit, payment_terms, active } = req.body;
    
    const newClient = {
      id: clients.length + 1,
      name,
      company,
      email,
      phone,
      address,
      credit_limit: parseInt(credit_limit) || 0,
      payment_terms: parseInt(payment_terms) || 30,
      active: active !== false,
      created_at: new Date().toISOString().split('T')[0]
    };
    
    clients.push(newClient);
    res.status(201).json({ message: 'Client berhasil ditambahkan', client: newClient });
  }
  else if (req.method === 'PUT') {
    const { id, name, company, email, phone, address, credit_limit, payment_terms, active } = req.body;
    
    const clientIndex = clients.findIndex(c => c.id === parseInt(id));
    if (clientIndex === -1) {
      return res.status(404).json({ message: 'Client tidak ditemukan' });
    }
    
    clients[clientIndex] = {
      ...clients[clientIndex],
      name,
      company,
      email,
      phone,
      address,
      credit_limit: parseInt(credit_limit) || 0,
      payment_terms: parseInt(payment_terms) || 30,
      active: active !== false
    };
    
    res.status(200).json({ message: 'Client berhasil diupdate', client: clients[clientIndex] });
  }
  else if (req.method === 'DELETE') {
    const { id } = req.query;
    
    const clientIndex = clients.findIndex(c => c.id === parseInt(id));
    if (clientIndex === -1) {
      return res.status(404).json({ message: 'Client tidak ditemukan' });
    }
    
    clients.splice(clientIndex, 1);
    res.status(200).json({ message: 'Client berhasil dihapus' });
  }
  else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}