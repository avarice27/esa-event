import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, MapPin, DollarSign } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Event {
  id: number;
  name: string;
  description: string;
  event_date: string;
  end_date: string;
  venue: string;
  status: string;
  budget: number;
  actual_cost: number;
  revenue: number;
  client_name: string;
}

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    event_date: '',
    end_date: '',
    venue: '',
    status: 'planning',
    budget: 0,
    client_id: ''
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events');
      setEvents(response.data.events || []);
    } catch (error) {
      toast.error('Gagal memuat data events');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await axios.put(`/api/events/${editingEvent.id}`, formData);
        toast.success('Event berhasil diupdate');
      } else {
        await axios.post('/api/events', formData);
        toast.success('Event berhasil dibuat');
      }
      setShowModal(false);
      setEditingEvent(null);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan');
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description,
      event_date: event.event_date.split('T')[0],
      end_date: event.end_date?.split('T')[0] || '',
      venue: event.venue,
      status: event.status,
      budget: event.budget,
      client_id: ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Yakin ingin menghapus event ini?')) {
      try {
        await axios.delete(`/api/events/${id}`);
        toast.success('Event berhasil dihapus');
        fetchEvents();
      } catch (error) {
        toast.error('Gagal menghapus event');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      event_date: '',
      end_date: '',
      venue: '',
      status: 'planning',
      budget: 0,
      client_id: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600">Kelola semua event Anda</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Event</span>
        </button>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-200 overflow-hidden">
            {/* Card Header */}
            <div className="p-6 pb-4">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold text-gray-900 leading-tight line-clamp-2 flex-1 mr-3">
                  {event.name}
                </h3>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${getStatusColor(event.status)} flex-shrink-0`}>
                  {event.status}
                </span>
              </div>
              
              {event.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                  {event.description}
                </p>
              )}
            </div>

            {/* Card Body */}
            <div className="px-6 pb-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-700">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-lg mr-3">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {new Date(event.event_date).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-gray-500">Event Date</p>
                  </div>
                </div>
                
                <div className="flex items-center text-sm text-gray-700">
                  <div className="flex items-center justify-center w-8 h-8 bg-green-50 rounded-lg mr-3">
                    <MapPin className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{event.venue || 'TBD'}</p>
                    <p className="text-xs text-gray-500">Venue</p>
                  </div>
                </div>
                
                <div className="flex items-center text-sm text-gray-700">
                  <div className="flex items-center justify-center w-8 h-8 bg-purple-50 rounded-lg mr-3">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Rp {event.budget.toLocaleString('id-ID')}</p>
                    <p className="text-xs text-gray-500">Budget</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="text-sm">
                    <span className="text-gray-600">Profit: </span>
                    <span className={`font-bold text-lg ${(event.revenue - event.actual_cost) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Rp {((event.revenue || 0) - (event.actual_cost || 0)).toLocaleString('id-ID')}
                    </span>
                  </div>
                  {event.client_name && (
                    <p className="text-xs text-gray-500 mt-1">Client: {event.client_name}</p>
                  )}
                </div>
                <div className="flex space-x-1 ml-4">
                  <button
                    onClick={() => handleEdit(event)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="Edit Event"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Delete Event"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {editingEvent ? 'Edit Event' : 'Tambah Event Baru'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Event
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lokasi
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Budget
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEvent(null);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEvent ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}