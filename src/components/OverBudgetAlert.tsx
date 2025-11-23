import { AlertTriangle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

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
  const [isOpen, setIsOpen] = useState(false);

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

  const totalOverAmount = items.reduce((sum, item) => sum + item.overAmount, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-destructive/50 bg-destructive/5 rounded-lg">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between gap-3 hover:bg-destructive/10 transition-colors">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold text-destructive">
                {items.length} Item{items.length > 1 ? 's' : ''} Over Budget
              </p>
              <p className="text-xs text-muted-foreground">
                Total excess: {formatCurrency(totalOverAmount)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="destructive" className="text-xs">
              Action Required
            </Badge>
            <ChevronDown className={`h-4 w-4 text-destructive transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {items.map((item, index) => (
              <div 
                key={index} 
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-background rounded border border-destructive/20"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.item_name}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {item.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {item.committee}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <div className="text-right">
                    <div className="text-muted-foreground">Budget</div>
                    <div className="font-medium">{formatCurrency(item.budget)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">Spent</div>
                    <div className="font-semibold text-destructive">{formatCurrency(item.actual)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">Over</div>
                    <div className="font-bold text-destructive">{formatCurrency(item.overAmount)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
