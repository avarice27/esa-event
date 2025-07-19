// Mock vendors data
let vendors = [
  {
    id: 1,
    name: 'CV. Foto Indah',
    company: 'CV. Foto Indah',
    email: 'contact@fotoindah.com',
    phone: '021-11111111',
    address: 'Jl. Kemang Raya No. 88, Jakarta',
    service_type: 'Photography',
    active: true,
    created_at: '2024-01-10'
  },
  {
    id: 2,
    name: 'PT. Sound System Pro',
    company: 'PT. Sound System Pro',
    email: 'info@soundpro.com',
    phone: '021-22222222',
    address: 'Jl. Gatot Subroto No. 45, Jakarta',
    service_type: 'Audio Equipment',
    active: true,
    created_at: '2024-01-12'
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
    res.status(200).json(vendors);
  } 
  else if (req.method === 'POST') {
    const { name, company, email, phone, address, service_type, active } = req.body;
    
    const newVendor = {
      id: vendors.length + 1,
      name,
      company,
      email,
      phone,
      address,
      service_type,
      active: active !== false,
      created_at: new Date().toISOString().split('T')[0]
    };
    
    vendors.push(newVendor);
    res.status(201).json({ message: 'Vendor berhasil ditambahkan', vendor: newVendor });
  }
  else if (req.method === 'PUT') {
    const { id, name, company, email, phone, address, service_type, active } = req.body;
    
    const vendorIndex = vendors.findIndex(v => v.id === parseInt(id));
    if (vendorIndex === -1) {
      return res.status(404).json({ message: 'Vendor tidak ditemukan' });
    }
    
    vendors[vendorIndex] = {
      ...vendors[vendorIndex],
      name,
      company,
      email,
      phone,
      address,
      service_type,
      active: active !== false
    };
    
    res.status(200).json({ message: 'Vendor berhasil diupdate', vendor: vendors[vendorIndex] });
  }
  else if (req.method === 'DELETE') {
    const { id } = req.query;
    
    const vendorIndex = vendors.findIndex(v => v.id === parseInt(id));
    if (vendorIndex === -1) {
      return res.status(404).json({ message: 'Vendor tidak ditemukan' });
    }
    
    vendors.splice(vendorIndex, 1);
    res.status(200).json({ message: 'Vendor berhasil dihapus' });
  }
  else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}