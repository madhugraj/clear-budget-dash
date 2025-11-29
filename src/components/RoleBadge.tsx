import { Badge } from '@/components/ui/badge';
import { Shield, UserCheck, Eye, Wallet } from 'lucide-react';

interface RoleBadgeProps {
  role: 'treasurer' | 'accountant' | 'lead' | 'general';
  size?: 'sm' | 'default' | 'lg';
}

export function RoleBadge({ role, size = 'default' }: RoleBadgeProps) {
  const config = {
    treasurer: {
      label: 'Admin',
      icon: Shield,
      variant: 'default' as const,
      color: 'bg-primary text-primary-foreground',
    },
    accountant: {
      label: 'Accountant',
      icon: UserCheck,
      variant: 'secondary' as const,
      color: 'bg-secondary text-secondary-foreground',
    },
    lead: {
      label: 'Lead',
      icon: Wallet,
      variant: 'secondary' as const,
      color: 'bg-accent text-accent-foreground',
    },
    general: {
      label: 'Viewer',
      icon: Eye,
      variant: 'outline' as const,
      color: 'bg-muted text-muted-foreground',
    },
  };

  const { label, icon: Icon, variant } = config[role];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : size === 'lg' ? 'text-base px-4 py-2' : '';

  return (
    <Badge variant={variant} className={`flex items-center gap-1.5 ${sizeClass}`}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      {label}
    </Badge>
  );
}
