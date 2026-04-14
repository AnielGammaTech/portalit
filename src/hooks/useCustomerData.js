import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';

/**
 * All TanStack Query hooks for customer detail data.
 * Extracted for reuse across customer-related pages.
 */

export function useCustomer(customerId) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const customers = await client.entities.Customer.filter({ id: customerId });
      return customers[0] || null;
    },
    enabled: !!customerId,
  });
}

export function useCustomerContracts(customerId) {
  return useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => client.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerDevices(customerId) {
  return useQuery({
    queryKey: ['devices', customerId],
    queryFn: () => client.entities.Device.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerLicenses(customerId) {
  return useQuery({
    queryKey: ['licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerApplications(customerId) {
  return useQuery({
    queryKey: ['applications', customerId],
    queryFn: () => client.entities.Application.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerRecurringBills(customerId) {
  return useQuery({
    queryKey: ['recurring_bills', customerId],
    queryFn: () => client.entities.RecurringBill.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerInvoices(customerId) {
  return useQuery({
    queryKey: ['invoices', customerId],
    queryFn: () => client.entities.Invoice.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerQuotes(customerId) {
  return useQuery({
    queryKey: ['quotes', customerId],
    queryFn: () => client.entities.Quote.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerContacts(customerId) {
  return useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerTickets(customerId) {
  return useQuery({
    queryKey: ['tickets', customerId],
    queryFn: () => client.entities.Ticket.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

export function useCustomerMappings(customerId) {
  const jumpcloud = useQuery({
    queryKey: ['jumpcloud-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.JumpCloudMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
  });

  const spanning = useQuery({
    queryKey: ['spanning-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.SpanningMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
  });

  const datto = useQuery({
    queryKey: ['datto-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.DattoSiteMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
  });

  return { jumpcloud, spanning, datto };
}

export function useLicenseAssignments(customerId) {
  return useQuery({
    queryKey: ['license_assignments', customerId],
    queryFn: () => client.entities.LicenseAssignment.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}
