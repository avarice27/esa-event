import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import axios from 'axios';

interface DashboardData {
  overview: {
    total_events: number;
    completed_events: number;
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    profit_margin: number;
  };
  charts: {
    monthly_trend: Array<{
      month: string;
      revenue: number;
      expenses: number;
      profit: number;
    }>;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get('/api/dashboard/overview');
      // Transform the API response to match the expected structure
      const transformedData = {
        overview: {
          total_events: response.data.summary?.total_events || 0,
          completed_events: response.data.summary?.events_by_status?.completed || 0,
          total_revenue: response.data.summary?.total_revenue || 0,
          total_expenses: response.data.summary?.total_expenses || 0,
          net_profit: response.data.summary?.profit || 0,
          profit_margin: parseFloat(response.data.summary?.profit_margin || 0)
        },
        charts: {
          monthly_trend: response.data.monthly_trend?.map((item: any) => ({
            month: item.month,
            revenue: parseFloat(item.revenue || 0),
            expenses: parseFloat(item.expenses || 0),
            profit: parseFloat(item.revenue || 0) - parseFloat(item.expenses || 0)
          })) || []
        }
      };
      setData(transformedData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  const statCards = [
    {
      title: 'Total Revenue',
      value: `Rp ${data.overview.total_revenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Expenses',
      value: `Rp ${data.overview.total_expenses.toLocaleString('id-ID')}`,
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Net Profit',
      value: `Rp ${data.overview.net_profit.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: data.overview.net_profit >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: data.overview.net_profit >= 0 ? 'bg-green-50' : 'bg-red-50'
    },
    {
      title: 'Total Events',
      value: data.overview.total_events.toString(),
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview keuangan dan performa event</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
              <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Card */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Completed Events</span>
              <span className="font-medium">{data.overview.completed_events}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Profit Margin</span>
              <span className="font-medium">{data.overview.profit_margin}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average per Event</span>
              <span className="font-medium">
                Rp {data.overview.total_events > 0 
                  ? (data.overview.net_profit / data.overview.total_events).toLocaleString('id-ID')
                  : '0'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}