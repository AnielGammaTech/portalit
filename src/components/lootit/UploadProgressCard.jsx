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
    <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/50 overflow-hidden">
      {/* Animated top bar */}
      <div className="h-1 bg-pink-100 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-pink-400 via-rose-400 to-pink-400 animate-[shimmer_2s_ease-in-out_infinite] bg-[length:200%_100%]" />
      </div>

      <div className="px-6 py-8">
        {/* Animated icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-200/50">
              {isUploading ? (
                <CloudUpload className="w-8 h-8 text-white animate-bounce" />
              ) : (
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              )}
            </div>
            <div className="absolute -inset-2 rounded-3xl border-2 border-pink-200 animate-ping opacity-20" />
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
                    isDone ? 'bg-pink-400' : 'bg-slate-200'
                  )} />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500',
                    isDone && 'bg-pink-500 text-white',
                    isActive && 'bg-pink-100 text-pink-600 ring-2 ring-pink-300 ring-offset-1',
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
                    isActive ? 'text-pink-600' : isDone ? 'text-slate-500' : 'text-slate-300'
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
