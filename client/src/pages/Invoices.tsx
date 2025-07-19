import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Download, Send } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Invoice {
  id: number;
  invoice_number: string;
  event_name: string;
  client_name: string;
  issue_date: string;
  due_date: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  paid_date?: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState({ status: '', client_id: '' });
  const [formData, setFormData] = useState({
    event_id: '',
    client_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    subtotal: 0,
    tax_amount: 0,
    notes: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }]
  });

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await axios.get('/api/invoices');
      setInvoices(response.data);
    } catch (error) {
      toast.error('Gagal memuat data invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invoiceData = {
        ...formData,
        total_amount: formData.subtotal + formData.tax_amount
      };

      if (editingInvoice) {
        await axios.put(`/api/invoices/${editingInvoice.id}`, invoiceData);
        toast.success('Invoice berhasil diupdate');
      } else {
        await axios.post('/api/invoices', invoiceData);
        toast.success('Invoice berhasil dibuat');
      }
      setShowModal(false);
      setEditingInvoice(null);
      resetForm();
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan');
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      event_id: '',
      client_id: '',
      issue_date: invoice.issue_date.split('T')[0],
      due_date: invoice.due_date.split('T')[0],
      subtotal: invoice.amount,
      tax_amount: invoice.tax_amount,
      notes: '',
      items: [{ description: '', quantity: 1, unit_price: 0 }]
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Yakin ingin menghapus invoice ini?')) {
      try {
        await axios.delete(`/api/invoices/${id}`);
        toast.success('Invoice berhasil dihapus');
        fetchInvoices();
      } catch (error) {
        toast.error('Gagal menghapus invoice');
      }
    }
  };

  const handleDownloadPDF = async (id: number) => {
    try {
      const response = await axios.get(`/api/invoices/${id}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Gagal download PDF');
    }
  };

  const handleSendInvoice = async (id: number) => {
    try {
      await axios.post(`/api/invoices/${id}/send`);
      toast.success('Invoice berhasil dikirim');
      fetchInvoices();
    } catch (error) {
      toast.error('Gagal mengirim invoice');
    }
  };

  const resetForm = () => {
    setFormData({
      event_id: '',
      client_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: '',
      subtotal: 0,
      tax_amount: 0,
      notes: '',
      items: [{ description: '', quantity: 1, unit_price: 0 }]
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unit_price: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
    calculateSubtotal(newItems);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
    calculateSubtotal(newItems);
  };

  const calculateSubtotal = (items: any[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    setFormData(prev => ({ ...prev, subtotal }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
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
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">Kelola invoice dan pembayaran</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Invoice</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="input w-32"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Event</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="font-medium">{invoice.invoice_number}</td>
                  <td>{invoice.client_name}</td>
                  <td>{invoice.event_name}</td>
                  <td>{new Date(invoice.issue_date).toLocaleDateString('id-ID')}</td>
                  <td>{new Date(invoice.due_date).toLocaleDateString('id-ID')}</td>
                  <td className="font-medium">
                    Rp {invoice.total_amount.toLocaleString('id-ID')}
                  </td>
                  <td className="font-medium text-green-600">
                    Rp {(invoice.status === 'paid' ? invoice.total_amount : 0).toLocaleString('id-ID')}
                  </td>
                  <td>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownloadPDF(invoice.id)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleSendInvoice(invoice.id)}
                          className="p-1 text-gray-400 hover:text-green-600"
                          title="Send Invoice"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(invoice)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editingInvoice ? 'Edit Invoice' : 'Buat Invoice Baru'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Invoice Items</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn btn-secondary text-sm"
                  >
                    Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-5">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          required
                          className="input"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          className="input"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit Price
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          className="input"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total
                        </label>
                        <div className="text-sm font-medium py-2">
                          {(item.quantity * item.unit_price).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div className="col-span-1">
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="btn btn-danger text-sm p-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subtotal
                    </label>
                    <div className="text-lg font-medium">
                      Rp {formData.subtotal.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input"
                      value={formData.tax_amount}
                      onChange={(e) => setFormData({ ...formData, tax_amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Amount
                    </label>
                    <div className="text-xl font-bold">
                      Rp {(formData.subtotal + formData.tax_amount).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingInvoice(null);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingInvoice ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}