import React, { useState } from 'react';
import { Settings, LayoutGrid, ArrowLeft } from 'lucide-react';
import LootITDashboard from '@/components/lootit/LootITDashboard';
import LootITCustomerDetail from '@/components/lootit/LootITCustomerDetail';
import LootITSettings from '@/components/lootit/LootITSettings';

const LOOTIT_PINK = '#EC4899';

export default function LootIT() {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'settings' | 'customer'
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setView('customer');
  };

  const handleBackToDashboard = () => {
    setSelectedCustomer(null);
    setView('dashboard');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDF2F8' }}>
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-pink-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              {view === 'customer' && (
                <button
                  onClick={handleBackToDashboard}
                  className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center hover:bg-pink-100 transition-colors mr-1"
                >
                  <ArrowLeft className="w-4 h-4 text-pink-600" />
                </button>
              )}
              <h1
                className="text-xl font-extrabold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent"
              >
                LootIT
              </h1>
              <span className="hidden sm:inline-block text-xs font-medium text-pink-300 bg-pink-50 px-2 py-0.5 rounded-full">
                Billing Reconciliation
              </span>
            </div>

            {/* Nav Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setView('dashboard'); setSelectedCustomer(null); }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view !== 'settings'
                    ? 'bg-pink-500 text-white'
                    : 'text-slate-500 hover:bg-pink-50'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setView('settings')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view === 'settings'
                    ? 'bg-pink-500 text-white'
                    : 'text-slate-500 hover:bg-pink-50'
                }`}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {view === 'settings' && <LootITSettings />}
        {view === 'dashboard' && (
          <LootITDashboard onSelectCustomer={handleSelectCustomer} />
        )}
        {view === 'customer' && selectedCustomer && (
          <LootITCustomerDetail
            customer={selectedCustomer}
            onBack={handleBackToDashboard}
          />
        )}
      </div>
    </div>
  );
}
