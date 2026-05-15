import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/api/client'
import LootITCustomerDetail from '@/components/lootit/LootITCustomerDetail'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, AlertTriangle } from 'lucide-react'

// Customer-scoped queries that live on this route. On tab resume / manual
// retry, these are the only keys we touch.
const CUSTOMER_SCOPED_KEYS = [
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

const LOAD_TIMEOUT_MS = 12000

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const lastForcedAtRef = useRef(0)

  const activeTab = searchParams.get('tab') || 'reconciliation'

  const {
    data: customer,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['customer_by_id', customerId, retryNonce],
    queryFn: async () => {
      const results = await client.entities.Customer.filter({ id: customerId })
      return results?.[0] || null
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  })

  // Force a fresh customer_by_id fetch by cancelling the in-flight request,
  // removing the cached entry, and bumping retryNonce to mint a new query key.
  const forceRefreshCustomer = useCallback(() => {
    if (!customerId) return
    lastForcedAtRef.current = Date.now()
    queryClient.cancelQueries({ queryKey: ['customer_by_id', customerId] })
    queryClient.removeQueries({ queryKey: ['customer_by_id', customerId] })
    setLoadTimedOut(false)
    setRetryNonce((n) => n + 1)
  }, [customerId, queryClient])

  // Invalidate the rest of the route's customer-scoped queries so they
  // refetch alongside the forced root query.
  const invalidateRouteScopedQueries = useCallback(() => {
    if (!customerId) return
    for (const key of CUSTOMER_SCOPED_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key, customerId] })
    }
  }, [customerId, queryClient])

  // Surface the retry panel after the loading state drags past the timeout.
  useEffect(() => {
    if (!isLoading) {
      setLoadTimedOut(false)
      return undefined
    }
    const t = setTimeout(() => setLoadTimedOut(true), LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [isLoading, customerId, retryNonce])

  // On tab resume, force-refresh the root query and invalidate the rest.
  // Throttle to once every 2s in case the browser fires both events.
  useEffect(() => {
    if (!customerId) return undefined
    const onResume = () => {
      const now = Date.now()
      if (now - lastForcedAtRef.current < 2000) return
      forceRefreshCustomer()
      invalidateRouteScopedQueries()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onResume()
    }
    window.addEventListener('focus', onResume)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onResume)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [customerId, forceRefreshCustomer, invalidateRouteScopedQueries])

  const handleBack = () => {
    navigate('/')
  }

  const handleTabChange = (tab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const handleRetry = () => {
    forceRefreshCustomer()
    invalidateRouteScopedQueries()
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

  // Render the retry panel BEFORE the skeleton branch so a stuck-loading
  // page can never sit on a skeleton forever.
  if (loadTimedOut || isError) {
    const message = isError
      ? (error?.message || 'Request failed.')
      : 'Loading is taking longer than expected.'
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-700 font-medium">
          {isError ? "Couldn't load customer" : 'Still loading\u2026'}
        </p>
        <p className="text-slate-500 text-sm mt-1">{message}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Retry
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

  if (customer) {
    return (
      <LootITCustomerDetail
        customer={customer}
        onBack={handleBack}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    )
  }

  return (
    <div className="text-center py-20 max-w-md mx-auto">
      <p className="text-slate-700 font-medium">Customer not found</p>
      <p className="text-slate-500 text-sm mt-1">
        The record for this customer could not be loaded.
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleRetry}
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
