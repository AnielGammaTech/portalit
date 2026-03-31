import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Settings, LayoutGrid, ArrowLeft } from 'lucide-react';
import { client } from '@/api/client';
import LootITDashboard from '@/components/lootit/LootITDashboard';
import LootITCustomerDetail from '@/components/lootit/LootITCustomerDetail';
import LootITSettings from '@/components/lootit/LootITSettings';

export default function LootIT() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerId = searchParams.get('customer');
  const settingsParam = searchParams.get('view') === 'settings';

  const [view, setView] = useState(
    settingsParam ? 'settings' : customerId ? 'customer' : 'dashboard'
  );

  // Fetch customer by ID from URL param
  const { data: urlCustomer } = useQuery({
    queryKey: ['customer_by_id', customerId],
    queryFn: () => client.entities.Customer.filter({ id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
    select: (data) => data?.[0] || null,
  });

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Sync URL customer to state
  useEffect(() => {
    if (customerId && urlCustomer) {
      setSelectedCustomer(urlCustomer);
      setView('customer');
    } else if (!customerId && view === 'customer') {
      setSelectedCustomer(null);
      setView('dashboard');
    }
  }, [customerId, urlCustomer]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setView('customer');
    navigate(`/LootIT?customer=${customer.id}`, { replace: false });
  };

  const handleBackToDashboard = () => {
    setSelectedCustomer(null);
    setView('dashboard');
    navigate('/LootIT', { replace: false });
  };

  const handleSettings = () => {
    setView('settings');
    navigate('/LootIT?view=settings', { replace: false });
  };

  const handleDashboard = () => {
    setView('dashboard');
    setSelectedCustomer(null);
    navigate('/LootIT', { replace: false });
  };

  return (
    <div className="min-h-[80vh] relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 -mb-4 sm:-mb-6 lg:-mb-8 px-4 sm:px-6 lg:px-8 bg-slate-50">

      {/* Header */}
      <div className="relative z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              {view === 'customer' && (
                <button
                  onClick={handleBackToDashboard}
                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors mr-1"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-600" />
                </button>
              )}
              <h1 className="text-xl font-extrabold text-slate-900">
                LootIT
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Billing Reconciliation
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleDashboard}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view !== 'settings'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={handleSettings}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view === 'settings'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
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
