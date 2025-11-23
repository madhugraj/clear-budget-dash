import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

interface ItemData {
  item_name: string;
  amount: number;
  budget: number;
  utilization: number;
  category?: string;
  committee?: string;
}

interface ItemWiseExpenseChartProps {
  data: ItemData[];
  allCategories: string[];
  allCommittees: string[];
  onCategoryChange: (category: string) => void;
  onCommitteeChange: (committee: string) => void;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function ItemWiseExpenseChart({ 
  data, 
  allCategories, 
  allCommittees,
  onCategoryChange,
  onCommitteeChange 
}: ItemWiseExpenseChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCommittee, setSelectedCommittee] = useState<string>('all');

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    onCategoryChange(value);
  };

  const handleCommitteeChange = (value: string) => {
    setSelectedCommittee(value);
    onCommitteeChange(value);
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
          <p className="font-semibold mb-3 text-sm">{data.item_name}</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Amount Spent:</span>
              <span className="font-semibold">{formatCurrency(data.amount)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Budget Utilization:</span>
              <span className={`font-semibold ${
                data.utilization > 100 ? 'text-destructive' : 
                data.utilization > 80 ? 'text-warning' : 'text-success'
              }`}>
                {data.utilization.toFixed(1)}%
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-border text-xs text-muted-foreground">
              {data.utilization > 100 
                ? '⚠ Over budget' 
                : data.utilization > 80 
                ? '⚡ Near limit' 
                : '✓ Within budget'}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const getBarColor = (utilization: number) => {
    if (utilization > 100) return 'hsl(var(--destructive))';
    if (utilization > 80) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="pb-3 px-6">
        <CardTitle className="text-lg font-semibold">Top 10 Items by Spending</CardTitle>
        <div className="flex gap-2 flex-wrap mt-3">
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCommittee} onValueChange={handleCommitteeChange}>
            <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
              <SelectValue placeholder="Committee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Committees</SelectItem>
              {allCommittees.map(comm => (
                <SelectItem key={comm} value={comm}>{comm}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[500px]">
            <ResponsiveContainer width="100%" height={500}>
              <BarChart 
                data={data} 
                layout="vertical"
                margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis 
                  type="number"
                  tickFormatter={formatCompactCurrency}
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                />
                <YAxis 
                  type="category"
                  dataKey="item_name" 
                  width={120}
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  interval={0}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="amount" 
              radius={[0, 4, 4, 0]}
              barSize={28}
              isAnimationActive={true}
              animationBegin={0}
              animationDuration={1800}
              animationEasing="ease-out"
            >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.utilization)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-success"></div>
            <span className="text-muted-foreground">&lt;80%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-warning"></div>
            <span className="text-muted-foreground">80-100%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-destructive"></div>
            <span className="text-muted-foreground">&gt;100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
