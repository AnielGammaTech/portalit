import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Reusable empty state component with Framer Motion entrance.
 *
 * @param {React.ElementType} icon - Lucide icon component
 * @param {string} title - Heading text
 * @param {string} description - Subtitle text
 * @param {{ label: string, onClick: () => void }} action - Optional CTA button
 * @param {string} className - Additional CSS classes
 */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <motion.div
      {...fadeInUp}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {Icon && (
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
          <Icon className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center justify-center px-4 h-10 text-sm font-medium rounded-hero-md bg-primary text-primary-foreground transition-all duration-[250ms] ease-out hover:opacity-80 active:scale-[0.97]"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
