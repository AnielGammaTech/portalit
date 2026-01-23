import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Cloud,
  Shield,
  HardDrive,
  Monitor,
  CheckCircle2,
  XCircle,
  Users
} from 'lucide-react';

export default function UserDetailModal({ contact, open, onClose, customerId }) {
  // Fetch license assignments for this contact
  const { data: assignments = [] } = useQuery({
    queryKey: ['license-assignments', contact?.id],
    queryFn: () => base44.entities.LicenseAssignment.filter({ contact_id: contact.id }),
    enabled: !!contact?.id
  });

  // Fetch the licenses for those assignments
  const { data: licenses = [] } = useQuery({
    queryKey: ['assigned-licenses', contact?.id, assignments],
    queryFn: async () => {
      if (assignments.length === 0) return [];
      const licenseIds = assignments.map(a => a.license_id);
      const allLicenses = await base44.entities.SaaSLicense.filter({ customer_id: customerId });
      return allLicenses.filter(l => licenseIds.includes(l.id));
    },
    enabled: assignments.length > 0
  });

  // Fetch devices assigned to this contact
  const { data: devices = [] } = useQuery({
    queryKey: ['contact-devices', contact?.id],
    queryFn: () => base44.entities.Device.filter({ assigned_contact_id: contact.id }),
    enabled: !!contact?.id
  });

  // Check if company has JumpCloud or Spanning configured
  const { data: jumpcloudMapping } = useQuery({
    queryKey: ['jumpcloud-mapping', customerId],
    queryFn: () => base44.entities.JumpCloudMapping.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: spanningMapping } = useQuery({
    queryKey: ['spanning-mapping', customerId],
    queryFn: () => base44.entities.SpanningMapping.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const hasJumpCloud = jumpcloudMapping?.length > 0;
  const hasSpanning = spanningMapping?.length > 0;
  const hasAnyIntegration = hasJumpCloud || hasSpanning;

  if (!contact) return null;

  const sourceColors = {
    jumpcloud: 'bg-purple-100 text-purple-700',
    spanning: 'bg-blue-100 text-blue-700',
    halopsa: 'bg-orange-100 text-orange-700',
    manual: 'bg-slate-100 text-slate-700'
  };

  const sourceIcons = {
    jumpcloud: Shield,
    spanning: HardDrive,
    halopsa: Building2,
    manual: User
  };

  const SourceIcon = sourceIcons[contact.source] || User;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-xl">
              {contact.full_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-slate-900">{contact.full_name}</h3>
                <Badge className={sourceColors[contact.source] || sourceColors.manual}>
                  <SourceIcon className="w-3 h-3 mr-1" />
                  {contact.source || 'manual'}
                </Badge>
              </div>
              {contact.title && (
                <p className="text-slate-500">{contact.title}</p>
              )}
              <div className="flex flex-col gap-1 mt-2">
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {contact.email}
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {contact.phone}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service Integrations */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Service Integrations
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {/* JumpCloud Status */}
              <div className={`p-3 rounded-lg border ${contact.jumpcloud_id ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className={`w-4 h-4 ${contact.jumpcloud_id ? 'text-purple-600' : 'text-slate-400'}`} />
                  <span className="font-medium text-sm">JumpCloud</span>
                </div>
                {contact.jumpcloud_id ? (
                  <div className="flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-green-700">{contact.jumpcloud_status || 'Connected'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <XCircle className="w-3 h-3" />
                    <span>Not synced</span>
                  </div>
                )}
              </div>
              
              {/* Spanning Backup Status */}
              <div className={`p-3 rounded-lg border ${contact.spanning_status ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive className={`w-4 h-4 ${contact.spanning_status ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="font-medium text-sm">Spanning Backup</span>
                </div>
                {contact.spanning_status ? (
                  <div className="flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-green-700">{contact.spanning_status}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <XCircle className="w-3 h-3" />
                    <span>Not protected</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Applications */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              Assigned Applications ({licenses.length})
            </h4>
            {licenses.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-slate-500">
                  No applications assigned to this user
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {licenses.map(license => {
                  const isManaged = license.management_type === 'managed';
                  return (
                    <div 
                      key={license.id} 
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                      {license.logo_url ? (
                        <img src={license.logo_url} alt="" className="w-8 h-8 rounded object-contain" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                          <Cloud className="w-4 h-4 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900">{license.application_name}</p>
                        <p className="text-sm text-slate-500">{license.vendor || license.license_type || 'SaaS'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={isManaged ? "text-blue-600 border-blue-200 bg-blue-50" : "text-emerald-600 border-emerald-200 bg-emerald-50"}
                        >
                          {isManaged ? <Building2 className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                          {isManaged ? 'Managed' : 'Individual'}
                        </Badge>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Active
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assigned Devices */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Assigned Devices ({devices.length})
            </h4>
            {devices.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-slate-500">
                  No devices assigned to this user
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {devices.map(device => (
                  <div 
                    key={device.id} 
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{device.hostname}</p>
                      <p className="text-sm text-slate-500">{device.os || device.device_type}</p>
                    </div>
                    <Badge 
                      className={device.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}
                    >
                      {device.status || 'unknown'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}