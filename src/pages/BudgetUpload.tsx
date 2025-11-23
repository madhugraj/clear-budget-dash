import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BudgetMasterRow {
  serial_no: number;
  item_name: string;
  category: string;
  committee: string;
  annual_budget: number;
  monthly_budget: number;
}

export default function BudgetUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [fiscalYear, setFiscalYear] = useState<string>('FY25-26');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<BudgetMasterRow[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const { toast } = useToast();

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
      
      // Look for "Summary-FOR WHOLE YEAR" sheet
      let sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('summary') && 
        name.toLowerCase().includes('whole year')
      ) || workbook.SheetNames[0];
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Get all data without skipping rows first, to find the header row
      const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      // Find the header row (looking for "SL.NO", "ITEM", "CATEGORY", "COMMITTEE")
      let headerRowIndex = -1;
      for (let i = 0; i < allData.length; i++) {
        const row = allData[i] as any[];
        if (row[0] === 'SL.NO' || row[1] === 'ITEM') {
          headerRowIndex = i;
          break;
        }
      }
      
      if (headerRowIndex === -1) {
        throw new Error('Could not find header row with SL.NO, ITEM, CATEGORY columns');
      }
      
      // Parse data starting after the header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        range: headerRowIndex + 1,
        defval: '' 
      });

      // Helper function to clean currency values
      const cleanCurrency = (value: any): number => {
        if (!value) return 0;
        const str = String(value).replace(/[₹,\s]/g, '');
        return parseFloat(str) || 0;
      };

      // Map to budget master rows
      const budgetRows: BudgetMasterRow[] = jsonData
        .map((row: any) => {
          // Get serial number - could be in SL.NO or column 1
          const serialNo = parseInt(String(row['SL.NO'] || row['1'] || '0'));
          
          // Skip if serial number is invalid or this is a total row
          const itemName = String(row['ITEM'] || row['2'] || '').trim();
          if (!serialNo || serialNo === 0 || !itemName) return null;
          if (itemName.toLowerCase().includes('total') || 
              itemName.toLowerCase().includes('per annum')) return null;
          
          // Extract annual and monthly budgets (columns 5 and 6)
          const annualBudget = cleanCurrency(row['AMOUNT WITH TAX'] || row['5']);
          const monthlyBudget = cleanCurrency(row['AMOUNT WITH TAX__1'] || row['6']);
          
          return {
            serial_no: serialNo,
            item_name: itemName,
            category: String(row['CATEGORY'] || row['3'] || '').trim(),
            committee: String(row['COMMITTEE'] || row['4'] || '').trim(),
            annual_budget: annualBudget,
            monthly_budget: monthlyBudget || (annualBudget > 0 ? annualBudget / 12 : 0),
          };
        })
        .filter((row): row is BudgetMasterRow => row !== null);

      setPreview(budgetRows);
      // Select all items by default
      setSelectedItems(new Set(budgetRows.map((_, index) => index)));
      
      if (budgetRows.length === 0) {
        toast({
          title: 'No valid data found',
          description: 'Please ensure your Excel file has the correct format with SL.NO, ITEM, CATEGORY, COMMITTEE, and AMOUNT WITH TAX columns',
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

  const handleUpload = async () => {
    if (!file || preview.length === 0) {
      toast({
        title: 'No file selected',
        description: 'Please select a valid CSV or Excel file',
        variant: 'destructive',
      });
      return;
    }

    if (selectedItems.size === 0) {
      toast({
        title: 'No items selected',
        description: 'Please select at least one item to upload',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert only selected budget master items
      const selectedPreview = preview.filter((_, index) => selectedItems.has(index));
      const budgetItems = selectedPreview.map(item => ({
        fiscal_year: fiscalYear,
        serial_no: item.serial_no,
        item_name: item.item_name,
        category: item.category,
        committee: item.committee,
        annual_budget: item.annual_budget,
        monthly_budget: item.monthly_budget,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from('budget_master')
        .upsert(budgetItems, {
          onConflict: 'fiscal_year,serial_no',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Uploaded ${budgetItems.length} budget items for fiscal year ${fiscalYear}`,
      });

      // Reset form
      setFile(null);
      setPreview([]);
      setSelectedItems(new Set());
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Upload Budget</h1>
        <p className="text-muted-foreground mt-2">
          Upload your budget allocation for the fiscal year
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget File Upload</CardTitle>
          <CardDescription>
            Upload the approved budget Excel file (Summary-FOR WHOLE YEAR sheet) with columns: SL.NO, ITEM, CATEGORY, COMMITTEE, AMOUNT WITH TAX
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                onClick={handleUpload}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Preview: {preview.length} items ({selectedItems.size} selected)</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedItems(new Set(preview.map((_, i) => i)))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedItems(new Set())}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-3 font-medium w-12">
                          <input
                            type="checkbox"
                            checked={selectedItems.size === preview.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems(new Set(preview.map((_, i) => i)));
                              } else {
                                setSelectedItems(new Set());
                              }
                            }}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="text-left p-3 font-medium">S.No</th>
                        <th className="text-left p-3 font-medium">Item</th>
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-left p-3 font-medium">Committee</th>
                        <th className="text-right p-3 font-medium">Annual Budget</th>
                        <th className="text-right p-3 font-medium">Monthly Budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, index) => (
                        <tr key={index} className="border-t hover:bg-muted/50">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(index)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedItems);
                                if (e.target.checked) {
                                  newSelected.add(index);
                                } else {
                                  newSelected.delete(index);
                                }
                                setSelectedItems(newSelected);
                              }}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="p-3">{row.serial_no}</td>
                          <td className="p-3">{row.item_name}</td>
                          <td className="p-3 text-muted-foreground">{row.category}</td>
                          <td className="p-3 text-muted-foreground">{row.committee}</td>
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(row.annual_budget)}
                          </td>
                          <td className="p-3 text-right font-medium text-muted-foreground">
                            {formatCurrency(row.monthly_budget)}
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
    </div>
  );
}
