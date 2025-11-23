import { Card, CardContent } from '@/components/ui/card';

interface BudgetMeterProps {
  budget: number;
  spent: number;
}

export function BudgetMeter({ budget, spent }: BudgetMeterProps) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const remaining = Math.max(0, budget - spent);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(amount);
  };

  const getColor = () => {
    if (percentage > 100) return 'text-destructive';
    if (percentage > 80) return 'text-warning';
    return 'text-success';
  };

  const getMeterColor = () => {
    if (percentage > 100) return 'bg-destructive';
    if (percentage > 80) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <Card className="border-none shadow-none">
      <CardContent className="p-8">
        <div className="space-y-8">
          {/* Circular Meter */}
          <div className="flex items-center justify-center">
            <div className="relative w-64 h-64">
              {/* Background Circle */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={
                    percentage > 100
                      ? 'hsl(var(--destructive))'
                      : percentage > 80
                      ? 'hsl(var(--warning))'
                      : 'hsl(var(--success))'
                  }
                  strokeWidth="8"
                  strokeDasharray={`${Math.min(percentage, 100) * 2.513} 251.3`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              
              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className={`text-4xl font-bold ${getColor()}`}>
                  {percentage.toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">Used</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Budget</p>
              <p className="text-base font-semibold">{formatCurrency(budget)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Spent</p>
              <p className="text-base font-semibold">{formatCurrency(spent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Remaining</p>
              <p className={`text-base font-semibold ${getColor()}`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          {/* Linear Progress */}
          <div className="space-y-2">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${getMeterColor()} transition-all duration-500 rounded-full`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {percentage > 100
                ? `Over budget by ${formatCurrency(spent - budget)}`
                : `${formatCurrency(remaining)} remaining`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}