import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ItemDetail {
  item_name: string;
  full_item_name: string;
  budget: number;
  actual: number;
  utilization: number;
  category: string;
  committee: string;
  monthsElapsed?: number;
  monthsRemaining?: number;
}

interface ItemAnalysisCardProps {
  items: ItemDetail[];
}

export function ItemAnalysisCard({ items }: ItemAnalysisCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCommittee, setSelectedCommittee] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<string>('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get unique categories and committees
  const categories = useMemo(() => {
    const cats = new Set(items.map(item => item.category).filter(cat => cat && cat.trim() !== ''));
    return Array.from(cats).sort();
  }, [items]);

  const committees = useMemo(() => {
    const comms = new Set(items.map(item => item.committee).filter(comm => comm && comm.trim() !== ''));
    return Array.from(comms).sort();
  }, [items]);

  // Filter items based on category and committee
  const filteredItems = useMemo(() => {
    let filtered = items.filter(item => item.item_name && item.item_name.trim() !== '');
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    if (selectedCommittee !== 'all') {
      filtered = filtered.filter(item => item.committee === selectedCommittee);
    }
    return filtered;
  }, [items, selectedCategory, selectedCommittee]);

  // Reset item selection when filters change
  useMemo(() => {
    if (selectedItem) {
      const itemStillExists = filteredItems.find(item => item.item_name === selectedItem);
      if (!itemStillExists) {
        setSelectedItem('');
      }
    }
  }, [filteredItems, selectedItem]);

  const currentItem = filteredItems.find(item => item.item_name === selectedItem);

  // Calculate projections
  const getProjections = (item: ItemDetail | undefined) => {
    if (!item) return { projected: 0, projectedUtilization: 0, monthlyAvg: 0, runRate: 0 };

    // FY 2025-26: April 2025 to March 2026 (12 months total)
    // Current data: April to October 2025 (7 months)
    const monthsElapsed = item.monthsElapsed || 7;
    const monthsRemaining = item.monthsRemaining || 5;
    const totalMonths = monthsElapsed + monthsRemaining; // 12 months

    // Monthly average based on actual spending so far
    const monthlyAvg = monthsElapsed > 0 ? item.actual / monthsElapsed : 0;

    // Simple linear projection: assumes same spending rate continues
    const projected = item.actual + (monthlyAvg * monthsRemaining);
    const projectedUtilization = item.budget > 0 ? (projected / item.budget) * 100 : 0;

    // Run rate: what % of budget should be used by now (proportional to time elapsed)
    const expectedUtilizationByNow = (monthsElapsed / totalMonths) * 100; // Should be ~58.3% (7/12)
    const runRate = item.utilization - expectedUtilizationByNow; // Positive = ahead of schedule

    return { projected, projectedUtilization, monthlyAvg, runRate, expectedUtilizationByNow };
  };

  const projections = getProjections(currentItem);

  return (
    <Card className="border-none shadow-lg bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3 space-y-2 px-6">
        <CardTitle className="text-lg font-semibold">Item-wise Budget Analysis</CardTitle>
        <CardDescription className="text-sm">
          Select category, committee, and item to view detailed calculations
        </CardDescription>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Committee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Committees</SelectItem>
              {committees.map(comm => (
                <SelectItem key={comm} value={comm}>{comm}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedItem} onValueChange={setSelectedItem}>
            <SelectTrigger className="h-8 text-xs sm:col-span-2 lg:col-span-1">
              <SelectValue placeholder="Select Item" />
            </SelectTrigger>
            <SelectContent>
              {filteredItems.map(item => (
                <SelectItem key={item.item_name} value={item.item_name}>
                  {item.full_item_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {currentItem ? (
          <div className="space-y-4">
            {/* Item Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-muted-foreground mb-1">Category</p>
                <p className="font-medium">{currentItem.category}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-muted-foreground mb-1">Committee</p>
                <p className="font-medium">{currentItem.committee}</p>
              </div>
            </div>

            {/* Visual Graph - Simplified */}
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Budget', value: currentItem.budget, fill: 'hsl(var(--primary))' },
                    { name: 'Spent', value: currentItem.actual, fill: currentItem.actual > currentItem.budget ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' },
                    { name: 'Projected', value: projections.projected, fill: projections.projected > currentItem.budget ? 'hsl(var(--destructive))' : 'hsl(var(--warning))' },
                  ]}
                  margin={{ top: 5, right: 5, left: 5, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '4px',
                      fontSize: '11px',
                      padding: '6px'
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationBegin={200}
                    animationDuration={1600}
                    animationEasing="ease-out"
                  >
                    {[
                      { name: 'Budget', value: currentItem.budget, fill: 'hsl(var(--primary))' },
                      { name: 'Spent', value: currentItem.actual, fill: currentItem.actual > currentItem.budget ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' },
                      { name: 'Projected', value: projections.projected, fill: projections.projected > currentItem.budget ? 'hsl(var(--destructive))' : 'hsl(var(--warning))' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pacing Analysis */}
            <div className="p-4 bg-muted/20 rounded-lg border">
              <p className="text-xs font-medium mb-3">Spending Pace Analysis:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">Time Elapsed</p>
                  <p className="font-medium">{currentItem.monthsElapsed || 7} / 12 months</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {projections.expectedUtilizationByNow.toFixed(1)}% of year
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Budget Used</p>
                  <p className="font-medium">{currentItem.utilization.toFixed(1)}%</p>
                  <p className={`text-[10px] mt-0.5 ${projections.runRate > 5 ? 'text-warning' :
                      projections.runRate < -5 ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                    {projections.runRate > 0 ? '+' : ''}{projections.runRate.toFixed(1)}% vs expected pace
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Monthly Average</p>
                  <p className="font-medium">{formatCurrency(projections.monthlyAvg)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {((projections.monthlyAvg / currentItem.budget) * 100).toFixed(1)}% of budget/month
                  </p>
                </div>
              </div>
            </div>

            {/* Main Calculation Display */}
            <div className="p-4 bg-muted/20 rounded-lg space-y-3 border">
              <p className="text-xs font-medium">Current Status (as of October 2025):</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Annual Budget (FY 2025-26)</span>
                  <span className="font-semibold">{formatCurrency(currentItem.budget)}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Total Spent (Apr - Oct)</span>
                  <span className="font-semibold">{formatCurrency(currentItem.actual)}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Current Utilization</span>
                  <span className={`font-semibold ${currentItem.utilization > 100 ? 'text-destructive' :
                      currentItem.utilization > 80 ? 'text-warning' : 'text-primary'
                    }`}>
                    {currentItem.utilization.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Projection Calculation */}
            <div className={`p-4 rounded-lg space-y-3 border ${projections.projected > currentItem.budget
                ? 'bg-warning/10 border-warning/30'
                : 'bg-primary/10 border-primary/30'
              }`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium">Linear Projection (if current rate continues):</p>
                <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                  Assumes constant spending rate
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border/20">
                  <span className="text-muted-foreground">Spent (7 months)</span>
                  <span className="font-semibold">{formatCurrency(currentItem.actual)}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-border/20">
                  <span className="text-muted-foreground">Projected Additional (5 months)</span>
                  <span className="font-semibold">{formatCurrency(projections.monthlyAvg * (currentItem.monthsRemaining || 5))}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-border/20">
                  <span className="text-muted-foreground">Projected Total by March</span>
                  <span className="font-semibold">{formatCurrency(projections.projected)}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-border/20">
                  <span className="text-muted-foreground">Annual Budget</span>
                  <span className="font-semibold">{formatCurrency(currentItem.budget)}</span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground font-medium">
                    Projected vs Budget
                  </span>
                  <span className={`font-bold text-base ${currentItem.budget - projections.projected >= 0 ? 'text-primary' : 'text-destructive'
                    }`}>
                    {currentItem.budget - projections.projected >= 0 ? '+' : ''}
                    {formatCurrency(currentItem.budget - projections.projected)}
                  </span>
                </div>
              </div>

              {/* Projection Formula */}
              <div className="pt-3 mt-3 border-t border-border/20 text-xs font-mono bg-muted/40 p-3 rounded space-y-1">
                <p className="text-muted-foreground mb-2">Calculation:</p>
                <p>Monthly Average = {formatCurrency(currentItem.actual)} ÷ 7 = {formatCurrency(projections.monthlyAvg)}</p>
                <p>Next 5 months = {formatCurrency(projections.monthlyAvg)} × 5 = {formatCurrency(projections.monthlyAvg * 5)}</p>
                <p className="pt-1 border-t border-border/20 mt-1">
                  Projected Total = {formatCurrency(currentItem.actual)} + {formatCurrency(projections.monthlyAvg * 5)} = {formatCurrency(projections.projected)}
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={`p-4 rounded-lg text-sm ${projections.projected <= currentItem.budget
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-destructive/10 text-destructive border border-destructive/30'
              }`}>
              <div className="font-medium mb-2">
                {projections.projected <= currentItem.budget
                  ? '✓ On Track'
                  : '⚠ At Risk'}
              </div>
              <div className="text-xs leading-relaxed">
                {projections.projected <= currentItem.budget
                  ? `Based on current spending rate of ${formatCurrency(projections.monthlyAvg)}/month, you're projected to finish ${formatCurrency(currentItem.budget - projections.projected)} under budget. You're using ${currentItem.utilization.toFixed(1)}% of budget in ${projections.expectedUtilizationByNow.toFixed(1)}% of the year.`
                  : `At current rate (${formatCurrency(projections.monthlyAvg)}/month), spending may exceed budget by ${formatCurrency(Math.abs(currentItem.budget - projections.projected))} by March 2026. You've used ${currentItem.utilization.toFixed(1)}% of budget with only ${projections.expectedUtilizationByNow.toFixed(1)}% of the year elapsed. Consider reducing monthly spending to ~${formatCurrency(currentItem.budget / 12)} to stay within budget.`}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">No Item Selected</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {filteredItems.length === 0
                ? 'No items match the selected filters. Please adjust your category or committee selection.'
                : 'Select an item from the dropdown above to view detailed budget analysis.'}
            </p>
            {filteredItems.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {filteredItems.length} item(s) available
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}