import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Search, User, Plus, CreditCard, Calendar } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LicenseAssignmentModal({ 
  open, 
  onClose, 
  license, 
  contacts, 
  assignments,
  onAssign,
  onRevoke,
  onAddIndividualLicense
}) {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLicense, setNewLicense] = useState({
    contact_id: '',
    renewal_date: '',
    card_last_four: '',
    cost_per_license: license?.cost_per_license || 0
  });
  
  const isPerUser = license?.management_type === 'per_user';
  
  const assignedContactIds = assignments
    .filter(a => a.license_id === license?.id && a.status === 'active')
    .map(a => a.contact_id);
  
  const filteredContacts = contacts.filter(c => 
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );
  
  const availableSeats = isPerUser ? Infinity : ((license?.quantity || 0) - assignedContactIds.length);

  const handleAddIndividual = () => {
    if (!newLicense.contact_id) return;
    const contact = contacts.find(c => c.id === newLicense.contact_id);
    onAddIndividualLicense({
      ...newLicense,
      contact_name: contact?.full_name
    });
    setNewLicense({
      contact_id: '',
      renewal_date: '',
      card_last_four: '',
      cost_per_license: license?.cost_per_license || 0
    });
    setShowAddForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isPerUser ? 'Manage Individual Licenses' : 'Manage License Assignments'}
          </DialogTitle>
        </DialogHeader>
        
        {license && (
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
                {!isPerUser && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">
                      {assignedContactIds.length} / {license.quantity || 0}
                    </p>
                    <p className="text-xs text-slate-500">seats used</p>
                  </div>
                )}
                {isPerUser && (
                  <Badge variant="outline" className="text-purple-600 border-purple-200">
                    Per User
                  </Badge>
                )}
              </div>
              {!isPerUser && availableSeats <= 0 && (
                <div className="mt-3 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                  ⚠️ All seats are assigned. Revoke a license to assign to someone else.
                </div>
              )}
              {!isPerUser && availableSeats > 0 && availableSeats <= 2 && (
                <div className="mt-3 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm">
                  Only {availableSeats} seat{availableSeats > 1 ? 's' : ''} available
                </div>
              )}
            </div>

            {/* Per User: Add Individual License Form */}
            {isPerUser && showAddForm && (
              <div className="bg-purple-50 rounded-xl p-4 space-y-3 border border-purple-200">
                <div className="font-medium text-sm text-purple-900">Add Individual License</div>
                <div>
                  <Label className="text-xs">Team Member</Label>
                  <select
                    value={newLicense.contact_id}
                    onChange={(e) => setNewLicense({ ...newLicense, contact_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select a person...</option>
                    {contacts.filter(c => !assignedContactIds.includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Renewal Date</Label>
                    <Input
                      type="date"
                      value={newLicense.renewal_date}
                      onChange={(e) => setNewLicense({ ...newLicense, renewal_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Card (last 4)</Label>
                    <Input
                      value={newLicense.card_last_four}
                      onChange={(e) => setNewLicense({ ...newLicense, card_last_four: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="1234"
                      maxLength={4}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Monthly Cost</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newLicense.cost_per_license}
                    onChange={(e) => setNewLicense({ ...newLicense, cost_per_license: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-32"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddIndividual} disabled={!newLicense.contact_id} className="bg-purple-600 hover:bg-purple-700">
                    Add License
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Per User: Add button */}
            {isPerUser && !showAddForm && (
              <Button 
                variant="outline" 
                className="w-full gap-2 border-dashed"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="w-4 h-4" />
                Add Individual License
              </Button>
            )}
            
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
                const assignment = assignments.find(a => a.contact_id === contact.id && a.license_id === license?.id && a.status === 'active');
                
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
                        {isPerUser && isAssigned && assignment && (
                          <div className="flex gap-3 mt-1 text-xs text-slate-500">
                            {assignment.card_last_four && (
                              <span className="flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                •••• {assignment.card_last_four}
                              </span>
                            )}
                            {assignment.renewal_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(assignment.renewal_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
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
                    ) : !isPerUser && (
                      <Button 
                        size="sm"
                        disabled={availableSeats <= 0}
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
        )}
      </DialogContent>
    </Dialog>
  );
}