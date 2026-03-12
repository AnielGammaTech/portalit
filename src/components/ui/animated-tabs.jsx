import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { heroSpring, heroTransition, tabContentVariants } from '@/lib/motion';

/**
 * HeroUI-inspired animated tab component with sliding indicator.
 *
 * @param {{ id: string, label: string, icon?: React.ElementType }[]} tabs - Tab definitions
 * @param {string} activeTab - Currently active tab id
 * @param {(id: string) => void} onTabChange - Tab change handler
 * @param {string} layoutId - Unique layoutId for the indicator (allows multiple tab groups)
 * @param {string} className - Additional CSS classes for the tab list
 */
export function AnimatedTabList({ tabs, activeTab, onTabChange, layoutId = 'active-tab', className }) {
  return (
    <div
      className={cn(
        'relative flex items-center p-1 gap-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-hero-lg overflow-x-auto scrollbar-hide',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative z-10 flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-hero-sm transition-colors duration-[250ms] whitespace-nowrap',
              isActive
                ? 'text-foreground'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-foreground'
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-hero-sm shadow-sm"
                style={{ zIndex: -1 }}
                transition={heroSpring}
              />
            )}
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={cn(
                'ml-1 text-xs px-1.5 py-0.5 rounded-full',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Animated tab content wrapper — cross-fades between tab panels.
 * Wrap the active tab's content with this.
 */
export function AnimatedTabContent({ tabKey, children, className }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={tabContentVariants.initial}
        animate={tabContentVariants.animate}
        exit={tabContentVariants.exit}
        transition={heroTransition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
