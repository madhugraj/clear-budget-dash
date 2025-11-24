import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const budget = payload[0].value;
      const actual = payload[1].value;
      const variance = actual - budget;
      const variancePercent = budget > 0 ? ((actual - budget) / budget * 100).toFixed(1) : '0.0';

      return (
        <div className="bg-card border border-border p-4 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              Budget: <span className="font-medium text-foreground">{formatCurrency(budget)}</span>
            </p>
            <p className="text-muted-foreground">
              Actual (Total): <span className="font-medium text-foreground">{formatCurrency(actual)}</span>
            </p>
            <p className="text-[10px] text-muted-foreground/70 italic">
              (Base + GST combined)
            </p>
            <p className={variance >= 0 ? "text-green-600" : "text-red-600"}>
              Variance: <span className="font-medium">{formatCurrency(Math.abs(variance))} ({variancePercent}%)</span>
              {variance >= 0 ? " ↑" : " ↓"}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Monthly Income Overview</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
          <YAxis 
            tickFormatter={formatCurrency}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="budget" fill="hsl(var(--primary))" name="Budgeted Income" />
          <Bar dataKey="actual" fill="hsl(var(--chart-2))" name="Actual Income" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
