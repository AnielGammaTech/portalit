import React from 'react';
import { HelpCircle } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function MetricHelp({ children, label = 'More context', side = 'top' }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[260px] rounded-lg bg-slate-950 px-3 py-2 text-left text-xs leading-5 text-white shadow-lg"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
