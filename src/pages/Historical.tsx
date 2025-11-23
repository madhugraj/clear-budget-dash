import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface BudgetItem {
  id: string;
  category: string;
}

export default function Historical() {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [selectedBudgetItem, setSelectedBudgetItem] = useState<string>('');
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear() - 1);
  const [q1Amount, setQ1Amount] = useState<string>('');
  const [q2Amount, setQ2Amount] = useState<string>('');
  const [q3Amount, setQ3Amount] = useState<string>('');
  const [q4Amount, setQ4Amount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadBudgetItems();
  }, []);

  const loadBudgetItems = async () => {
    try {
      const { data, error } = await supabase
        .from('budget_items')
        .select('id, category')
        .order('category');

      if (error) throw error;
      setBudgetItems(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading budget categories',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('historical_spending')
        .upsert({
          budget_item_id: selectedBudgetItem,
          fiscal_year: fiscalYear,
          q1_amount: parseFloat(q1Amount) || 0,
          q2_amount: parseFloat(q2Amount) || 0,
          q3_amount: parseFloat(q3Amount) || 0,
          q4_amount: parseFloat(q4Amount) || 0,
          created_by: user.id,
        }, {
          onConflict: 'budget_item_id,fiscal_year',
        });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Historical spending data saved',
      });

      // Reset form
      setQ1Amount('');
      setQ2Amount('');
      setQ3Amount('');
      setQ4Amount('');
    } catch (error: any) {
      toast({
        title: 'Error saving data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getTotalAmount = () => {
    const q1 = parseFloat(q1Amount) || 0;
    const q2 = parseFloat(q2Amount) || 0;
    const q3 = parseFloat(q3Amount) || 0;
    const q4 = parseFloat(q4Amount) || 0;
    return q1 + q2 + q3 + q4;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Historical Spending</h1>
        <p className="text-muted-foreground mt-2">
          Enter quarterly spending data from previous years for projections
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quarterly Spending Data</CardTitle>
          <CardDescription>
            Record actual spending amounts for each quarter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-category">Budget Category</Label>
                <Select value={selectedBudgetItem} onValueChange={setSelectedBudgetItem} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiscal-year">Fiscal Year</Label>
                <Input
                  id="fiscal-year"
                  type="number"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                  min={2000}
                  max={new Date().getFullYear() - 1}
                  required
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="q1">Q1 Amount (₹)</Label>
                <Input
                  id="q1"
                  type="number"
                  step="0.01"
                  value={q1Amount}
                  onChange={(e) => setQ1Amount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="q2">Q2 Amount (₹)</Label>
                <Input
                  id="q2"
                  type="number"
                  step="0.01"
                  value={q2Amount}
                  onChange={(e) => setQ2Amount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="q3">Q3 Amount (₹)</Label>
                <Input
                  id="q3"
                  type="number"
                  step="0.01"
                  value={q3Amount}
                  onChange={(e) => setQ3Amount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="q4">Q4 Amount (₹)</Label>
                <Input
                  id="q4"
                  type="number"
                  step="0.01"
                  value={q4Amount}
                  onChange={(e) => setQ4Amount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-medium text-muted-foreground">Total Annual:</span>
                <span className="text-2xl font-bold">{formatCurrency(getTotalAmount())}</span>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Historical Data
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
