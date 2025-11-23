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
    if (!item) return { projected: 0, projectedUtilization: 0, monthlyAvg: 0 };
    
    // FY 2025-26: April 2025 to March 2026
    // Current data is till October 2025 (7 months: Apr, May, Jun, Jul, Aug, Sep, Oct)
    const monthsElapsed = item.monthsElapsed || 7;
    const monthsRemaining = item.monthsRemaining || 5; // Nov, Dec, Jan, Feb, Mar
    
    const monthlyAvg = monthsElapsed > 0 ? item.actual / monthsElapsed : 0;
    const projected = item.actual + (monthlyAvg * monthsRemaining);
    const projectedUtilization = item.budget > 0 ? (projected / item.budget) * 100 : 0;
    
    return { projected, projectedUtilization, monthlyAvg };
  };

  const projections = getProjections(currentItem);

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="pb-3 space-y-2">
        <CardTitle className="text-base font-normal">Item-wise Budget Analysis</CardTitle>
        <CardDescription className="text-xs">
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

            {/* Visual Graph */}
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Budget', value: currentItem.budget, fill: 'hsl(var(--primary))' },
                    { name: 'Spent (Oct)', value: currentItem.actual, fill: currentItem.actual > currentItem.budget ? 'hsl(var(--destructive))' : 'hsl(var(--success))' },
                    { name: 'Projected (Mar)', value: projections.projected, fill: projections.projected > currentItem.budget ? 'hsl(var(--destructive))' : 'hsl(var(--warning))' },
                  ]}
                  margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {[
                      { name: 'Budget', value: currentItem.budget, fill: 'hsl(var(--primary))' },
                      { name: 'Spent (Oct)', value: currentItem.actual, fill: currentItem.actual > currentItem.budget ? 'hsl(var(--destructive))' : 'hsl(var(--success))' },
                      { name: 'Projected (Mar)', value: projections.projected, fill: projections.projected > currentItem.budget ? 'hsl(var(--destructive))' : 'hsl(var(--warning))' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Projection Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-muted-foreground mb-1">Data Period</p>
                <p className="font-medium">Apr - Oct 2025</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{currentItem.monthsElapsed || 7} months elapsed</p>
              </div>
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-muted-foreground mb-1">Monthly Average</p>
                <p className="font-medium">{formatCurrency(projections.monthlyAvg)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Based on actual spending</p>
              </div>
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-muted-foreground mb-1">Remaining Period</p>
                <p className="font-medium">Nov - Mar 2026</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{currentItem.monthsRemaining || 5} months to go</p>
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
                  <span className={`font-semibold ${
                    currentItem.utilization > 100 ? 'text-destructive' : 
                    currentItem.utilization > 80 ? 'text-warning' : 'text-success'
                  }`}>
                    {currentItem.utilization.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Projection Calculation */}
            <div className="p-4 bg-warning/10 rounded-lg space-y-3 border border-warning/30">
              <p className="text-xs font-medium">Projected by March 2026:</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-warning/20">
                  <span className="text-muted-foreground">Projected Total Spend</span>
                  <span className="font-semibold">{formatCurrency(projections.projected)}</span>
                </div>
                
                <div className="flex justify-between items-center pb-2 border-b border-warning/20">
                  <span className="text-muted-foreground">Projected vs Budget</span>
                  <span className={`font-semibold ${
                    currentItem.budget - projections.projected >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {currentItem.budget - projections.projected >= 0 ? '+' : ''}
                    {formatCurrency(currentItem.budget - projections.projected)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground">
                    Projected Utilization
                  </span>
                  <span className={`font-bold text-base ${
                    projections.projectedUtilization > 100 ? 'text-destructive' : 
                    projections.projectedUtilization > 80 ? 'text-warning' : 'text-success'
                  }`}>
                    {projections.projectedUtilization.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              {/* Projection Formula */}
              <div className="pt-3 mt-3 border-t border-warning/20 text-xs font-mono bg-muted/40 p-3 rounded">
                <p className="text-muted-foreground mb-1">Projection Formula:</p>
                <p className="mb-2">
                  Monthly Avg = {formatCurrency(currentItem.actual)} ÷ 7 months = {formatCurrency(projections.monthlyAvg)}
                </p>
                <p>
                  Projected = {formatCurrency(currentItem.actual)} + ({formatCurrency(projections.monthlyAvg)} × 5 months) = {formatCurrency(projections.projected)}
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={`p-3 rounded text-center text-sm font-medium ${
              projections.projected <= currentItem.budget 
                ? 'bg-success/10 text-success' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {projections.projected <= currentItem.budget 
                ? `✓ Projected to stay within budget - ${formatCurrency(currentItem.budget - projections.projected)} buffer expected` 
                : `⚠ Warning: Projected to exceed budget by ${formatCurrency(Math.abs(currentItem.budget - projections.projected))} if current spending continues`}
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