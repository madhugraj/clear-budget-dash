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
      notation: 'compact',
    }).format(value);
  };

  const getBarColor = (utilization: number) => {
    if (utilization > 100) return 'hsl(var(--destructive))';
    if (utilization > 80) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  return (
    <Card className="border-none shadow-none">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div>
            <CardTitle className="text-base font-normal">Top 10 Items by Spending</CardTitle>
            <CardDescription className="text-xs">Budget utilization by item</CardDescription>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCommittee} onValueChange={handleCommitteeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Committee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Committees</SelectItem>
                {allCommittees.map(comm => (
                  <SelectItem key={comm} value={comm}>{comm}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <ResponsiveContainer width="100%" height={600}>
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ left: 150, right: 40, top: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              type="number"
              tickFormatter={formatCurrency}
              className="text-sm"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              type="category"
              dataKey="item_name" 
              width={140}
              className="text-sm"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              interval={0}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelFormatter={(label) => `Item: ${label}`}
            />
            <Bar 
              dataKey="amount" 
              name="Spent"
              radius={[0, 6, 6, 0]}
              barSize={35}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.utilization)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success"></div>
            <span className="text-muted-foreground">{'<80%'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning"></div>
            <span className="text-muted-foreground">80-100%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive"></div>
            <span className="text-muted-foreground">{'>100%'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
