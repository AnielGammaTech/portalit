import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/api/client'
import LootITCustomerDetail from '@/components/lootit/LootITCustomerDetail'
import { Skeleton } from '@/components/ui/skeleton'

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const activeTab = searchParams.get('tab') || 'reconciliation'

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer_by_id', customerId],
    queryFn: async () => {
      const results = await client.entities.Customer.filter({ id: customerId })
      return results?.[0] || null
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  })

  const handleBack = () => {
    navigate('/')
  }

  const handleTabChange = (tab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
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

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-sm">Customer not found</p>
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

  return (
    <LootITCustomerDetail
      customer={customer}
      onBack={handleBack}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  )
}
