import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Settings, LayoutGrid, ArrowLeft, Loader2 } from 'lucide-react';
import { client } from '@/api/client';
import LootITDashboard from '@/components/lootit/LootITDashboard';
import LootITCustomerDetail from '@/components/lootit/LootITCustomerDetail';
import LootITSettings from '@/components/lootit/LootITSettings';

export default function LootIT() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerId = searchParams.get('customer');
  const settingsParam = searchParams.get('view') === 'settings';

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Only fetch from DB if we have a URL customer ID but no customer in state yet
  const needsFetch = !!customerId && (!selectedCustomer || selectedCustomer.id !== customerId);

  const { data: fetchedCustomer, isLoading: isLoadingCustomer } = useQuery({
    queryKey: ['customer_by_id', customerId],
    queryFn: async () => {
      const results = await client.entities.Customer.filter({ id: customerId });
      return results?.[0] || null;
    },
    enabled: needsFetch,
    staleTime: 1000 * 60 * 5,
  });

  // When fetched customer arrives, set it
  useEffect(() => {
    if (fetchedCustomer && needsFetch) {
      setSelectedCustomer(fetchedCustomer);
    }
  }, [fetchedCustomer, needsFetch]);

  // When URL loses customer param, clear state
  useEffect(() => {
    if (!customerId) {
      setSelectedCustomer(null);
    }
  }, [customerId]);

  const activeTab = searchParams.get('tab') || 'reconciliation';
  const view = settingsParam ? 'settings' : customerId ? 'customer' : 'dashboard';
  const customerReady = view === 'customer' && selectedCustomer && selectedCustomer.id === customerId;

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    navigate(`/LootIT?customer=${customer.id}&tab=reconciliation`);
  };

  const handleTabChange = (tab) => {
    navigate(`/LootIT?customer=${customerId}&tab=${tab}`, { replace: true });
  };

  const handleBackToDashboard = () => {
    setSelectedCustomer(null);
    navigate(-1);
  };

  return (
    <div className="min-h-[80vh] relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 -mb-4 sm:-mb-6 lg:-mb-8 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 30%, #FDF2F8 60%, #FFF1F2 100%)' }}>

      {/* Header */}
      <div className="relative z-20 bg-white/70 backdrop-blur-md border-b border-pink-100 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 shadow-[0_1px_20px_-5px_rgba(236,72,153,0.15)]">
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
              <h1 className="text-xl font-extrabold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent">LootIT</h1>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-pink-400 bg-pink-50 border border-pink-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Billing Reconciliation
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setSelectedCustomer(null); navigate('/LootIT'); }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view !== 'settings' ? 'bg-pink-500 text-white' : 'text-slate-500 hover:bg-pink-50'
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> Dashboard
              </button>
              <button
                onClick={() => navigate('/LootIT?view=settings')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view === 'settings' ? 'bg-pink-500 text-white' : 'text-slate-500 hover:bg-pink-50'
                }`}
              >
                <Settings className="w-4 h-4" /> Settings
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

        {customerReady && (
          <LootITCustomerDetail
            customer={selectedCustomer}
            onBack={handleBackToDashboard}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        )}

        {view === 'customer' && !customerReady && isLoadingCustomer && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        )}

        {view === 'customer' && !customerReady && !isLoadingCustomer && customerId && (
          <div className="text-center py-20">
            <p className="text-slate-500 text-sm">Customer not found</p>
            <button onClick={handleBackToDashboard} className="mt-3 text-sm text-slate-600 underline hover:text-slate-800">
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
