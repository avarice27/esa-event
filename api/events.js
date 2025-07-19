// Mock events data
let events = [
  {
    id: 1,
    name: 'Wedding Celebration - Andi & Sari',
    description: 'Paket lengkap wedding photography dan videography',
    start_date: '2024-02-15',
    end_date: '2024-02-15',
    location: 'Hotel Grand Indonesia, Jakarta',
    status: 'confirmed',
    budget: 25000000,
    created_at: '2024-01-10'
  },
  {
    id: 2,
    name: 'Corporate Event - PT. Maju Jaya',
    description: 'Annual company gathering dan team building',
    start_date: '2024-03-20',
    end_date: '2024-03-22',
    location: 'Puncak Resort, Bogor',
    status: 'planning',
    budget: 50000000,
    created_at: '2024-01-15'
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
    res.status(200).json(events);
  } 
  else if (req.method === 'POST') {
    const { name, description, start_date, end_date, location, status, budget } = req.body;
    
    const newEvent = {
      id: events.length + 1,
      name,
      description,
      start_date,
      end_date,
      location,
      status: status || 'planning',
      budget: parseInt(budget) || 0,
      created_at: new Date().toISOString().split('T')[0]
    };
    
    events.push(newEvent);
    res.status(201).json({ message: 'Event berhasil ditambahkan', event: newEvent });
  }
  else if (req.method === 'PUT') {
    const { id, name, description, start_date, end_date, location, status, budget } = req.body;
    
    const eventIndex = events.findIndex(e => e.id === parseInt(id));
    if (eventIndex === -1) {
      return res.status(404).json({ message: 'Event tidak ditemukan' });
    }
    
    events[eventIndex] = {
      ...events[eventIndex],
      name,
      description,
      start_date,
      end_date,
      location,
      status: status || 'planning',
      budget: parseInt(budget) || 0
    };
    
    res.status(200).json({ message: 'Event berhasil diupdate', event: events[eventIndex] });
  }
  else if (req.method === 'DELETE') {
    const { id } = req.query;
    
    const eventIndex = events.findIndex(e => e.id === parseInt(id));
    if (eventIndex === -1) {
      return res.status(404).json({ message: 'Event tidak ditemukan' });
    }
    
    events.splice(eventIndex, 1);
    res.status(200).json({ message: 'Event berhasil dihapus' });
  }
  else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}