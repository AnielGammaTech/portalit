import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Cloud } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export default function SaaSUsageChart({ licenses }) {
  // Group licenses by vendor
  const vendorData = (licenses || []).reduce((acc, license) => {
    const vendor = license.vendor || 'Other';
    if (!acc[vendor]) {
      acc[vendor] = { name: vendor, value: 0, count: 0 };
    }
    acc[vendor].value += license.total_cost || 0;
    acc[vendor].count += license.quantity || 0;
    return acc;
  }, {});

  const chartData = Object.values(vendorData)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const totalSpend = chartData.reduce((sum, item) => sum + item.value, 0);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/50 p-8 text-center h-full flex flex-col items-center justify-center">
        <Cloud className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-500">No SaaS licenses to display</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/50 p-6 h-full">
      <h3 className="font-semibold text-slate-900 mb-4">SaaS Spend by Vendor</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => [`$${value.toLocaleString()}`, 'Monthly Cost']}
              contentStyle={{ 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {chartData.slice(0, 4).map((item, index) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-slate-600">{item.name}</span>
            </div>
            <span className="font-medium text-slate-900">
              ${item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Total Monthly</span>
          <span className="text-lg font-semibold text-slate-900">
            ${totalSpend.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}