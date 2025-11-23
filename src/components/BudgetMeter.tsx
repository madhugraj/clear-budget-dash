import { Card, CardContent } from '@/components/ui/card';
import { useEffect, useState } from 'react';

interface BudgetMeterProps {
  budget: number;
  spent: number;
}

export function BudgetMeter({ budget, spent }: BudgetMeterProps) {
  const targetPercentage = budget > 0 ? (spent / budget) * 100 : 0;
  const remaining = Math.max(0, budget - spent);
  
  // Animated percentage counter
  const [displayPercentage, setDisplayPercentage] = useState(0);
  const [animatedDasharray, setAnimatedDasharray] = useState(0);
  
  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = targetPercentage / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const newValue = Math.min(increment * currentStep, targetPercentage);
      setDisplayPercentage(newValue);
      setAnimatedDasharray(Math.min(newValue, 100) * 2.513);
      
      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, stepDuration);
    
    return () => clearInterval(timer);
  }, [targetPercentage]);
  
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
    if (targetPercentage > 100) return 'text-destructive';
    if (targetPercentage > 80) return 'text-warning';
    return 'text-success';
  };

  const getMeterColor = () => {
    if (targetPercentage > 100) return 'bg-destructive';
    if (targetPercentage > 80) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <Card className="border-none shadow-lg bg-gradient-to-br from-card via-card to-muted/20">
      <CardContent className="p-6 md:p-10">
        <div className="space-y-6 md:space-y-8">
          {/* Circular Meter */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative w-48 h-48 md:w-64 md:h-64 animate-[scale-in_0.8s_ease-out]">
              {/* Background Circle */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="8"
                  className="opacity-30"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={
                    targetPercentage > 100
                      ? 'hsl(var(--destructive))'
                      : targetPercentage > 80
                      ? 'hsl(var(--warning))'
                      : 'hsl(var(--success))'
                  }
                  strokeWidth="8"
                  strokeDasharray={`${animatedDasharray} 251.3`}
                  strokeLinecap="round"
                  className="transition-all duration-100 ease-out"
                  style={{ 
                    transformOrigin: 'center',
                    filter: 'drop-shadow(0 0 8px currentColor)'
                  }}
                />
              </svg>
              
              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center animate-[fade-in_0.8s_ease-out_0.4s_both]">
                <p className={`text-3xl md:text-4xl font-bold ${getColor()} transition-colors duration-300`}>
                  {displayPercentage.toFixed(0)}%
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Budget Used</p>
              </div>
            </div>
            
            {/* Explanation */}
            <p className="text-xs text-center text-muted-foreground max-w-md px-4 animate-[fade-in_0.6s_ease-out_0.6s_both]">
              This meter shows your total budget utilization. Green indicates healthy spending (&lt;80%), 
              yellow shows you're approaching the limit (80-100%), and red means you've exceeded your budget (&gt;100%).
            </p>
          </div>

          {/* Stats with Full Amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg animate-[fade-in_0.6s_ease-out_0.8s_both] hover:bg-muted/70 transition-colors">
              <p className="text-xs text-muted-foreground mb-2">Annual Budget (FY 2025-26)</p>
              <p className="text-lg md:text-xl font-semibold break-words">{formatCompactCurrency(budget)}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(budget)}</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg animate-[fade-in_0.6s_ease-out_1s_both] hover:bg-muted/70 transition-colors">
              <p className="text-xs text-muted-foreground mb-2">Total Spent (Approved)</p>
              <p className="text-lg md:text-xl font-semibold break-words">{formatCompactCurrency(spent)}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(spent)}</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg animate-[fade-in_0.6s_ease-out_1.2s_both] hover:bg-muted/70 transition-colors">
              <p className="text-xs text-muted-foreground mb-2">Balance Remaining</p>
              <p className={`text-lg md:text-xl font-semibold break-words ${getColor()}`}>
                {formatCompactCurrency(remaining)}
              </p>
              <p className={`text-xs mt-1 ${getColor()}`}>{formatCurrency(remaining)}</p>
            </div>
          </div>

          {/* Linear Progress */}
          <div className="space-y-2 animate-[fade-in_0.6s_ease-out_1.4s_both]">
            <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full ${getMeterColor()} transition-all duration-2000 ease-out rounded-full shadow-lg`}
                style={{ 
                  width: `${displayPercentage > 100 ? 100 : displayPercentage}%`,
                  boxShadow: '0 0 10px currentColor'
                }}
              />
            </div>
            <p className={`text-xs text-center font-medium transition-colors duration-300 ${getColor()}`}>
              {targetPercentage > 100
                ? `Over budget by ${formatCurrency(spent - budget)}`
                : `${formatCurrency(remaining)} remaining out of ${formatCurrency(budget)} total budget`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}