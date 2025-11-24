import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-4 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground mb-2">{data.category}</p>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              Budget: <span className="font-medium text-foreground">{formatCurrency(data.budget)}</span>
            </p>
            <p className="text-muted-foreground">
              Actual: <span className="font-medium text-foreground">{formatCurrency(data.actual)}</span>
            </p>
            <p className="text-muted-foreground">
              Achievement: <span className="font-medium text-foreground">{data.utilization.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const getBarColor = (utilization: number) => {
    if (utilization >= 100) return 'hsl(var(--chart-2))'; // Green for met/exceeded
    if (utilization >= 75) return 'hsl(var(--chart-3))'; // Yellow for good progress
    return 'hsl(var(--chart-5))'; // Red for low achievement
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Category-wise Income Achievement</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tickFormatter={formatCompactCurrency} stroke="hsl(var(--muted-foreground))" />
          <YAxis 
            dataKey="category" 
            type="category" 
            width={150}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="actual" 
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
