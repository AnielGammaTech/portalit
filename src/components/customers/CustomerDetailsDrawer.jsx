import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { RefreshCw, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

export default function CustomerDetailsDrawer({ customer, isOpen, onClose }) {
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [isSyncingAddress, setIsSyncingAddress] = useState(false);

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ['contacts', customer?.id],
    queryFn: () => client.entities.Contact.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id
  });

  const handleSyncContacts = async () => {
    try {
      setIsSyncingContacts(true);
      const response = await client.functions.invoke('syncHaloPSACustomers', { 
        action: 'sync_contacts',
        customer_id: customer?.external_id
      });
      if (response.success) {
        toast.success('Contacts synced successfully');
        refetchContacts();
      } else {
        toast.error(response.error || 'Failed to sync contacts');
      }
    } catch (error) {
      toast.error(error.message || 'Error syncing contacts');
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const handleSyncAddress = async () => {
    try {
      setIsSyncingAddress(true);
      const response = await client.functions.invoke('syncHaloPSACustomers', { 
        action: 'sync_address',
        customer_id: customer?.external_id
      });
      if (response.success) {
        toast.success('Address synced successfully');
      } else {
        toast.error(response.error || 'Failed to sync address');
      }
    } catch (error) {
      toast.error(error.message || 'Error syncing address');
    } finally {
      setIsSyncingAddress(false);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{customer.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full rounded-none border-b border-slate-200 bg-white px-6 pt-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Name</label>
                  <p className="text-slate-900 font-medium mt-1">{customer.name}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
                  <p className="text-slate-900 font-medium mt-1">{customer.email || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Phone</label>
                  <p className="text-slate-900 font-medium mt-1">{customer.phone || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Address</label>
                  <p className="text-slate-900 font-medium mt-1">{customer.address || '-'}</p>
                  {customer.source === 'halopsa' && (
                    <Button 
                      onClick={handleSyncAddress}
                      disabled={isSyncingAddress}
                      size="sm"
                      variant="outline"
                      className="mt-2"
                    >
                      <RefreshCw className={cn("w-3 h-3 mr-2", isSyncingAddress && "animate-spin")} />
                      Sync Address
                    </Button>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                  <div className="mt-1">
                    <Badge className={cn(
                      "capitalize",
                      customer.status === 'active' && "bg-emerald-100 text-emerald-700",
                      customer.status === 'inactive' && "bg-slate-100 text-slate-700",
                      customer.status === 'suspended' && "bg-red-100 text-red-700"
                    )}>
                      {customer.status || 'active'}
                    </Badge>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Contacts</h3>
                {customer.source === 'halopsa' && (
                  <Button 
                    onClick={handleSyncContacts}
                    disabled={isSyncingContacts}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className={cn("w-3 h-3 mr-2", isSyncingContacts && "animate-spin")} />
                    Sync Contacts
                  </Button>
                )}
              </div>

              {contacts.length === 0 ? (
                <p className="text-sm text-slate-500">No contacts yet</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{contact.full_name}</p>
                          {contact.title && <p className="text-sm text-slate-500">{contact.title}</p>}
                        </div>
                        {contact.is_primary && (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">Primary</Badge>
                        )}
                      </div>
                      {contact.email && <p className="text-sm text-slate-600 mt-2">{contact.email}</p>}
                      {contact.phone && <p className="text-sm text-slate-600">{contact.phone}</p>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}