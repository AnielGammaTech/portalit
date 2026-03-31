import React, { useState, useEffect, useRef } from 'react';
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
  const navigatedFromDashboard = useRef(false);

  const view = settingsParam ? 'settings' : (customerId ? 'customer' : 'dashboard');

  // Fetch customer by ID when navigating via URL (direct link or browser back)
  const { data: urlCustomer, isLoading: isLoadingCustomer } = useQuery({
    queryKey: ['customer_by_id', customerId],
    queryFn: async () => {
      const results = await client.entities.Customer.filter({ id: customerId });
      return results?.[0] || null;
    },
    enabled: !!customerId && !navigatedFromDashboard.current,
    staleTime: 1000 * 60 * 5,
  });

  // Sync URL customer to state (only when not navigated from dashboard click)
  useEffect(() => {
    if (customerId && urlCustomer && !navigatedFromDashboard.current) {
      setSelectedCustomer(urlCustomer);
    }
    if (!customerId) {
      setSelectedCustomer(null);
      navigatedFromDashboard.current = false;
    }
  }, [customerId, urlCustomer]);

  const handleSelectCustomer = (customer) => {
    navigatedFromDashboard.current = true;
    setSelectedCustomer(customer);
    navigate(`/LootIT?customer=${customer.id}`, { replace: false });
  };

  const handleBackToDashboard = () => {
    navigatedFromDashboard.current = false;
    setSelectedCustomer(null);
    navigate('/LootIT', { replace: false });
  };

  const handleSettings = () => {
    navigate('/LootIT?view=settings', { replace: false });
  };

  const handleDashboard = () => {
    navigatedFromDashboard.current = false;
    setSelectedCustomer(null);
    navigate('/LootIT', { replace: false });
  };

  // Loading state when fetching customer from URL
  const showCustomerLoading = view === 'customer' && !selectedCustomer && isLoadingCustomer;
  const showCustomerNotFound = view === 'customer' && !selectedCustomer && !isLoadingCustomer && customerId;

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
        {showCustomerLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        )}
        {showCustomerNotFound && (
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
