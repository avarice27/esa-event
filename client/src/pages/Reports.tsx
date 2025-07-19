import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ReportData {
  profitLoss: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
  };
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
  eventProfitability: Array<{
    name: string;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  cashFlow: Array<{
    date: string;
    inflow: number;
    outflow: number;
    balance: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Reports() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [activeTab, setActiveTab] = useState('overview');

  const fetchReportData = useCallback(async () => {
    try {
      const response = await axios.get('/api/reports');
      // Transform the API response to match our interface
      const apiData = response.data;
      const transformedData: ReportData = {
        profitLoss: {
          totalRevenue: apiData.financial_summary.total_income,
          totalExpenses: apiData.financial_summary.total_expenses,
          netProfit: apiData.financial_summary.net_profit,
          profitMargin: apiData.financial_summary.profit_margin
        },
        monthlyTrend: apiData.monthly_revenue.map((item: any) => ({
          month: item.month,
          revenue: item.income,
          expenses: item.expenses,
          profit: item.profit
        })),
        eventProfitability: apiData.event_performance.map((item: any) => ({
          name: item.event_name,
          revenue: item.revenue,
          expenses: item.revenue - item.profit,
          profit: item.profit,
          margin: item.margin
        })),
        categoryBreakdown: apiData.expense_breakdown,
        cashFlow: [
          { date: '2024-01', inflow: 15000000, outflow: 5000000, balance: 10000000 },
          { date: '2024-02', inflow: 25000000, outflow: 10000000, balance: 25000000 }
        ]
      };
      setReportData(transformedData);
    } catch (error) {
      toast.error('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleExportPDF = async () => {
    try {
      const response = await axios.get('/api/reports/export/pdf', {
        params: dateRange,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial-report-${dateRange.startDate}-${dateRange.endDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Gagal export PDF');
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await axios.get('/api/reports/export/excel', {
        params: dateRange,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial-report-${dateRange.startDate}-${dateRange.endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Gagal export Excel');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!reportData) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  const tabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'profitability', name: 'Profitability' },
    { id: 'cashflow', name: 'Cash Flow' },
    { id: 'breakdown', name: 'Category Breakdown' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Analisis keuangan dan performa bisnis</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExportExcel}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>
          <div className="flex space-x-2">
            <input
              type="date"
              className="input w-40"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              className="input w-40"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card">
              <div className="text-sm font-medium text-gray-600">Total Revenue</div>
              <div className="text-2xl font-bold text-green-600">
                Rp {reportData.profitLoss.totalRevenue.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="card">
              <div className="text-sm font-medium text-gray-600">Total Expenses</div>
              <div className="text-2xl font-bold text-red-600">
                Rp {reportData.profitLoss.totalExpenses.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="card">
              <div className="text-sm font-medium text-gray-600">Net Profit</div>
              <div className={`text-2xl font-bold ${reportData.profitLoss.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Rp {reportData.profitLoss.netProfit.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="card">
              <div className="text-sm font-medium text-gray-600">Profit Margin</div>
              <div className={`text-2xl font-bold ${reportData.profitLoss.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {reportData.profitLoss.profitMargin.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={reportData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" stroke="#3b82f6" name="Profit" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'profitability' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Profitability Analysis</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={reportData.eventProfitability} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profitability Table</h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Revenue</th>
                    <th>Expenses</th>
                    <th>Profit</th>
                    <th>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.eventProfitability.map((event, index) => (
                    <tr key={index}>
                      <td className="font-medium">{event.name}</td>
                      <td className="text-green-600">Rp {event.revenue.toLocaleString('id-ID')}</td>
                      <td className="text-red-600">Rp {event.expenses.toLocaleString('id-ID')}</td>
                      <td className={`font-medium ${event.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Rp {event.profit.toLocaleString('id-ID')}
                      </td>
                      <td className={`font-medium ${event.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {event.margin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cashflow' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow Analysis</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={reportData.cashFlow}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
              <Line type="monotone" dataKey="inflow" stroke="#10b981" name="Cash Inflow" strokeWidth={2} />
              <Line type="monotone" dataKey="outflow" stroke="#ef4444" name="Cash Outflow" strokeWidth={2} />
              <Line type="monotone" dataKey="balance" stroke="#3b82f6" name="Balance" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'breakdown' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Categories</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reportData.categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => `${category} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {reportData.categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {reportData.categoryBreakdown.map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{category.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Rp {category.amount.toLocaleString('id-ID')}
                    </div>
                    <div className="text-xs text-gray-500">{category.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}