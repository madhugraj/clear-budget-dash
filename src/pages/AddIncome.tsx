import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Save, Plus } from 'lucide-react';

interface IncomeCategory {
  id: string;
  category_name: string;
  subcategory_name: string | null;
  display_order: number;
  parent_category_id: string | null;
}

interface IncomeEntry {
  category_id: string;
  actual_amount: number;
  notes: string;
}

const MONTHS = [
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
];

export default function AddIncome() {
  const [fiscalYear, setFiscalYear] = useState<string>('FY25-26');
  const [selectedMonth, setSelectedMonth] = useState<number>(4);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [parentCategories, setParentCategories] = useState<IncomeCategory[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<Record<string, IncomeEntry>>({});
  const { toast } = useToast();
  const { userRole } = useAuth();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    // Load existing entries when month or year changes
    if (selectedMonth && fiscalYear) {
      loadExistingEntries();
    }
  }, [selectedMonth, fiscalYear]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);

      const parents = (data || []).filter(cat => cat.parent_category_id === null);
      setParentCategories(parents);

      // Initialize entries
      const initialEntries: Record<string, IncomeEntry> = {};
      if (userRole === 'treasurer') {
        parents.forEach(cat => {
          initialEntries[cat.id] = { category_id: cat.id, actual_amount: 0, notes: '' };
        });
      } else {
        data?.forEach(cat => {
          initialEntries[cat.id] = { category_id: cat.id, actual_amount: 0, notes: '' };
        });
      }
      setIncomeEntries(initialEntries);
    } catch (error: any) {
      toast({
        title: 'Error loading categories',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const loadExistingEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('income_actuals')
        .select('*')
        .eq('fiscal_year', fiscalYear)
        .eq('month', selectedMonth);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedEntries: Record<string, IncomeEntry> = { ...incomeEntries };
        data.forEach(entry => {
          loadedEntries[entry.category_id] = {
            category_id: entry.category_id,
            actual_amount: entry.actual_amount,
            notes: entry.notes || '',
          };
        });
        setIncomeEntries(loadedEntries);
      }
    } catch (error: any) {
      console.error('Error loading existing entries:', error);
    }
  };

  const handleSaveIncomes = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const incomeRecords = Object.values(incomeEntries)
        .filter(entry => entry.actual_amount > 0)
        .map(entry => ({
          fiscal_year: fiscalYear,
          month: selectedMonth,
          category_id: entry.category_id,
          actual_amount: entry.actual_amount,
          notes: entry.notes,
          recorded_by: user.id,
        }));

      if (incomeRecords.length === 0) {
        toast({
          title: 'No income to save',
          description: 'Please enter income amounts for at least one category',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('income_actuals')
        .upsert(incomeRecords, {
          onConflict: 'fiscal_year,month,category_id',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Saved ${incomeRecords.length} income entries for ${MONTHS.find(m => m.value === selectedMonth)?.label} ${fiscalYear}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error saving income',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Add Income</h1>
        <p className="text-muted-foreground mt-2">
          Record actual income received for the selected month
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Entry Details</CardTitle>
          <CardDescription>
            Select the fiscal year and month, then enter income amounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fiscal-year">Fiscal Year</Label>
              <Input
                id="fiscal-year"
                type="text"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                placeholder="e.g., FY25-26"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger id="month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="font-semibold text-lg border-b pb-2">Income Categories</h3>
            
            {userRole === 'treasurer' ? (
              // Treasurer View: Show only parent categories
              <div className="space-y-6">
                {parentCategories.map((parent) => (
                  <div key={parent.id} className="space-y-3 p-4 border rounded-lg">
                    <h4 className="font-semibold text-sm">{parent.category_name}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`amount-${parent.id}`}>Amount Received</Label>
                        <Input
                          id={`amount-${parent.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={incomeEntries[parent.id]?.actual_amount || 0}
                          onChange={(e) => setIncomeEntries({
                            ...incomeEntries,
                            [parent.id]: {
                              ...incomeEntries[parent.id],
                              actual_amount: parseFloat(e.target.value) || 0,
                            },
                          })}
                          placeholder="Enter amount"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor={`notes-${parent.id}`}>Notes (Optional)</Label>
                        <Input
                          id={`notes-${parent.id}`}
                          type="text"
                          value={incomeEntries[parent.id]?.notes || ''}
                          onChange={(e) => setIncomeEntries({
                            ...incomeEntries,
                            [parent.id]: {
                              ...incomeEntries[parent.id],
                              notes: e.target.value,
                            },
                          })}
                          placeholder="Add notes"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Accountant View: Show all categories grouped by parent
              <div className="space-y-6">
                {parentCategories.map((parent) => {
                  const children = categories.filter(cat => cat.parent_category_id === parent.id);
                  
                  return (
                    <div key={parent.id} className="space-y-3">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase border-b pb-2">
                        {parent.category_name}
                      </h4>
                      
                      {children.length > 0 ? (
                        children.map((child) => (
                          <div key={child.id} className="p-4 border rounded-lg space-y-3">
                            <div className="font-medium text-sm">
                              {child.subcategory_name || child.category_name}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor={`amount-${child.id}`}>Amount Received</Label>
                                <Input
                                  id={`amount-${child.id}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={incomeEntries[child.id]?.actual_amount || 0}
                                  onChange={(e) => setIncomeEntries({
                                    ...incomeEntries,
                                    [child.id]: {
                                      ...incomeEntries[child.id],
                                      actual_amount: parseFloat(e.target.value) || 0,
                                    },
                                  })}
                                  placeholder="Enter amount"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor={`notes-${child.id}`}>Notes (Optional)</Label>
                                <Input
                                  id={`notes-${child.id}`}
                                  type="text"
                                  value={incomeEntries[child.id]?.notes || ''}
                                  onChange={(e) => setIncomeEntries({
                                    ...incomeEntries,
                                    [child.id]: {
                                      ...incomeEntries[child.id],
                                      notes: e.target.value,
                                    },
                                  })}
                                  placeholder="Add notes"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        // If no children, show the parent itself
                        <div className="p-4 border rounded-lg space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`amount-${parent.id}`}>Amount Received</Label>
                              <Input
                                id={`amount-${parent.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={incomeEntries[parent.id]?.actual_amount || 0}
                                onChange={(e) => setIncomeEntries({
                                  ...incomeEntries,
                                  [parent.id]: {
                                    ...incomeEntries[parent.id],
                                    actual_amount: parseFloat(e.target.value) || 0,
                                  },
                                })}
                                placeholder="Enter amount"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor={`notes-${parent.id}`}>Notes (Optional)</Label>
                              <Input
                                id={`notes-${parent.id}`}
                                type="text"
                                value={incomeEntries[parent.id]?.notes || ''}
                                onChange={(e) => setIncomeEntries({
                                  ...incomeEntries,
                                  [parent.id]: {
                                    ...incomeEntries[parent.id],
                                    notes: e.target.value,
                                  },
                                })}
                                placeholder="Add notes"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSaveIncomes}
              disabled={loading}
              size="lg"
              className="min-w-[200px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Income Entries
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
