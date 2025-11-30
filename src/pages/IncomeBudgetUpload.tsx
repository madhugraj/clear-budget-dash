import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

interface IncomeCategory {
  id: string;
  category_name: string;
  subcategory_name: string | null;
  display_order: number;
  parent_category_id: string | null;
}

interface IncomeBudgetRow {
  category_id: string;
  category_name: string;
  subcategory_name: string | null;
  budgeted_amount: number;
}

export default function IncomeBudgetUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [fiscalYear, setFiscalYear] = useState<string>('FY25-26');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<IncomeBudgetRow[]>([]);
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [parentCategories, setParentCategories] = useState<IncomeCategory[]>([]);
  const [manualBudgets, setManualBudgets] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const { userRole } = useAuth();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);

      // Separate parent and child categories
      const parents = (data || []).filter(cat => cat.parent_category_id === null);
      const children = (data || []).filter(cat => cat.parent_category_id !== null);

      setParentCategories(parents);

      // Initialize manual budgets
      const initialBudgets: Record<string, number> = {};

      // For treasurer: initialize with parent categories
      // For accountant: initialize with all categories (including children)
      if (userRole === 'treasurer') {
        parents.forEach(cat => {
          initialBudgets[cat.id] = 0;
        });
      } else {
        data?.forEach(cat => {
          initialBudgets[cat.id] = 0;
        });
      }

      setManualBudgets(initialBudgets);
    } catch (error: any) {
      toast({
        title: 'Error loading categories',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const cleanCurrency = (value: any): number => {
        if (!value) return 0;
        const str = String(value).replace(/[₹,\s]/g, '');
        return parseFloat(str) || 0;
      };

      // Map Excel data to income categories
      const budgetRows: IncomeBudgetRow[] = [];

      jsonData.forEach((row: any) => {
        const categoryName = String(row['Category'] || row['CATEGORY'] || '').trim();
        const subcategoryName = String(row['Subcategory'] || row['SUBCATEGORY'] || '').trim();
        const amount = cleanCurrency(row['Budget Amount'] || row['BUDGET AMOUNT'] || row['Amount'] || 0);

        // Find matching category
        const matchedCategory = categories.find(cat => {
          const catMatch = cat.category_name.toLowerCase() === categoryName.toLowerCase();
          if (subcategoryName) {
            return catMatch && cat.subcategory_name?.toLowerCase() === subcategoryName.toLowerCase();
          }
          return catMatch && !cat.subcategory_name;
        });

        if (matchedCategory && amount > 0) {
          budgetRows.push({
            category_id: matchedCategory.id,
            category_name: matchedCategory.category_name,
            subcategory_name: matchedCategory.subcategory_name,
            budgeted_amount: amount,
          });
        }
      });

      setPreview(budgetRows);

      if (budgetRows.length === 0) {
        toast({
          title: 'No valid data found',
          description: 'Please ensure your Excel file has Category and Budget Amount columns matching the income categories',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'File parsed successfully',
          description: `Found ${budgetRows.length} budget items`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error parsing file',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUploadFromFile = async () => {
    if (!file || preview.length === 0) {
      toast({
        title: 'No file selected',
        description: 'Please select a valid CSV or Excel file',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for existing items first
      const { data: existingItems, error: fetchError } = await supabase
        .from('income_budget')
        .select('category_id')
        .eq('fiscal_year', fiscalYear);

      if (fetchError) throw fetchError;

      const existingCategoryIds = new Set((existingItems || []).map(item => item.category_id));

      // Check for duplicates
      const duplicates = preview.filter(item => existingCategoryIds.has(item.category_id));

      if (duplicates.length > 0) {
        throw new Error(`Budget already exists for ${duplicates.length} categories (e.g. ${duplicates[0].category_name}). Please use Corrections to edit.`);
      }

      const budgetItems = preview.map(item => ({
        fiscal_year: fiscalYear,
        category_id: item.category_id,
        budgeted_amount: item.budgeted_amount,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from('income_budget')
        .insert(budgetItems);

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Uploaded ${budgetItems.length} income budget items for fiscal year ${fiscalYear}`,
      });

      setFile(null);
      setPreview([]);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      toast({
        title: 'Error uploading budget',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualBudgets = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for existing items first
      const { data: existingItems, error: fetchError } = await supabase
        .from('income_budget')
        .select('category_id')
        .eq('fiscal_year', fiscalYear);

      if (fetchError) throw fetchError;

      const existingCategoryIds = new Set((existingItems || []).map(item => item.category_id));

      const budgetItems = Object.entries(manualBudgets)
        .filter(([_, amount]) => amount > 0)
        .map(([categoryId, amount]) => ({
          fiscal_year: fiscalYear,
          category_id: categoryId,
          budgeted_amount: amount,
          created_by: user.id,
        }));

      // Check for duplicates
      const duplicates = budgetItems.filter(item => existingCategoryIds.has(item.category_id));

      if (duplicates.length > 0) {
        // Find category name for error message
        const duplicateCat = categories.find(c => c.id === duplicates[0].category_id);
        const catName = duplicateCat ? getCategoryDisplay(duplicateCat) : 'Unknown Category';
        throw new Error(`Budget already exists for ${duplicates.length} categories (e.g. ${catName}). Please use Corrections to edit.`);
      }

      if (budgetItems.length === 0) {
        toast({
          title: 'No budgets to save',
          description: 'Please enter budget amounts for at least one category',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('income_budget')
        .insert(budgetItems);

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Saved ${budgetItems.length} income budget items for fiscal year ${fiscalYear}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error saving budgets',
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

  const getCategoryDisplay = (cat: IncomeCategory) => {
    return cat.subcategory_name
      ? `${cat.category_name} - ${cat.subcategory_name}`
      : cat.category_name;
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Budget Upload - Income</h1>
        <p className="text-muted-foreground mt-2">
          Upload budgeted income amounts for the fiscal year
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fiscal-year">Fiscal Year</Label>
          <Input
            id="fiscal-year"
            type="text"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            placeholder="e.g., FY25-26"
            className="max-w-xs"
          />
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upload">Excel/CSV Upload</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Income Budget File Upload</CardTitle>
                <CardDescription>
                  Upload an Excel file with columns: Category, Subcategory (if applicable), and Budget Amount
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Budget File</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    <Button
                      onClick={handleUploadFromFile}
                      disabled={!file || loading}
                      className="min-w-[120px]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {preview.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Preview: {preview.length} items</span>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-medium">Category</th>
                              <th className="text-left p-3 font-medium">Subcategory</th>
                              <th className="text-right p-3 font-medium">Budget Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.map((row, index) => (
                              <tr key={index} className="border-t">
                                <td className="p-3">{row.category_name}</td>
                                <td className="p-3 text-muted-foreground">
                                  {row.subcategory_name || '-'}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  {formatCurrency(row.budgeted_amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Manual Budget Entry</CardTitle>
                <CardDescription>
                  {userRole === 'treasurer'
                    ? 'Enter budget amounts for each income category group'
                    : 'Enter budget amounts for each income subcategory'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                  {userRole === 'treasurer' ? (
                    // Treasurer View: Show only parent categories
                    parentCategories.map((parent) => (
                      <div key={parent.id} className="space-y-3">
                        <div className="flex items-center gap-4">
                          <Label htmlFor={`budget-${parent.id}`} className="flex-1 font-semibold">
                            {parent.category_name}
                          </Label>
                          <Input
                            id={`budget-${parent.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualBudgets[parent.id] || 0}
                            onChange={(e) => setManualBudgets({
                              ...manualBudgets,
                              [parent.id]: parseFloat(e.target.value) || 0,
                            })}
                            className="max-w-xs"
                            placeholder="Enter amount"
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    // Accountant View: Show all categories grouped by parent
                    parentCategories.map((parent) => {
                      const children = categories.filter(cat => cat.parent_category_id === parent.id);

                      return (
                        <div key={parent.id} className="space-y-3">
                          <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                            {parent.category_name}
                          </h3>
                          {children.length > 0 ? (
                            children.map((child) => (
                              <div key={child.id} className="flex items-center gap-4 pl-4">
                                <Label htmlFor={`budget-${child.id}`} className="flex-1">
                                  {child.subcategory_name || child.category_name}
                                </Label>
                                <Input
                                  id={`budget-${child.id}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={manualBudgets[child.id] || 0}
                                  onChange={(e) => setManualBudgets({
                                    ...manualBudgets,
                                    [child.id]: parseFloat(e.target.value) || 0,
                                  })}
                                  className="max-w-xs"
                                  placeholder="Enter amount"
                                />
                              </div>
                            ))
                          ) : (
                            // If no children, show the parent itself (for categories without subcategories)
                            <div className="flex items-center gap-4 pl-4">
                              <Label htmlFor={`budget-${parent.id}`} className="flex-1">
                                Total Amount
                              </Label>
                              <Input
                                id={`budget-${parent.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={manualBudgets[parent.id] || 0}
                                onChange={(e) => setManualBudgets({
                                  ...manualBudgets,
                                  [parent.id]: parseFloat(e.target.value) || 0,
                                })}
                                className="max-w-xs"
                                placeholder="Enter amount"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveManualBudgets}
                    disabled={loading}
                    className="min-w-[150px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Budgets
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
