import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';

interface MonthlyData {
  month: string;
  amount: number;
  budget: number;
}

interface MonthlyExpenseChartProps {
  data: MonthlyData[];
}

export function MonthlyExpenseChart({ data }: MonthlyExpenseChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const point = payload[0]?.payload as MonthlyData;
      const budget = point?.budget ?? 0;
      const actual = point?.amount ?? 0;
      const variance = budget - actual;
      const isWithinBudget = variance >= 0;

      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
          <p className="font-semibold mb-2">{point.month}</p>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Budget:</span>
              <span className="font-medium">{formatCurrency(budget)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Actual:</span>
              <span className="font-medium">{formatCurrency(actual)}</span>
            </p>
            <div className="border-t border-border pt-1 mt-1">
              <p className="flex justify-between gap-4">
                <span className="text-muted-foreground">Variance:</span>
                <span className={`font-semibold ${isWithinBudget ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(Math.abs(variance))}
                </span>
              </p>
              <p className={`text-xs font-medium mt-1 ${isWithinBudget ? 'text-success' : 'text-destructive'}`}>
                {isWithinBudget ? 'Within Budget' : 'Over Budget'}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="pb-4 px-6">
        <CardTitle className="text-lg font-semibold">Monthly Spending Analysis</CardTitle>
        <CardDescription className="text-sm">Budget vs Actual Comparison</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              dataKey="budget" 
              fill="hsl(var(--primary))" 
              name="Monthly Budget"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationBegin={0}
              animationDuration={1500}
              animationEasing="ease-out"
            />
            <Bar 
              dataKey="amount" 
              fill="hsl(var(--accent))" 
              name="Actual Spent"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationBegin={400}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
