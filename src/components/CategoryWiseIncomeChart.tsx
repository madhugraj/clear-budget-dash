import { Card } from '@/components/ui/card';

interface CategoryIncomeData {
  category: string;
  actual: number;
  budget: number;
  utilization: number;
}

interface CategoryWiseIncomeChartProps {
  data: CategoryIncomeData[];
}

export const CategoryWiseIncomeChart = ({ data }: CategoryWiseIncomeChartProps) => {
  const formatCompact = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
    return `₹${value}`;
  };

  // Sort by utilization descending
  const sortedData = [...data].sort((a, b) => b.utilization - a.utilization);

  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => Math.max(d.actual, d.budget)));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-4 text-foreground">Category Achievement</h3>
      <div className="space-y-3">
        {sortedData.map((item) => {
          const actualWidth = maxValue > 0 ? (item.actual / maxValue) * 100 : 0;
          const budgetWidth = maxValue > 0 ? (item.budget / maxValue) * 100 : 0;
          const isAchieved = item.utilization >= 100;

          return (
            <div key={item.category} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-foreground font-medium truncate max-w-[140px]" title={item.category}>
                  {item.category}
                </span>
                <span className={`font-medium ${isAchieved ? 'text-green-600' : 'text-amber-600'}`}>
                  {item.utilization.toFixed(0)}%
                </span>
              </div>
              <div className="relative h-5 bg-muted/30 rounded overflow-hidden">
                {/* Budget bar (background) */}
                <div 
                  className="absolute top-0 left-0 h-full bg-muted/50 rounded"
                  style={{ width: `${budgetWidth}%` }}
                />
                {/* Actual bar (foreground) */}
                <div 
                  className={`absolute top-0 left-0 h-full rounded transition-all ${
                    isAchieved ? 'bg-green-500/80' : 'bg-primary/80'
                  }`}
                  style={{ width: `${actualWidth}%` }}
                />
                {/* Values */}
                <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px]">
                  <span className="text-foreground font-medium drop-shadow-sm">
                    {formatCompact(item.actual)}
                  </span>
                  <span className="text-muted-foreground">
                    / {formatCompact(item.budget)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground justify-center">
        <span className="flex items-center gap-1">
          <div className="w-3 h-2 bg-primary/80 rounded" /> Actual
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-2 bg-muted/50 rounded" /> Budget
        </span>
      </div>
    </Card>
  );
};
