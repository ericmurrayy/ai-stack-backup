// Murray's FSM - Stats Component
// ===============================

import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  const variants = {
    default: {
      bg: 'bg-surface',
      icon: 'bg-muted text-foreground-secondary',
      value: 'text-foreground',
    },
    success: {
      bg: 'bg-surface',
      icon: 'bg-success-bg text-success-text',
      value: 'text-success-text',
    },
    warning: {
      bg: 'bg-surface',
      icon: 'bg-warning-bg text-warning-text',
      value: 'text-warning-text',
    },
    danger: {
      bg: 'bg-surface',
      icon: 'bg-danger-bg text-danger-text',
      value: 'text-danger-text',
    },
    info: {
      bg: 'bg-surface',
      icon: 'bg-info-bg text-info-text',
      value: 'text-info-text',
    },
  };

  const config = variants[variant];

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="w-4 h-4" />;
    if (trend.value < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-success-text';
    if (trend.value < 0) return 'text-danger-text';
    return 'text-foreground-secondary';
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border shadow-sm p-5',
        config.bg,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground-secondary">{title}</p>
          <p className={cn('text-2xl font-bold mt-1', config.value)}>{value}</p>
          {subtitle && (
            <p className="text-sm text-foreground-secondary mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={cn('flex items-center gap-1 mt-2 text-sm', getTrendColor())}>
              {getTrendIcon()}
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-foreground-secondary">{trend.label}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('p-3 rounded-lg', config.icon)}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
}
