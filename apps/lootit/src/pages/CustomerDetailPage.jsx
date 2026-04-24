import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/api/client'
import LootITCustomerDetail from '@/components/lootit/LootITCustomerDetail'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, AlertTriangle } from 'lucide-react'

// Customer-scoped queries that live on this route. Any of these going stale
// on tab resume should be re-fetched to prevent a forever-skeleton state.
const CUSTOMER_SCOPED_KEYS = [
  'customer_by_id',
  'recurring_bill_line_items_customer',
  'pax8_line_item_overrides',
  'reconciliation_reviews',
  'reconciliation_review_history',
  'reconciliation_excluded_items',
  'contacts',
  'devices',
  'billing_anomalies_customer',
  'lootit_invoices_customer',
  'lootit_contracts',
]

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [loadTooLong, setLoadTooLong] = useState(false)

  const activeTab = searchParams.get('tab') || 'reconciliation'

  const {
    data: customer,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['customer_by_id', customerId],
    queryFn: async () => {
      const results = await client.entities.Customer.filter({ id: customerId })
      return results?.[0] || null
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  })

  // Surface a retry UI if the loading state drags past 8 seconds.
  useEffect(() => {
    if (!isLoading) {
      setLoadTooLong(false)
      return
    }
    const t = setTimeout(() => setLoadTooLong(true), 8000)
    return () => clearTimeout(t)
  }, [isLoading, customerId])

  // When the tab regains focus/visibility, invalidate only the queries scoped
  // to THIS customerId so a stale tab recovers without a manual refresh.
  useEffect(() => {
    if (!customerId) return
    const invalidateAll = () => {
      for (const key of CUSTOMER_SCOPED_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key, customerId] })
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') invalidateAll()
    }
    window.addEventListener('focus', invalidateAll)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', invalidateAll)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [customerId, queryClient])

  const handleBack = () => {
    navigate('/')
  }

  const handleTabChange = (tab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const handleManualRefetch = () => {
    setLoadTooLong(false)
    refetch()
    if (customerId) {
      for (const key of CUSTOMER_SCOPED_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key, customerId] })
      }
    }
  }

  if (!customerId) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-sm">Invalid customer URL</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-3 text-sm text-slate-600 underline hover:text-slate-800"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-700 font-medium">Couldn't load customer</p>
        <p className="text-slate-500 text-sm mt-1">{error?.message || 'Request failed.'}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleManualRefetch}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="text-sm text-slate-600 underline hover:text-slate-800"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="animate-in space-y-6">
        {loadTooLong && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800">
              Still loading{isFetching ? '\u2026' : ''}. Taking longer than expected.
            </p>
            <button
              type="button"
              onClick={handleManualRefetch}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 text-white text-xs px-2.5 py-1 hover:bg-amber-700"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Tab bar skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>

        {/* Stat cards row */}
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>

        {/* Table rows */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-3/4 rounded-md" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <p className="text-slate-700 font-medium">Customer not found</p>
        <p className="text-slate-500 text-sm mt-1">
          The record for this customer could not be loaded.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleManualRefetch}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="text-sm text-slate-600 underline hover:text-slate-800"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <LootITCustomerDetail
      customer={customer}
      onBack={handleBack}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  )
}
