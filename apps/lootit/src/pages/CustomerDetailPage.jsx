import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { client } from '@/api/client'
import LootITCustomerDetail from '@/components/lootit/LootITCustomerDetail'

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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
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
