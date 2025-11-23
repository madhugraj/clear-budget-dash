import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BudgetRow {
  category: string;
  allocated_amount: number;
  description?: string;
}

export default function BudgetUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<BudgetRow[]>([]);
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
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Map to budget rows
      const budgetRows: BudgetRow[] = jsonData.map((row: any) => ({
        category: row.Category || row.category || '',
        allocated_amount: parseFloat(row['Allocated Amount'] || row.allocated_amount || 0),
        description: row.Description || row.description || '',
      }));

      setPreview(budgetRows.filter(row => row.category && row.allocated_amount > 0));
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

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert budget items
      const budgetItems = preview.map(item => ({
        category: item.category,
        allocated_amount: item.allocated_amount,
        description: item.description || null,
        fiscal_year: fiscalYear,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from('budget_items')
        .upsert(budgetItems, {
          onConflict: 'category,fiscal_year',
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
            Upload a CSV or Excel file with columns: Category, Allocated Amount, Description (optional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fiscal-year">Fiscal Year</Label>
            <Input
              id="fiscal-year"
              type="number"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(parseInt(e.target.value))}
              min={2000}
              max={2100}
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
                        <th className="text-right p-3 font-medium">Allocated Amount</th>
                        <th className="text-left p-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, index) => (
                        <tr key={index} className="border-t hover:bg-muted/50">
                          <td className="p-3">{row.category}</td>
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(row.allocated_amount)}
                          </td>
                          <td className="p-3 text-muted-foreground">{row.description || '-'}</td>
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
