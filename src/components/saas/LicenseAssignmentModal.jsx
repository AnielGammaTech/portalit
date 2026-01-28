import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Search, User } from 'lucide-react';
import { Input } from "@/components/ui/input";

export default function LicenseAssignmentModal({ 
  open, 
  onClose, 
  license, 
  contacts = [], 
  assignments = [],
  onAssign,
  onRevoke
}) {
  const [search, setSearch] = useState('');
  
  // Calculate assigned contact IDs - must be before early return for hooks rules
  const assignedContactIds = useMemo(() => {
    if (!license?.id || !assignments) return [];
    return assignments
      .filter(a => a.license_id === license.id && a.status === 'active')
      .map(a => a.contact_id);
  }, [assignments, license?.id]);
  
  if (!license || !open) return null;
  
  const filteredContacts = contacts.filter(c => 
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );
  
  const availableSeats = (license.quantity || 0) - assignedContactIds.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Managed Seats</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* License Info */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{license.application_name}</h3>
                <p className="text-sm text-slate-500">
                  {license.vendor}
                  {license.license_type && ` • ${license.license_type}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">
                  {assignedContactIds.length} / {license.quantity || 0}
                </p>
                <p className="text-xs text-slate-500">seats used</p>
              </div>
            </div>
            {availableSeats <= 0 && (
              <div className="mt-3 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                ⚠️ All seats are assigned. Revoke a license to assign to someone else.
              </div>
            )}
            {availableSeats > 0 && availableSeats <= 2 && (
              <div className="mt-3 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm">
                Only {availableSeats} seat{availableSeats > 1 ? 's' : ''} available
              </div>
            )}
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Contact List */}
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filteredContacts.map(contact => {
              const isAssigned = assignedContactIds.includes(contact.id);
              
              return (
                <div 
                  key={contact.id} 
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    isAssigned ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-medium",
                      isAssigned ? "bg-emerald-200 text-emerald-700" : "bg-slate-200 text-slate-600"
                    )}>
                      {contact.full_name?.charAt(0) || <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{contact.full_name}</p>
                      <p className="text-sm text-slate-500">{contact.email || 'No email'}</p>
                    </div>
                  </div>
                  {isAssigned ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => onRevoke(contact.id)}
                    >
                      Revoke
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      disabled={availableSeats <= 0 || assignedContactIds.includes(contact.id)}
                      onClick={() => onAssign(contact.id)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                  )}
                </div>
              );
            })}
            {filteredContacts.length === 0 && (
              <p className="text-center text-slate-500 py-8">No team members found</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}