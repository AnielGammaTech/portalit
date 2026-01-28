import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { 
  Users, 
  HardDrive, 
  CheckCircle2, 
  RefreshCw,
  Archive,
  Mail,
  ExternalLink,
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function SpanningUsersTab({ customerId, spanningMapping, queryClient }) {
  const [syncingSpanning, setSyncingSpanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null); // 'standard', 'archived', 'shared', or null for all
  const ITEMS_PER_PAGE = 15;

  // Fetch live Spanning data from API
  const { data: spanningData, isLoading, refetch } = useQuery({
    queryKey: ['spanning-live-users', customerId],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncSpanningBackup', {
        action: 'list_users',
        customer_id: customerId
      });
      return response.data;
    },
    enabled: !!customerId && !!spanningMapping,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Fetch Spanning licenses for this customer
  const { data: spanningLicenses = [] } = useQuery({
    queryKey: ['spanning-licenses', customerId],
    queryFn: async () => {
      const licenses = await base44.entities.SaaSLicense.filter({ 
        customer_id: customerId,
        source: 'spanning'
      });
      return licenses;
    },
    enabled: !!customerId
  });

  // Fetch contacts for this customer to match with Spanning users
  const { data: contacts = [] } = useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: async () => {
      const contactsList = await base44.entities.Contact.filter({ customer_id: customerId });
      return contactsList;
    },
    enabled: !!customerId
  });

  // Create email-to-contact map
  const contactsByEmail = useMemo(() => {
    const map = {};
    contacts.forEach(c => {
      if (c.email) map[c.email.toLowerCase()] = c;
    });
    return map;
  }, [contacts]);

  const handleSyncSpanning = async () => {
    setSyncingSpanning(true);
    try {
      const response = await base44.functions.invoke('syncSpanningBackup', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.data.success) {
        await refetch();
        queryClient?.invalidateQueries({ queryKey: ['spanning-contacts', customerId] });
        queryClient?.invalidateQueries({ queryKey: ['spanning-licenses', customerId] });
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncingSpanning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const stats = spanningData || {};
  
  // Calculate stats from domain-level data
  const standardLicenses = stats.numberOfStandardLicensesTotal || 0;
  const protectedStandard = stats.numberOfProtectedStandardUsers || 0;
  const archivedLicenses = stats.numberOfArchivedLicensesTotal || 0;
  const protectedArchived = stats.numberOfProtectedArchivedUsers || 0;
  const sharedMailboxes = stats.numberOfSharedMailboxesTotal || 0;
  const protectedShared = stats.numberOfProtectedSharedMailboxes || 0;
  const totalUsers = stats.numberOfUsers || 0;
  const totalProtected = stats.numberOfProtectedUsers || 0;

  // Find license IDs for each type
  const standardLicense = spanningLicenses.find(l => l.license_type === 'Standard Users');
  const archivedLicense = spanningLicenses.find(l => l.license_type === 'Archived Users');
  const sharedLicense = spanningLicenses.find(l => l.license_type === 'Shared Mailboxes');

  const categoryConfig = {
    standard: { 
      title: 'Standard Users', 
      count: protectedStandard, 
      total: standardLicenses,
      icon: Users, 
      color: 'purple',
      description: 'Regular M365 user backups',
      licenseId: standardLicense?.id
    },
    archived: { 
      title: 'Archived Users', 
      count: protectedArchived, 
      total: archivedLicenses,
      icon: Archive, 
      color: 'amber',
      description: 'Departed user data retention',
      licenseId: archivedLicense?.id
    },
    shared: { 
      title: 'Shared Mailboxes', 
      count: protectedShared, 
      total: sharedMailboxes,
      icon: Mail, 
      color: 'cyan',
      description: 'Shared/resource mailbox backups',
      licenseId: sharedLicense?.id
    }
  };

  return (
    <div className="space-y-4">
      {/* Domain Info */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Spanning Backup Domain</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{stats.domainName || 'Loading...'}</p>
            <p className="text-sm text-slate-500 mt-1">Domain ID: {stats.domainId || '...'}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncSpanning}
            disabled={syncingSpanning}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", syncingSpanning && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Clickable Stats Grid - Link to License Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {standardLicense ? (
          <Link to={createPageUrl(`LicenseDetail?id=${standardLicense.id}`)}>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-200 rounded-lg">
                      <Users className="w-5 h-5 text-purple-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-900">{protectedStandard}</p>
                      <p className="text-sm text-purple-600">Standard Users</p>
                      <p className="text-xs text-purple-500">{standardLicenses} licenses</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <Users className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-900">{protectedStandard}</p>
                  <p className="text-sm text-purple-600">Standard Users</p>
                  <p className="text-xs text-purple-500">{standardLicenses} licenses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {archivedLicense ? (
          <Link to={createPageUrl(`LicenseDetail?id=${archivedLicense.id}`)}>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-200 rounded-lg">
                      <Archive className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-900">{protectedArchived}</p>
                      <p className="text-sm text-amber-600">Archived Users</p>
                      <p className="text-xs text-amber-500">{archivedLicenses} licenses</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-200 rounded-lg">
                  <Archive className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-900">{protectedArchived}</p>
                  <p className="text-sm text-amber-600">Archived Users</p>
                  <p className="text-xs text-amber-500">{archivedLicenses} licenses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {sharedLicense ? (
          <Link to={createPageUrl(`LicenseDetail?id=${sharedLicense.id}`)}>
            <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200 cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-200 rounded-lg">
                      <Mail className="w-5 h-5 text-cyan-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-cyan-900">{protectedShared}</p>
                      <p className="text-sm text-cyan-600">Shared Mailboxes</p>
                      <p className="text-xs text-cyan-500">{sharedMailboxes} total</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-200 rounded-lg">
                  <Mail className="w-5 h-5 text-cyan-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-cyan-900">{protectedShared}</p>
                  <p className="text-sm text-cyan-600">Shared Mailboxes</p>
                  <p className="text-xs text-cyan-500">{sharedMailboxes} total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900">{totalProtected}</p>
                <p className="text-sm text-green-600">Total Protected</p>
                <p className="text-xs text-green-500">{totalUsers} total users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Users List */}
      {stats.users && stats.users.length > 0 && (() => {
        const filteredUsers = stats.users
          .filter(u => 
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .sort((a, b) => b.totalStorageBytes - a.totalStorageBytes);
        
        const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
        const paginatedUsers = filteredUsers.slice(
          (currentPage - 1) * ITEMS_PER_PAGE,
          currentPage * ITEMS_PER_PAGE
        );

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Spanning Users ({filteredUsers.length})
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Mail</TableHead>
                      <TableHead className="text-right">Drive</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user, idx) => {
                      const matchedContact = contactsByEmail[user.email?.toLowerCase()];
                      return (
                        <TableRow 
                          key={idx} 
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => setSelectedUser({ ...user, contact: matchedContact })}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium text-sm">
                                {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{user.displayName}</p>
                                <p className="text-xs text-slate-500">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700 gap-1">
                              <Shield className="w-3 h-3" />
                              Protected
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm text-slate-700">{user.mailStorage}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm text-slate-700">{user.driveStorage}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm font-semibold text-slate-900">{user.totalStorage}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* User Detail Modal */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Spanning User Details</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              {/* User Header */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-lg">
                  {selectedUser.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{selectedUser.displayName}</p>
                  <p className="text-sm text-slate-500">{selectedUser.email}</p>
                </div>
              </div>

              {/* Storage Breakdown */}
              <div className="space-y-3">
                <h4 className="font-medium text-slate-900">Storage Usage</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <Mail className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-blue-900">{selectedUser.mailStorage}</p>
                    <p className="text-xs text-blue-600">Mail</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg text-center">
                    <HardDrive className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-purple-900">{selectedUser.driveStorage}</p>
                    <p className="text-xs text-purple-600">Drive</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-green-900">{selectedUser.totalStorage}</p>
                    <p className="text-xs text-green-600">Total</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-medium">Protected by Spanning Backup</span>
              </div>

              {/* HaloPSA Match */}
              {selectedUser.contact ? (
                <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Matched to HaloPSA Contact</span>
                  </div>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p><strong>Name:</strong> {selectedUser.contact.full_name}</p>
                    {selectedUser.contact.title && <p><strong>Title:</strong> {selectedUser.contact.title}</p>}
                    {selectedUser.contact.phone && <p><strong>Phone:</strong> {selectedUser.contact.phone}</p>}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-slate-200 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">No matching contact found in HaloPSA</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}