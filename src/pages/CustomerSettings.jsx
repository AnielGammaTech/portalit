import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { client } from '@/api/client';
import { 
  Settings, 
  Upload, 
  Users, 
  Building2, 
  Mail,
  Check,
  X,
  Loader2,
  Image,
  Trash2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

export default function CustomerSettings() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await client.auth.me();
      setUser(currentUser);
      setCustomerId(currentUser?.customer_id);
    };
    loadUser();
  }, []);

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      // Only fetch own customer record, never list all
      const results = await client.entities.Customer.filter({ id: customerId });
      return results[0] || null;
    },
    enabled: !!customerId
  });

  const { data: portalSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['portal_settings', customerId],
    queryFn: async () => {
      const settings = await client.entities.CustomerPortalSettings.filter({ customer_id: customerId });
      return settings[0] || null;
    },
    enabled: !!customerId
  });

  const { data: portalUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['portal_users', customerId],
    queryFn: () => client.entities.User.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    
    setIsUploading(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file: logoFile });
      
      if (portalSettings) {
        await client.entities.CustomerPortalSettings.update(portalSettings.id, { logo_url: file_url });
      } else {
        await client.entities.CustomerPortalSettings.create({ 
          customer_id: customerId, 
          logo_url: file_url 
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['portal_settings', customerId] });
      setLogoFile(null);
      setLogoPreview(null);
      toast.success('Logo updated successfully!');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!portalSettings) return;
    
    try {
      await client.entities.CustomerPortalSettings.update(portalSettings.id, { logo_url: null });
      queryClient.invalidateQueries({ queryKey: ['portal_settings', customerId] });
      toast.success('Logo removed');
    } catch (error) {
      toast.error('Failed to remove logo');
    }
  };

  const isLoading = !customerId || loadingCustomer || loadingSettings || loadingUsers;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Account Not Found</h2>
        <p className="text-slate-500">Please contact support.</p>
      </div>
    );
  }

  const currentLogo = logoPreview || portalSettings?.logo_url || customer?.logo_url;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
          <Settings className="w-6 h-6 text-slate-600" />
          Portal Settings
        </h1>
        <p className="text-slate-500 mt-1">Customize your company's portal experience</p>
      </div>

      {/* Company Branding */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Image className="w-5 h-5 text-slate-600" />
          Company Branding
        </h2>
        
        <div className="flex items-start gap-6">
          {/* Logo Preview */}
          <div className="flex-shrink-0">
            <div className={cn(
              "w-32 h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden",
              currentLogo ? "border-slate-200 bg-white" : "border-slate-300 bg-slate-50"
            )}>
              {currentLogo ? (
                <img src={currentLogo} alt="Company logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center">
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">No logo</p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Controls */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="font-medium text-slate-900 mb-1">Company Logo</p>
              <p className="text-sm text-slate-500 mb-3">
                Upload your company logo to personalize the portal. Recommended size: 200x200px.
              </p>
              
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoSelect}
                    className="hidden" 
                  />
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <Upload className="w-4 h-4" />
                      Choose File
                    </span>
                  </Button>
                </label>
                
                {logoFile && (
                  <Button 
                    onClick={handleLogoUpload}
                    disabled={isUploading}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Save Logo
                  </Button>
                )}
                
                {logoFile && (
                  <Button 
                    variant="ghost"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}

                {portalSettings?.logo_url && !logoFile && (
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {logoFile && (
              <p className="text-sm text-slate-500">
                Selected: {logoFile.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Portal Users */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              Portal Users
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Users who have access to this company portal</p>
          </div>
          <Badge variant="outline" className="text-slate-600">
            {portalUsers.length} user{portalUsers.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {portalUsers.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No users have portal access yet</p>
            <p className="text-sm text-slate-400 mt-1">Contact your administrator to add users</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {portalUsers.map(portalUser => (
              <div key={portalUser.id} className="flex items-center gap-4 py-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium">
                  {portalUser.full_name?.charAt(0) || portalUser.email?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{portalUser.full_name || 'Unnamed User'}</p>
                  <p className="text-sm text-slate-500 truncate">{portalUser.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {portalUser.id === user?.id && (
                    <Badge className="bg-emerald-100 text-emerald-700">You</Badge>
                  )}
                  <Badge variant="outline" className="capitalize text-slate-600">
                    {portalUser.role || 'user'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company Info (Read-only) */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-600" />
          Company Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500">Company Name</label>
            <p className="font-medium text-slate-900">{customer.name}</p>
          </div>
          {customer.email && (
            <div>
              <label className="text-sm text-slate-500">Email</label>
              <p className="font-medium text-slate-900">{customer.email}</p>
            </div>
          )}
          {customer.phone && (
            <div>
              <label className="text-sm text-slate-500">Phone</label>
              <p className="font-medium text-slate-900">{customer.phone}</p>
            </div>
          )}
          {customer.address && (
            <div>
              <label className="text-sm text-slate-500">Address</label>
              <p className="font-medium text-slate-900">{customer.address}</p>
            </div>
          )}
        </div>
        
        <p className="text-xs text-slate-400 mt-4">
          Contact your IT provider to update company information
        </p>
      </div>
    </div>
  );
}