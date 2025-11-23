import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OverBudgetItem {
  item_name: string;
  budget: number;
  actual: number;
  overAmount: number;
  utilization: number;
  category: string;
  committee: string;
}

interface OverBudgetAlertProps {
  items: OverBudgetItem[];
}

export function OverBudgetAlert({ items }: OverBudgetAlertProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-base font-semibold text-destructive">
            Over Budget Items
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          {items.length} item{items.length > 1 ? 's have' : ' has'} exceeded the budgeted amount
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div 
              key={index} 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-background rounded-lg border border-destructive/20"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.item_name}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {item.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {item.committee}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-1 shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Budget:</span>
                  <span className="font-medium">{formatCurrency(item.budget)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Spent:</span>
                  <span className="font-semibold text-destructive">{formatCurrency(item.actual)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-destructive">
                  <span>Over by:</span>
                  <span>{formatCurrency(item.overAmount)}</span>
                </div>
                <Badge variant="destructive" className="text-xs mt-1">
                  {item.utilization.toFixed(1)}% utilized
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
