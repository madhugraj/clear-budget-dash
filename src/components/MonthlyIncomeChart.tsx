import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface MonthlyIncomeData {
  month: string;
  actual: number;
  budget: number;
}

interface MonthlyIncomeChartProps {
  data: MonthlyIncomeData[];
}

export const MonthlyIncomeChart = ({ data }: MonthlyIncomeChartProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(0)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
    return `₹${value}`;
  };

  // Calculate average monthly budget for reference line
  const avgBudget = data.length > 0 
    ? data.reduce((sum, d) => sum + d.budget, 0) / data.length 
    : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const actual = payload[0].value;
      const budget = data.find(d => d.month === label)?.budget || 0;
      const achievement = budget > 0 ? ((actual / budget) * 100).toFixed(0) : '0';

      return (
        <div className="bg-card border border-border px-3 py-2 rounded-md shadow-sm text-sm">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-muted-foreground">
            Actual: <span className="text-foreground font-medium">{formatCurrency(actual)}</span>
          </p>
          <p className="text-muted-foreground">
            Budget: <span className="text-foreground font-medium">{formatCurrency(budget)}</span>
          </p>
          <p className={Number(achievement) >= 100 ? "text-green-600" : "text-amber-600"}>
            {achievement}% achieved
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-3 text-foreground">Monthly Income</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="20%">
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            tickFormatter={formatCompact}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
          <ReferenceLine 
            y={avgBudget} 
            stroke="hsl(var(--muted-foreground))" 
            strokeDasharray="4 4" 
            strokeWidth={1}
          />
          <Bar 
            dataKey="actual" 
            fill="hsl(var(--primary))" 
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Dashed line = avg monthly budget
      </p>
    </Card>
  );
};
