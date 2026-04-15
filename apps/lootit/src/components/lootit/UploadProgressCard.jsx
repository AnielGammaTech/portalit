import React from 'react';
import { cn } from '@/lib/utils';
import { CloudUpload, Sparkles, CheckCircle2, Check } from 'lucide-react';

export default function UploadProgressCard({ isUploading, isExtracting }) {
  const steps = [
    { key: 'upload', label: 'Uploading file', icon: CloudUpload },
    { key: 'analyze', label: 'Analyzing document', icon: Sparkles },
    { key: 'done', label: 'Extraction complete', icon: CheckCircle2 },
  ];

  const currentStep = isUploading ? 0 : isExtracting ? 1 : 2;

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 overflow-hidden">
      {/* Animated top bar */}
      <div className="h-1 bg-slate-200 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-slate-400 via-slate-500 to-slate-400 animate-[shimmer_2s_ease-in-out_infinite] bg-[length:200%_100%]" />
      </div>

      <div className="px-6 py-8">
        {/* Animated icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-300/50">
              {isUploading ? (
                <CloudUpload className="w-8 h-8 text-white animate-bounce" />
              ) : (
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              )}
            </div>
            <div className="absolute -inset-2 rounded-3xl border-2 border-slate-300 animate-ping opacity-20" />
          </div>
        </div>

        {/* Title */}
        <p className="text-center text-sm font-semibold text-slate-700 mb-1">
          {isUploading ? 'Uploading your contract...' : 'Analyzing with AI...'}
        </p>
        <p className="text-center text-xs text-slate-400 mb-6">
          {isUploading
            ? 'Securely transferring your document'
            : 'Extracting pricing, line items, and contract terms'}
        </p>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;
            return (
              <div key={step.key} className="flex items-center gap-3">
                {idx > 0 && (
                  <div className={cn(
                    'w-8 h-px transition-colors duration-500',
                    isDone ? 'bg-slate-600' : 'bg-slate-200'
                  )} />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500',
                    isDone && 'bg-slate-700 text-white',
                    isActive && 'bg-slate-200 text-slate-700 ring-2 ring-slate-400 ring-offset-1',
                    !isDone && !isActive && 'bg-slate-100 text-slate-300'
                  )}>
                    {isDone ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <StepIcon className={cn('w-4 h-4', isActive && 'animate-pulse')} />
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium whitespace-nowrap',
                    isActive ? 'text-slate-700' : isDone ? 'text-slate-500' : 'text-slate-300'
                  )}>
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
