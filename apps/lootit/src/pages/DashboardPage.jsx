import { useNavigate } from 'react-router-dom'
import LootITDashboard from '@/components/lootit/LootITDashboard'

export default function DashboardPage() {
  const navigate = useNavigate()

  const handleSelectCustomer = (customer, tab = 'reconciliation') => {
    if (!customer?.id) return
    navigate(`/customers/${customer.id}?tab=${tab}`)
  }

  return <LootITDashboard onSelectCustomer={handleSelectCustomer} />
}
