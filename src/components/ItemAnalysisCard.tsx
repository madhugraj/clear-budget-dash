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

            {/* Main Calculation Display */}
            <div className="p-4 bg-muted/20 rounded-lg space-y-3 border">
              <p className="text-xs font-medium">Calculation Breakdown:</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Annual Budget (FY 2025-26)</span>
                  <span className="font-semibold">{formatCurrency(currentItem.budget)}</span>
                </div>
                
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Total Spent (Approved)</span>
                  <span className="font-semibold">{formatCurrency(currentItem.actual)}</span>
                </div>
                
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Variance</span>
                  <span className={`font-semibold ${
                    currentItem.budget - currentItem.actual >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {currentItem.budget - currentItem.actual >= 0 ? '+' : ''}
                    {formatCurrency(currentItem.budget - currentItem.actual)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground">
                    Utilization = (Spent ÷ Budget) × 100
                  </span>
                  <span className={`font-bold text-base ${
                    currentItem.utilization > 100 ? 'text-destructive' : 
                    currentItem.utilization > 80 ? 'text-warning' : 'text-success'
                  }`}>
                    {currentItem.utilization.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              {/* Formula with actual values */}
              <div className="pt-3 mt-3 border-t text-xs font-mono bg-muted/40 p-3 rounded">
                <p className="text-muted-foreground mb-1">Formula:</p>
                <p>
                  ({formatCurrency(currentItem.actual)} ÷ {formatCurrency(currentItem.budget)}) × 100 = {currentItem.utilization.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={`p-3 rounded text-center text-sm font-medium ${
              currentItem.budget - currentItem.actual >= 0 
                ? 'bg-success/10 text-success' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {currentItem.budget - currentItem.actual >= 0 
                ? `✓ Within Budget - ${formatCurrency(currentItem.budget - currentItem.actual)} remaining` 
                : `⚠ Over Budget by ${formatCurrency(Math.abs(currentItem.budget - currentItem.actual))}`}
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