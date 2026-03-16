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
    <div className="min-h-[80vh] relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 -mb-4 sm:-mb-6 lg:-mb-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#FDF2F8' }}>
      {/* Ambient pink glow — makes LootIT visually distinct from other tools */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-pink-300/25 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] bg-rose-300/20 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[600px] h-[300px] bg-pink-200/15 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative z-20 bg-white/70 backdrop-blur-md border-b border-pink-100 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 shadow-[0_1px_20px_-5px_rgba(236,72,153,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
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
                className="text-xl font-extrabold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent drop-shadow-sm"
              >
                LootIT
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-pink-400 bg-pink-50 border border-pink-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
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
      <div className="relative z-10 max-w-7xl mx-auto py-6">
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
