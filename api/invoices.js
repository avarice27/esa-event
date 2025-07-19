// Mock invoices data
let invoices = [
  {
    id: 1,
    invoice_number: 'INV-2024-001',
    client_id: 1,
    client_name: 'PT. Maju Jaya',
    event_id: 1,
    event_name: 'Wedding Celebration - Andi & Sari',
    amount: 15000000,
    tax_amount: 1500000,
    total_amount: 16500000,
    status: 'paid',
    issue_date: '2024-01-15',
    due_date: '2024-02-14',
    paid_date: '2024-01-20',
    created_at: '2024-01-15'
  },
  {
    id: 2,
    invoice_number: 'INV-2024-002',
    client_id: 2,
    client_name: 'CV. Berkah Mandiri',
    event_id: 2,
    event_name: 'Corporate Event - PT. Maju Jaya',
    amount: 25000000,
    tax_amount: 2500000,
    total_amount: 27500000,
    status: 'pending',
    issue_date: '2024-01-20',
    due_date: '2024-02-19',
    paid_date: null,
    created_at: '2024-01-20'
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
    res.status(200).json(invoices);
  } 
  else if (req.method === 'POST') {
    const { client_id, client_name, event_id, event_name, amount, tax_amount, due_date } = req.body;
    
    const newInvoice = {
      id: invoices.length + 1,
      invoice_number: `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`,
      client_id: parseInt(client_id),
      client_name,
      event_id: parseInt(event_id),
      event_name,
      amount: parseInt(amount) || 0,
      tax_amount: parseInt(tax_amount) || 0,
      total_amount: (parseInt(amount) || 0) + (parseInt(tax_amount) || 0),
      status: 'pending',
      issue_date: new Date().toISOString().split('T')[0],
      due_date,
      paid_date: null,
      created_at: new Date().toISOString().split('T')[0]
    };
    
    invoices.push(newInvoice);
    res.status(201).json({ message: 'Invoice berhasil dibuat', invoice: newInvoice });
  }
  else if (req.method === 'PUT') {
    const { id, status, paid_date } = req.body;
    
    const invoiceIndex = invoices.findIndex(i => i.id === parseInt(id));
    if (invoiceIndex === -1) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan' });
    }
    
    invoices[invoiceIndex] = {
      ...invoices[invoiceIndex],
      status,
      paid_date: status === 'paid' ? (paid_date || new Date().toISOString().split('T')[0]) : null
    };
    
    res.status(200).json({ message: 'Invoice berhasil diupdate', invoice: invoices[invoiceIndex] });
  }
  else if (req.method === 'DELETE') {
    const { id } = req.query;
    
    const invoiceIndex = invoices.findIndex(i => i.id === parseInt(id));
    if (invoiceIndex === -1) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan' });
    }
    
    invoices.splice(invoiceIndex, 1);
    res.status(200).json({ message: 'Invoice berhasil dihapus' });
  }
  else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}