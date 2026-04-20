import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client, supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';

export function useContractActions(customerId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [extractingId, setExtractingId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: contracts = [] } = useQuery({
    queryKey: ['lootit_contracts', customerId],
    queryFn: () => client.entities.LootITContract.filter({ customer_id: customerId }, '-created_date'),
    staleTime: 1000 * 60 * 2,
  });

  const extractContractData = async (contract) => {
    setExtractingId(contract.id);
    try {
      const { data: signedData, error: signError } = await supabase.storage
        .from('lootit-contracts')
        .createSignedUrl(contract.file_url, 300);
      if (signError || !signedData?.signedUrl) throw new Error('Could not create signed URL');

      const result = await client.integrations.Core.InvokeLLM({
        prompt: `Extract all contract data from this MSSP/IT services agreement PDF. Focus on the pricing addendum/table.`,
        file_urls: [signedData.signedUrl],
        response_json_schema: {
          type: "object",
          properties: {
            client_name: { type: "string", description: "Client/customer company name" },
            provider_name: { type: "string", description: "MSP/consultant company name" },
            agreement_date: { type: "string", description: "Date of agreement (YYYY-MM-DD)" },
            term_months: { type: "number", description: "Contract term in months" },
            monthly_total: { type: "number", description: "Total monthly fee" },
            setup_total: { type: "number", description: "Total one-time setup fee" },
            hourly_rate: { type: "number", description: "On-site hourly rate" },
            trip_charge: { type: "number", description: "Trip charge per visit" },
            line_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product: { type: "string", description: "Product/service name" },
                  unit: { type: "string", description: "Per what (Endpoint, User, Server, Domain, etc.)" },
                  quantity: { type: "number", description: "Quantity" },
                  unit_price: { type: "number", description: "Price per unit per month" },
                  monthly_total: { type: "number", description: "Line total per month (qty x price)" },
                  setup_price: { type: "number", description: "One-time setup fee per unit (0 if none)" },
                  setup_total: { type: "number", description: "Setup total (qty x setup_price)" },
                }
              }
            },
            auto_renewal: { type: "boolean", description: "Whether contract auto-renews" },
            cancellation_notice_days: { type: "number", description: "Days notice required for cancellation" },
            notes: { type: "string", description: "Any important notes or special terms" },
          }
        }
      });

      if (result) {
        await client.entities.LootITContract.update(contract.id, {
          extracted_data: result,
          extraction_status: 'complete',
        });
        toast.success('Contract data extracted successfully');
      } else {
        await client.entities.LootITContract.update(contract.id, {
          extraction_status: 'failed',
        });
        toast.error('Could not extract contract data');
      }
    } catch (err) {
      console.error('[LootIT] Contract extraction failed:', err);
      await client.entities.LootITContract.update(contract.id, {
        extraction_status: 'failed',
      });
      toast.error('Contract extraction failed');
    } finally {
      setExtractingId(null);
      queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customerId] });
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const ext = file.name.split('.').pop();
      const path = `${customerId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('lootit-contracts')
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const contract = await client.entities.LootITContract.create({
        customer_id: customerId,
        file_name: file.name,
        file_url: path,
        file_size: file.size,
        uploaded_by: user?.id || null,
        extraction_status: 'pending',
      });

      if (ext.toLowerCase() === 'pdf') {
        extractContractData(contract);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customerId] }),
  });

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  }, [uploadMutation]);

  const handleDownloadContract = useCallback(async (contract) => {
    const { data, error } = await supabase.storage
      .from('lootit-contracts')
      .download(contract.file_url);
    if (error) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = contract.file_name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDeleteContract = useCallback(async (contract) => {
    await supabase.storage.from('lootit-contracts').remove([contract.file_url]);
    await client.entities.LootITContract.delete(contract.id);
    await queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customerId] });
  }, [customerId, queryClient]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadMutation.mutate(file);
  }, [uploadMutation]);

  return {
    contracts,
    extractingId,
    fileInputRef,
    isDragging,
    isUploading: uploadMutation.isPending,
    extractContractData,
    handleFileUpload,
    handleDownloadContract,
    handleDeleteContract,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
