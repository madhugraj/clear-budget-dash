import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Upload, FileText, FileSpreadsheet } from 'lucide-react';
import { ExpensesList } from '@/components/ExpensesList';
import * as XLSX from 'xlsx';

interface BudgetItem {
  id: string;
  item_name: string;
  category: string;
  committee: string;
  annual_budget: number;
  fiscal_year: string;
  serial_no: number;
}

interface HistoricalExpenseRow {
  serial_no: number;
  item_name: string;
  category: string;
  committee: string;
  april: number;
  may: number;
  june: number;
  july: number;
  august: number;
  september: number;
  october: number;
}

export default function Expenses() {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [selectedBudgetItem, setSelectedBudgetItem] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [gstPercentage, setGstPercentage] = useState<number>(18);
  const [gstAmount, setGstAmount] = useState<number>(0);
  const [tdsPercentage, setTdsPercentage] = useState<number>(0);
  const [tdsAmount, setTdsAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Historical upload states
  const [historicalFile, setHistoricalFile] = useState<File | null>(null);
  const [historicalPreview, setHistoricalPreview] = useState<HistoricalExpenseRow[]>([]);
  const [selectedHistoricalItems, setSelectedHistoricalItems] = useState<Set<number>>(new Set());
  const [historicalLoading, setHistoricalLoading] = useState(false);
  
  const { toast } = useToast();
  const { userRole } = useAuth();

  const grossAmount = (parseFloat(amount) || 0) + gstAmount;
  const netPayment = grossAmount - tdsAmount;

  useEffect(() => {
    loadBudgetItems();
  }, []);

  // Auto-calculate GST when amount or percentage changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const baseAmount = parseFloat(amount);
      const gst = (baseAmount * gstPercentage) / 100;
      setGstAmount(Math.round(gst * 100) / 100);
    }
  }, [amount, gstPercentage]);

  // Auto-calculate TDS when amount or percentage changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const baseAmount = parseFloat(amount);
      const tds = (baseAmount * tdsPercentage) / 100;
      setTdsAmount(Math.round(tds * 100) / 100);
    }
  }, [amount, tdsPercentage]);

  const loadBudgetItems = async () => {
    try {
      const { data, error } = await supabase
        .from('budget_master')
        .select('*')
        .eq('fiscal_year', 'FY25-26')
        .order('category, item_name');

      if (error) throw error;
      setBudgetItems(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading budget items',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInvoice(file);
    }
  };

  const handleHistoricalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setHistoricalFile(selectedFile);
      parseHistoricalFile(selectedFile);
    }
  };

  const parseHistoricalFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Look for "Summary-FOR WHOLE YEAR" sheet
      let sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('summary') && 
        name.toLowerCase().includes('whole year')
      ) || workbook.SheetNames[0];
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Get all data to find header row
      const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      // Find the header row
      let headerRowIndex = -1;
      for (let i = 0; i < allData.length; i++) {
        const row = allData[i] as any[];
        if (row[0] === 'SL.NO' || row[1] === 'ITEM') {
          headerRowIndex = i;
          break;
        }
      }
      
      if (headerRowIndex === -1) {
        throw new Error('Could not find header row');
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

      // Map to historical expense rows (columns 8-14 are monthly data)
      const expenseRows: HistoricalExpenseRow[] = jsonData
        .map((row: any) => {
          const serialNo = parseInt(String(row['SL.NO'] || row['1'] || '0'));
          const itemName = String(row['ITEM'] || row['2'] || '').trim();
          
          if (!serialNo || serialNo === 0 || !itemName) return null;
          if (itemName.toLowerCase().includes('total') || 
              itemName.toLowerCase().includes('per annum')) return null;
          
          return {
            serial_no: serialNo,
            item_name: itemName,
            category: String(row['CATEGORY'] || row['3'] || '').trim(),
            committee: String(row['COMMITTEE'] || row['4'] || '').trim(),
            april: cleanCurrency(row['Apr-25'] || row['8']),
            may: cleanCurrency(row['May-25'] || row['9']),
            june: cleanCurrency(row['Jun-25'] || row['10']),
            july: cleanCurrency(row['Jul-25'] || row['11']),
            august: cleanCurrency(row['Aug-25'] || row['12']),
            september: cleanCurrency(row['Sep-25'] || row['13']),
            october: cleanCurrency(row['Oct-25'] || row['14']),
          };
        })
        .filter((row): row is HistoricalExpenseRow => row !== null);

      setHistoricalPreview(expenseRows);
      setSelectedHistoricalItems(new Set(expenseRows.map((_, index) => index)));
      
      if (expenseRows.length === 0) {
        toast({
          title: 'No valid data found',
          description: 'No historical expenses found in the file',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'File parsed successfully',
          description: `Found ${expenseRows.length} items with historical expenses`,
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

  const handleHistoricalUpload = async () => {
    if (!historicalFile || historicalPreview.length === 0 || selectedHistoricalItems.size === 0) {
      toast({
        title: 'No data to upload',
        description: 'Please select items to upload',
        variant: 'destructive',
      });
      return;
    }

    setHistoricalLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const selectedPreview = historicalPreview.filter((_, index) => selectedHistoricalItems.has(index));
      
      // Get all budget master items for matching
      const { data: budgetMasterItems, error: fetchError } = await supabase
        .from('budget_master')
        .select('*')
        .eq('fiscal_year', 'FY25-26');

      if (fetchError) throw fetchError;

      const months = [
        { name: 'april', date: '2025-04-15', key: 'april' as const },
        { name: 'may', date: '2025-05-15', key: 'may' as const },
        { name: 'june', date: '2025-06-15', key: 'june' as const },
        { name: 'july', date: '2025-07-15', key: 'july' as const },
        { name: 'august', date: '2025-08-15', key: 'august' as const },
        { name: 'september', date: '2025-09-15', key: 'september' as const },
        { name: 'october', date: '2025-10-15', key: 'october' as const },
      ];

      let insertedCount = 0;

      for (const row of selectedPreview) {
        // Find matching budget master item
        const budgetItem = budgetMasterItems?.find(
          item => item.serial_no === row.serial_no || 
                  item.item_name.toLowerCase() === row.item_name.toLowerCase()
        );

        if (!budgetItem) {
          console.warn(`No budget item found for: ${row.item_name}`);
          continue;
        }

        // Create expenses for each month with non-zero amount
        for (const month of months) {
          const amount = row[month.key];
          if (amount > 0) {
            const { error: insertError } = await supabase
              .from('expenses')
              .insert({
                budget_master_id: budgetItem.id,
                amount: amount,
                description: `Historical expense for ${row.item_name} - ${month.name} 2025`,
                expense_date: month.date,
                claimed_by: user.id,
                approved_by: user.id,
                status: 'approved',
              });

            if (insertError) {
              console.error(`Error inserting ${month.name} expense:`, insertError);
            } else {
              insertedCount++;
            }
          }
        }
      }

      toast({
        title: 'Success!',
        description: `Uploaded ${insertedCount} historical expense entries`,
      });

      // Reset form
      setHistoricalFile(null);
      setHistoricalPreview([]);
      setSelectedHistoricalItems(new Set());
      const fileInput = document.getElementById('historical-file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      toast({
        title: 'Error uploading expenses',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setHistoricalLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBudgetItem) {
      toast({
        title: 'Missing budget item',
        description: 'Please select a budget item before submitting.',
        variant: 'destructive',
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Base amount must be greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    setPreviewOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let invoiceUrl = null;

      // Upload invoice if provided
      if (invoice) {
        const fileExt = invoice.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(fileName, invoice);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('invoices')
          .getPublicUrl(fileName);

        invoiceUrl = publicUrl;
      }

      // Insert expense
      const { error, data } = await supabase
        .from('expenses')
        .insert({
          budget_master_id: selectedBudgetItem,
          amount: parseFloat(amount),
          gst_amount: gstAmount,
          tds_percentage: tdsPercentage,
          tds_amount: tdsAmount,
          description,
          expense_date: expenseDate,
          invoice_url: invoiceUrl,
          claimed_by: user.id,
          status: 'pending',
        })
        .select();

      if (error) throw error;

      // Send email notification in the background
      supabase.functions.invoke('send-expense-notification', {
        body: { expenseId: data?.[0]?.id, action: 'submitted' }
      }).then(() => console.log('Email notification sent')).catch(err => console.error('Email failed:', err));

      toast({
        title: 'Submitted for approval',
        description: 'Review completed and expense claim submitted to treasurer.',
      });

      // Reset form
      setSelectedBudgetItem('');
      setAmount('');
      setGstPercentage(18);
      setGstAmount(0);
      setTdsPercentage(0);
      setTdsAmount(0);
      setDescription('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setInvoice(null);
      setPreviewOpen(false);
      const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      toast({
        title: 'Error submitting expense',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Add Expense</h1>
        <p className="text-muted-foreground mt-2">
          Submit a new expense claim for approval
        </p>
      </div>

      {userRole === 'treasurer' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Historical Expenses</CardTitle>
            <CardDescription>
              Upload the Excel file with historical expenses from April to October 2025
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="historical-file-upload">Excel File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="historical-file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleHistoricalFileChange}
                className="cursor-pointer"
              />
              <Button
                onClick={handleHistoricalUpload}
                disabled={!historicalFile || historicalLoading}
                className="min-w-[120px]"
              >
                {historicalLoading ? (
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

          {historicalPreview.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Preview: {historicalPreview.length} items ({selectedHistoricalItems.size} selected)</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedHistoricalItems(new Set(historicalPreview.map((_, i) => i)))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedHistoricalItems(new Set())}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium w-8">
                          <input
                            type="checkbox"
                            checked={selectedHistoricalItems.size === historicalPreview.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedHistoricalItems(new Set(historicalPreview.map((_, i) => i)));
                              } else {
                                setSelectedHistoricalItems(new Set());
                              }
                            }}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="text-left p-2 font-medium">S.No</th>
                        <th className="text-left p-2 font-medium">Item</th>
                        <th className="text-right p-2 font-medium">Apr</th>
                        <th className="text-right p-2 font-medium">May</th>
                        <th className="text-right p-2 font-medium">Jun</th>
                        <th className="text-right p-2 font-medium">Jul</th>
                        <th className="text-right p-2 font-medium">Aug</th>
                        <th className="text-right p-2 font-medium">Sep</th>
                        <th className="text-right p-2 font-medium">Oct</th>
                        <th className="text-right p-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalPreview.map((row, index) => {
                        const total = row.april + row.may + row.june + row.july + 
                                     row.august + row.september + row.october;
                        return (
                          <tr key={index} className="border-t hover:bg-muted/50">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={selectedHistoricalItems.has(index)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedHistoricalItems);
                                  if (e.target.checked) {
                                    newSelected.add(index);
                                  } else {
                                    newSelected.delete(index);
                                  }
                                  setSelectedHistoricalItems(newSelected);
                                }}
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="p-2">{row.serial_no}</td>
                            <td className="p-2 max-w-xs truncate">{row.item_name}</td>
                            <td className="p-2 text-right">{row.april > 0 ? formatCurrency(row.april) : '-'}</td>
                            <td className="p-2 text-right">{row.may > 0 ? formatCurrency(row.may) : '-'}</td>
                            <td className="p-2 text-right">{row.june > 0 ? formatCurrency(row.june) : '-'}</td>
                            <td className="p-2 text-right">{row.july > 0 ? formatCurrency(row.july) : '-'}</td>
                            <td className="p-2 text-right">{row.august > 0 ? formatCurrency(row.august) : '-'}</td>
                            <td className="p-2 text-right">{row.september > 0 ? formatCurrency(row.september) : '-'}</td>
                            <td className="p-2 text-right">{row.october > 0 ? formatCurrency(row.october) : '-'}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
          <CardDescription>
            Fill in the expense information and upload supporting documents (For expenses after October)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePreview} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="budget-item">Budget Item</Label>
              <Select value={selectedBudgetItem} onValueChange={setSelectedBudgetItem} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a budget item" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {budgetItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{item.item_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.category} • {item.committee} • ₹{item.annual_budget.toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the budget item this expense belongs to
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Base Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    const baseAmount = parseFloat(e.target.value) || 0;
                    setAmount(e.target.value);
                    const calculatedGst = (baseAmount * gstPercentage) / 100;
                    setGstAmount(parseFloat(calculatedGst.toFixed(2)));
                  }}
                  placeholder="10000.00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Base expense amount excluding GST
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst-percentage">GST %</Label>
                <Select
                  value={gstPercentage.toString()}
                  onValueChange={(value) => {
                    const newPercentage = parseFloat(value);
                    setGstPercentage(newPercentage);
                    const baseAmount = parseFloat(amount) || 0;
                    const calculatedGst = (baseAmount * newPercentage) / 100;
                    setGstAmount(parseFloat(calculatedGst.toFixed(2)));
                  }}
                >
                  <SelectTrigger id="gst-percentage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gst-amount">GST Amount (₹)</Label>
                <Input
                  id="gst-amount"
                  type="number"
                  step="0.01"
                  value={gstAmount}
                  onChange={(e) => setGstAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-calculated or enter manually
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tds-percentage">TDS %</Label>
                <Select
                  value={tdsPercentage.toString()}
                  onValueChange={(value) => setTdsPercentage(parseFloat(value))}
                >
                  <SelectTrigger id="tds-percentage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="1">1%</SelectItem>
                    <SelectItem value="2">2%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tds-amount">TDS Amount (₹)</Label>
                <Input
                  id="tds-amount"
                  type="number"
                  step="0.01"
                  value={tdsAmount}
                  onChange={(e) => setTdsAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-calculated on Base Amount
                </p>
              </div>

              <div className="space-y-2">
                <Label>Gross Amount (₹)</Label>
                <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
                  <span className="font-semibold">
                    ₹{grossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Base + GST
                </p>
              </div>
            </div>

            <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Net Payment</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Amount to be paid (Gross - TDS)
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    ₹{netPayment.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-date">Expense Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the expense in detail..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-upload">
                Invoice/Bill <span className="text-xs text-muted-foreground">(Recommended)</span>
              </Label>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <Input
                    id="invoice-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleInvoiceChange}
                    className="cursor-pointer"
                  />
                  {invoice && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <FileText className="h-4 w-4" />
                      <span>{invoice.name}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload supporting documents (PDF, JPG, PNG). Files are stored securely.
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Preview & Submit Expense
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Expense Before Submitting</DialogTitle>
            <DialogDescription>
              Please verify the calculated amounts before sending to the treasurer for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-sm">
            <div>
              <p className="font-medium">Budget Item</p>
              <p className="text-muted-foreground">
                {budgetItems.find(b => b.id === selectedBudgetItem)?.item_name || 'Not selected'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Base Amount</p>
                <p className="font-semibold">{formatCurrency(parseFloat(amount) || 0)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">GST ({gstPercentage}%)</p>
                <p className="font-semibold">{formatCurrency(gstAmount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Gross Amount (Base + GST)</p>
                <p className="font-semibold">{formatCurrency(grossAmount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">TDS ({tdsPercentage}%)</p>
                <p className="font-semibold">{formatCurrency(tdsAmount)}</p>
              </div>
            </div>
            <div className="p-3 rounded-md bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Net Payment (Gross - TDS)</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(netPayment)}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Date: {new Date(expenseDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p>{description}</p>
            </div>
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
              onClick={handleConfirmSubmit}
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

      <Card>
        <CardHeader>
          <CardTitle>Your Expenses</CardTitle>
          <CardDescription>
            View all expenses you've submitted. Request corrections for approved expenses if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExpensesList />
        </CardContent>
      </Card>
    </div>
  );
}
