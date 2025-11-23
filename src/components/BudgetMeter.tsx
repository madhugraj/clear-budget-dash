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
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
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
    <Card className="border-none shadow-lg bg-gradient-to-br from-card via-card to-muted/20">
      <CardContent className="p-6 md:p-10">
        <div className="space-y-6 md:space-y-8">
          {/* Circular Meter */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative w-48 h-48 md:w-64 md:h-64">
              {/* Background Circle */}
              <svg className="w-full h-full -rotate-90 animate-fade-in" viewBox="0 0 100 100">
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
                  className="transition-all duration-1000 ease-out animate-[scale-in_0.8s_ease-out]"
                  style={{ transformOrigin: 'center' }}
                />
              </svg>
              
              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className={`text-3xl md:text-4xl font-bold ${getColor()}`}>
                  {percentage.toFixed(0)}%
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Budget Used</p>
              </div>
            </div>
            
            {/* Explanation */}
            <p className="text-xs text-center text-muted-foreground max-w-md px-4">
              This meter shows your total budget utilization. Green indicates healthy spending (&lt;80%), 
              yellow shows you're approaching the limit (80-100%), and red means you've exceeded your budget (&gt;100%).
            </p>
          </div>

          {/* Stats with Full Amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Annual Budget (FY 2025-26)</p>
              <p className="text-lg md:text-xl font-semibold break-words">{formatCompactCurrency(budget)}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(budget)}</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Total Spent (Approved)</p>
              <p className="text-lg md:text-xl font-semibold break-words">{formatCompactCurrency(spent)}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(spent)}</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Balance Remaining</p>
              <p className={`text-lg md:text-xl font-semibold break-words ${getColor()}`}>
                {formatCompactCurrency(remaining)}
              </p>
              <p className={`text-xs mt-1 ${getColor()}`}>{formatCurrency(remaining)}</p>
            </div>
          </div>

          {/* Linear Progress */}
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${getMeterColor()} transition-all duration-500 rounded-full`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {percentage > 100
                ? `Over budget by ${formatCurrency(spent - budget)}`
                : `${formatCurrency(remaining)} remaining out of ${formatCurrency(budget)} total budget`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}