import React, { useState, useEffect } from 'react';
import { client } from '@/api/client';
import { AlertTriangle, TrendingUp, Loader2, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SpendAnomalyAlert({ licenses, licenseAssignments }) {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (licenses.length > 0 && !dismissed) {
      runAnomalyDetection();
    }
  }, [licenses.length]);

  const runAnomalyDetection = async () => {
    if (licenses.length === 0) return;
    
    setIsLoading(true);
    try {
      // Prepare spend data for AI analysis
      const spendData = licenses.map(l => {
        const assigned = licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length;
        const utilization = l.quantity > 0 ? (assigned / l.quantity) * 100 : 0;
        const wastedCost = l.quantity > 0 ? ((l.quantity - assigned) / l.quantity) * (l.total_cost || 0) : 0;
        return {
          name: l.application_name,
          vendor: l.vendor,
          category: l.category,
          totalCost: l.total_cost || 0,
          costPerSeat: l.cost_per_license || 0,
          seats: l.quantity || 0,
          assigned,
          utilization: utilization.toFixed(0),
          wastedCost: wastedCost.toFixed(2),
          billingCycle: l.billing_cycle
        };
      });

      const totalSpend = licenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);
      
      const result = await client.integrations.Core.InvokeLLM({
        prompt: `Analyze this SaaS spend data for anomalies and cost optimization opportunities:

Total Monthly Spend: $${totalSpend.toFixed(2)}

License Details:
${JSON.stringify(spendData, null, 2)}

Identify:
1. Any unusually high costs compared to similar applications
2. Severely underutilized licenses (below 30% utilization)
3. Potential duplicate or overlapping applications
4. Cost optimization recommendations
5. Any red flags or anomalies

Be specific with dollar amounts and percentages. Focus on actionable insights.`,
        response_json_schema: {
          type: "object",
          properties: {
            hasAnomalies: { type: "boolean" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            summary: { type: "string" },
            anomalies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  application: { type: "string" },
                  description: { type: "string" },
                  potentialSavings: { type: "number" },
                  recommendation: { type: "string" }
                }
              }
            },
            totalPotentialSavings: { type: "number" }
          }
        }
      });

      setAnalysis(result);
    } catch (error) {
      console.error('Anomaly detection failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (dismissed || (!isLoading && !analysis?.hasAnomalies)) return null;

  return (
    <div className={cn(
      "rounded-2xl border-2 overflow-hidden transition-all",
      analysis?.severity === 'high' ? "border-red-300 bg-gradient-to-r from-red-50 to-orange-50" :
      analysis?.severity === 'medium' ? "border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50" :
      "border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50"
    )}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {isLoading ? (
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
              </div>
            ) : (
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                analysis?.severity === 'high' ? "bg-red-100" :
                analysis?.severity === 'medium' ? "bg-amber-100" : "bg-blue-100"
              )}>
                {analysis?.severity === 'high' ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <Sparkles className="w-5 h-5 text-amber-600" />
                )}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className={cn(
                  "font-semibold",
                  analysis?.severity === 'high' ? "text-red-900" :
                  analysis?.severity === 'medium' ? "text-amber-900" : "text-blue-900"
                )}>
                  {isLoading ? 'Analyzing Spend Patterns...' : 'AI Spend Analysis'}
                </h3>
                {analysis?.totalPotentialSavings > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Save ${analysis.totalPotentialSavings.toFixed(0)}/mo
                  </span>
                )}
              </div>
              {!isLoading && analysis && (
                <p className={cn(
                  "text-sm mt-1",
                  analysis?.severity === 'high' ? "text-red-700" :
                  analysis?.severity === 'medium' ? "text-amber-700" : "text-blue-700"
                )}>
                  {analysis.summary}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && analysis?.anomalies?.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="gap-1"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {expanded ? 'Hide' : 'Details'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDismissed(true)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && analysis?.anomalies?.length > 0 && (
          <div className="mt-4 space-y-3">
            {analysis.anomalies.map((anomaly, idx) => (
              <div 
                key={idx}
                className="bg-white/60 rounded-xl p-4 border border-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700 capitalize">
                        {anomaly.type}
                      </span>
                      {anomaly.application && (
                        <span className="text-sm font-semibold text-slate-900">{anomaly.application}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700">{anomaly.description}</p>
                    {anomaly.recommendation && (
                      <p className="text-sm text-slate-600 mt-2 italic">
                        💡 {anomaly.recommendation}
                      </p>
                    )}
                  </div>
                  {anomaly.potentialSavings > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-500">Potential Savings</p>
                      <p className="text-lg font-bold text-emerald-600">${anomaly.potentialSavings}/mo</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh button */}
      {!isLoading && (
        <div className="px-5 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={runAnomalyDetection}
            className="gap-2"
          >
            <Sparkles className="w-3 h-3" />
            Re-analyze
          </Button>
        </div>
      )}
    </div>
  );
}