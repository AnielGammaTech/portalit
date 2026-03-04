import React, { useState } from 'react';
import { Bot, Save, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { client } from '@/api/client';
import { toast } from 'sonner';

export default function AISettingsPanel({ customer, onUpdate }) {
  const [instructions, setInstructions] = useState(customer?.ai_support_instructions || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await client.entities.Customer.update(customer.id, {
        ai_support_instructions: instructions
      });
      toast.success('AI settings saved');
      onUpdate?.();
    } catch (error) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Bot className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">AI Support Assistant Settings</h3>
          <p className="text-sm text-slate-500">Custom instructions for this customer</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Custom Instructions
          </label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={`Add specific instructions for this customer's AI assistant...

Examples:
- This customer uses Salesforce CRM - help them with Salesforce issues
- Their office hours are 8am-5pm EST
- Primary contact for billing is john@company.com
- They have a VPN that requires the Cisco client
- Common issues: printer on 2nd floor often needs restart`}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            These instructions will guide the AI when helping this customer's users.
          </p>
        </div>
        
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}