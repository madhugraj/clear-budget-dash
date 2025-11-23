import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface ItemDetail {
  item_name: string;
  full_item_name: string;
  budget: number;
  actual: number;
  utilization: number;
  category: string;
  committee: string;
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
    const cats = new Set(items.map(item => item.category));
    return Array.from(cats).sort();
  }, [items]);

  const committees = useMemo(() => {
    const comms = new Set(items.map(item => item.committee));
    return Array.from(comms).sort();
  }, [items]);

  // Filter items based on category and committee
  const filteredItems = useMemo(() => {
    let filtered = items;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Item-wise Budget Analysis</CardTitle>
        <CardDescription>Select filters and an item to view detailed Budget vs Actual comparison</CardDescription>
        
        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Committee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Committees</SelectItem>
              {committees.map(comm => (
                <SelectItem key={comm} value={comm}>{comm}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedItem} onValueChange={setSelectedItem}>
            <SelectTrigger>
              <SelectValue placeholder="Select an Item" />
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
          <div className="space-y-6">
            {/* Item Info Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="text-base font-medium">{currentItem.category}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Committee</p>
                <p className="text-base font-medium">{currentItem.committee}</p>
              </div>
            </div>

            {/* Budget vs Actual Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Budget
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(currentItem.budget)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-accent/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-accent" />
                    Actual Spent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-accent">
                    {formatCurrency(currentItem.actual)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Variance Section */}
            <Card className={`border ${
              currentItem.budget - currentItem.actual >= 0 
                ? 'border-success/20 bg-success/5' 
                : 'border-destructive/20 bg-destructive/5'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className={`h-4 w-4 ${
                    currentItem.budget - currentItem.actual >= 0 
                      ? 'text-success' 
                      : 'text-destructive'
                  }`} />
                  Variance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Variance Amount</span>
                  <span className={`text-xl font-bold ${
                    currentItem.budget - currentItem.actual >= 0 
                      ? 'text-success' 
                      : 'text-destructive'
                  }`}>
                    {currentItem.budget - currentItem.actual >= 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(currentItem.budget - currentItem.actual))}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Budget Utilization</span>
                    <span className={`text-base font-bold ${
                      currentItem.utilization > 100 
                        ? 'text-destructive' 
                        : currentItem.utilization > 80 
                        ? 'text-warning' 
                        : 'text-success'
                    }`}>
                      {currentItem.utilization.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(currentItem.utilization, 100)} 
                    className={`h-3 ${
                      currentItem.utilization > 100 
                        ? '[&>div]:bg-destructive' 
                        : currentItem.utilization > 80 
                        ? '[&>div]:bg-warning' 
                        : '[&>div]:bg-success'
                    }`}
                  />
                </div>

                <div className={`p-3 rounded-lg text-center ${
                  currentItem.budget - currentItem.actual >= 0 
                    ? 'bg-success/20' 
                    : 'bg-destructive/20'
                }`}>
                  <p className={`text-sm font-semibold ${
                    currentItem.budget - currentItem.actual >= 0 
                      ? 'text-success' 
                      : 'text-destructive'
                  }`}>
                    {currentItem.budget - currentItem.actual >= 0 
                      ? '✓ Within Budget' 
                      : '⚠ Over Budget'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground mb-1">Remaining Budget</p>
                <p className="font-semibold">
                  {formatCurrency(Math.max(0, currentItem.budget - currentItem.actual))}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground mb-1">Utilization Status</p>
                <p className="font-semibold">
                  {currentItem.utilization < 50 ? 'Low' : 
                   currentItem.utilization < 80 ? 'Moderate' : 
                   currentItem.utilization < 100 ? 'High' : 'Exceeded'}
                </p>
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