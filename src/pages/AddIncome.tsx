import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  gst_amount: number;
  gst_percentage: number;
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
  const [previewOpen, setPreviewOpen] = useState(false);
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

      // Initialize entries for all categories (both roles see all subcategories for actual income entry)
      const initialEntries: Record<string, IncomeEntry> = {};
      data?.forEach(cat => {
        // Only initialize child categories and parents without children
        if (cat.parent_category_id !== null) {
          initialEntries[cat.id] = { category_id: cat.id, actual_amount: 0, gst_amount: 0, gst_percentage: 18, notes: '' };
        } else {
          // Check if parent has children
          const hasChildren = data.some(c => c.parent_category_id === cat.id);
          if (!hasChildren) {
            initialEntries[cat.id] = { category_id: cat.id, actual_amount: 0, gst_amount: 0, gst_percentage: 18, notes: '' };
          }
        }
      });
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
          // Calculate GST percentage from existing data if both amounts are present
          const gstPercentage = entry.actual_amount > 0 && entry.gst_amount > 0
            ? Math.round((entry.gst_amount / entry.actual_amount) * 100)
            : 18;
          
          loadedEntries[entry.category_id] = {
            category_id: entry.category_id,
            actual_amount: entry.actual_amount,
            gst_amount: entry.gst_amount || 0,
            gst_percentage: gstPercentage,
            notes: entry.notes || '',
          };
        });
        setIncomeEntries(loadedEntries);
      }
    } catch (error: any) {
      console.error('Error loading existing entries:', error);
    }
  };

  const handlePreviewIncomes = () => {
    const incomeRecords = Object.values(incomeEntries)
      .filter(entry => entry.actual_amount > 0 || entry.gst_amount > 0);

    if (incomeRecords.length === 0) {
      toast({
        title: 'No income to submit',
        description: 'Please enter income amounts for at least one category',
        variant: 'destructive',
      });
      return;
    }

    setPreviewOpen(true);
  };

  const handleSaveIncomes = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const incomeRecords = Object.values(incomeEntries)
        .filter(entry => entry.actual_amount > 0 || entry.gst_amount > 0)
        .map(entry => ({
          fiscal_year: fiscalYear,
          month: selectedMonth,
          category_id: entry.category_id,
          actual_amount: entry.actual_amount,
          gst_amount: entry.gst_amount,
          notes: entry.notes,
          recorded_by: user.id,
        }));

      const { error } = await supabase
        .from('income_actuals')
        .upsert(incomeRecords, {
          onConflict: 'fiscal_year,month,category_id',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      // Fetch the saved records to get their IDs for notification
      const { data: savedRecords } = await supabase
        .from('income_actuals')
        .select('id')
        .eq('fiscal_year', fiscalYear)
        .eq('month', selectedMonth)
        .in('category_id', incomeRecords.map(r => r.category_id));

      // Send notifications to treasurers
      if (savedRecords && savedRecords.length > 0) {
        for (const record of savedRecords) {
          try {
            await supabase.functions.invoke('send-income-notification', {
              body: {
                incomeId: record.id,
                action: 'updated',
              },
            });
          } catch (notifError) {
            console.error('Failed to send notification:', notifError);
          }
        }
      }

      toast({
        title: 'Submitted for approval',
        description: `Validation completed and ${incomeRecords.length} income entries submitted.`,
      });

      setPreviewOpen(false);
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
            Select the fiscal year and month, then enter actual income amounts received for each subcategory
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
            
            {/* Both roles see all subcategories for actual income entry */}
            <div className="space-y-6">
              {parentCategories.map((parent) => {
                const children = categories.filter(cat => cat.parent_category_id === parent.id);
                
                return (
                  <div key={parent.id} className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase border-b pb-2">
                      {parent.category_name}
                    </h4>
                    
                    {children.length > 0 ? (
                      children.map((child) => {
                        const isCAMWithoutGST = parent.category_name.toLowerCase().includes('cam without gst');
                        const total = (incomeEntries[child.id]?.actual_amount || 0) + (incomeEntries[child.id]?.gst_amount || 0);
                        
                        return (
                          <div key={child.id} className="p-4 border rounded-lg space-y-3">
                            <div className="font-medium text-sm">
                              {child.subcategory_name || child.category_name}
                            </div>
                            
                            {isCAMWithoutGST ? (
                              // Single input for CAM without GST
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
                                        gst_amount: 0,
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
                            ) : (
                              // Dual input for all other categories (Base + GST)
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`base-${child.id}`}>Base Amount (excl. GST)</Label>
                                    <Input
                                      id={`base-${child.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={incomeEntries[child.id]?.actual_amount || 0}
                                      onChange={(e) => {
                                        const baseAmount = parseFloat(e.target.value) || 0;
                                        const gstPercentage = incomeEntries[child.id]?.gst_percentage || 18;
                                        const calculatedGST = Math.round(baseAmount * (gstPercentage / 100) * 100) / 100;
                                        
                                        setIncomeEntries({
                                          ...incomeEntries,
                                          [child.id]: {
                                            ...incomeEntries[child.id],
                                            actual_amount: baseAmount,
                                            gst_amount: calculatedGST,
                                          },
                                        });
                                      }}
                                      placeholder="Enter base amount"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor={`gst-pct-${child.id}`}>GST %</Label>
                                    <Select
                                      value={(incomeEntries[child.id]?.gst_percentage || 18).toString()}
                                      onValueChange={(value) => {
                                        const gstPercentage = parseFloat(value);
                                        const baseAmount = incomeEntries[child.id]?.actual_amount || 0;
                                        const calculatedGST = Math.round(baseAmount * (gstPercentage / 100) * 100) / 100;
                                        
                                        setIncomeEntries({
                                          ...incomeEntries,
                                          [child.id]: {
                                            ...incomeEntries[child.id],
                                            gst_percentage: gstPercentage,
                                            gst_amount: calculatedGST,
                                          },
                                        });
                                      }}
                                    >
                                      <SelectTrigger id={`gst-pct-${child.id}`}>
                                        <SelectValue placeholder="GST %" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="18">18%</SelectItem>
                                        <SelectItem value="5">5%</SelectItem>
                                        <SelectItem value="12">12%</SelectItem>
                                        <SelectItem value="28">28%</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor={`gst-${child.id}`}>GST Amount (auto-calculated)</Label>
                                    <Input
                                      id={`gst-${child.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={incomeEntries[child.id]?.gst_amount || 0}
                                      onChange={(e) => setIncomeEntries({
                                        ...incomeEntries,
                                        [child.id]: {
                                          ...incomeEntries[child.id],
                                          gst_amount: parseFloat(e.target.value) || 0,
                                        },
                                      })}
                                      placeholder="Auto-calculated"
                                      className="bg-muted"
                                    />
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-muted-foreground">Total Income</Label>
                                    <div className="px-3 py-2 bg-muted rounded-md font-semibold">
                                      {formatCurrency(total)}
                                    </div>
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
                            )}
                          </div>
                        );
                      })
                    ) : (
                      // If no children, show the parent itself (for categories without subcategories like CAM)
                      (() => {
                        const isCAMWithoutGST = parent.category_name.toLowerCase().includes('cam without gst');
                        const total = (incomeEntries[parent.id]?.actual_amount || 0) + (incomeEntries[parent.id]?.gst_amount || 0);
                        
                        return (
                          <div className="p-4 border rounded-lg space-y-3">
                            {isCAMWithoutGST ? (
                              // Single input for CAM without GST
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
                                        gst_amount: 0,
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
                            ) : (
                              // Dual input for all other categories (Base + GST)
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`base-${parent.id}`}>Base Amount (excl. GST)</Label>
                                    <Input
                                      id={`base-${parent.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={incomeEntries[parent.id]?.actual_amount || 0}
                                      onChange={(e) => {
                                        const baseAmount = parseFloat(e.target.value) || 0;
                                        const gstPercentage = incomeEntries[parent.id]?.gst_percentage || 18;
                                        const calculatedGST = Math.round(baseAmount * (gstPercentage / 100) * 100) / 100;
                                        
                                        setIncomeEntries({
                                          ...incomeEntries,
                                          [parent.id]: {
                                            ...incomeEntries[parent.id],
                                            actual_amount: baseAmount,
                                            gst_amount: calculatedGST,
                                          },
                                        });
                                      }}
                                      placeholder="Enter base amount"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor={`gst-pct-${parent.id}`}>GST %</Label>
                                    <Select
                                      value={(incomeEntries[parent.id]?.gst_percentage || 18).toString()}
                                      onValueChange={(value) => {
                                        const gstPercentage = parseFloat(value);
                                        const baseAmount = incomeEntries[parent.id]?.actual_amount || 0;
                                        const calculatedGST = Math.round(baseAmount * (gstPercentage / 100) * 100) / 100;
                                        
                                        setIncomeEntries({
                                          ...incomeEntries,
                                          [parent.id]: {
                                            ...incomeEntries[parent.id],
                                            gst_percentage: gstPercentage,
                                            gst_amount: calculatedGST,
                                          },
                                        });
                                      }}
                                    >
                                      <SelectTrigger id={`gst-pct-${parent.id}`}>
                                        <SelectValue placeholder="GST %" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="18">18%</SelectItem>
                                        <SelectItem value="5">5%</SelectItem>
                                        <SelectItem value="12">12%</SelectItem>
                                        <SelectItem value="28">28%</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor={`gst-${parent.id}`}>GST Amount (auto-calculated)</Label>
                                    <Input
                                      id={`gst-${parent.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={incomeEntries[parent.id]?.gst_amount || 0}
                                      onChange={(e) => setIncomeEntries({
                                        ...incomeEntries,
                                        [parent.id]: {
                                          ...incomeEntries[parent.id],
                                          gst_amount: parseFloat(e.target.value) || 0,
                                        },
                                      })}
                                      placeholder="Auto-calculated"
                                      className="bg-muted"
                                    />
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-muted-foreground">Total Income</Label>
                                    <div className="px-3 py-2 bg-muted rounded-md font-semibold">
                                      {formatCurrency(total)}
                                    </div>
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
                      })()
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handlePreviewIncomes}
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
                  Preview & Submit Income
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review Income Entries Before Submitting</DialogTitle>
            <DialogDescription>
              Check the totals for each category and confirm before sending to the treasurer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-sm max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Base Amount</th>
                  <th className="text-right p-2">GST Amount</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => {
                  const entry = incomeEntries[cat.id];
                  const base = entry?.actual_amount || 0;
                  const gst = entry?.gst_amount || 0;
                  const total = base + gst;
                  if (total <= 0) return null;
                  return (
                    <tr key={cat.id} className="border-t">
                      <td className="p-2">
                        {cat.subcategory_name || cat.category_name}
                      </td>
                      <td className="p-2 text-right">{formatCurrency(base)}</td>
                      <td className="p-2 text-right">{formatCurrency(gst)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={loading}
            >
              Back to Edit
            </Button>
            <Button
              type="button"
              onClick={handleSaveIncomes}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit for Approval'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
