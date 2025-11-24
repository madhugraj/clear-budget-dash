import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Upload, FileText, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
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

interface ExpenseEntry {
  id: string;
  budget_master_id: string;
  budget_item_name: string;
  amount: string;
  gst_percentage: number;
  gst_amount: number;
  tds_percentage: number;
  tds_amount: number;
  gross_amount: number;
  net_payment: number;
  description: string;
  expense_date: string;
  invoice: File | null;
  isEditing?: boolean;
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
  
  // Multiple expense entries
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  
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

  const handleAddExpense = () => {
    if (!selectedBudgetItem) {
      toast({
        title: 'Missing budget item',
        description: 'Please select a budget item.',
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

    if (!description.trim()) {
      toast({
        title: 'Missing description',
        description: 'Please provide a description.',
        variant: 'destructive',
      });
      return;
    }

    const budgetItem = budgetItems.find(item => item.id === selectedBudgetItem);
    if (!budgetItem) return;

    const newEntry: ExpenseEntry = {
      id: Date.now().toString(),
      budget_master_id: selectedBudgetItem,
      budget_item_name: budgetItem.item_name,
      amount: amount,
      gst_percentage: gstPercentage,
      gst_amount: gstAmount,
      tds_percentage: tdsPercentage,
      tds_amount: tdsAmount,
      gross_amount: grossAmount,
      net_payment: netPayment,
      description,
      expense_date: expenseDate,
      invoice,
      isEditing: false,
    };

    setExpenseEntries([...expenseEntries, newEntry]);

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
    const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';

    toast({
      title: 'Expense added',
      description: 'Add more expenses or submit all for approval.',
    });
  };

  const handleRemoveExpense = (id: string) => {
    setExpenseEntries(expenseEntries.filter(entry => entry.id !== id));
  };

  const handleEditExpense = (id: string, field: string, value: any) => {
    setExpenseEntries(expenseEntries.map(entry => {
      if (entry.id !== id) return entry;
      
      const updated = { ...entry, [field]: value };
      
      // Recalculate GST and TDS if amount or percentages change
      if (field === 'amount' || field === 'gst_percentage' || field === 'tds_percentage') {
        const baseAmount = parseFloat(updated.amount) || 0;
        updated.gst_amount = (baseAmount * updated.gst_percentage) / 100;
        updated.tds_amount = (baseAmount * updated.tds_percentage) / 100;
        updated.gross_amount = baseAmount + updated.gst_amount;
        updated.net_payment = updated.gross_amount - updated.tds_amount;
      }
      
      return updated;
    }));
  };

  const handleSubmitAll = () => {
    if (expenseEntries.length === 0) {
      toast({
        title: 'No expenses to submit',
        description: 'Please add at least one expense before submitting.',
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

      for (const entry of expenseEntries) {
        let invoiceUrl = null;

        // Upload invoice if provided
        if (entry.invoice) {
          const fileExt = entry.invoice.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(fileName, entry.invoice);

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
            budget_master_id: entry.budget_master_id,
            amount: parseFloat(entry.amount),
            gst_amount: entry.gst_amount,
            tds_percentage: entry.tds_percentage,
            tds_amount: entry.tds_amount,
            description: entry.description,
            expense_date: entry.expense_date,
            invoice_url: invoiceUrl,
            claimed_by: user.id,
            status: 'pending',
          })
          .select();

        if (error) throw error;

        // Send email notification in the background (fire and forget)
        if (data?.[0]?.id) {
          supabase.functions.invoke('send-expense-notification', {
            body: { expenseId: data[0].id, action: 'submitted' }
          }).catch(err => console.error('Email notification failed:', err));
        }
      }

      toast({
        title: 'Submitted for approval',
        description: `${expenseEntries.length} expense(s) submitted to treasurer for approval.`,
      });

      // Reset
      setExpenseEntries([]);
      setPreviewOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error submitting expenses',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
      
      let sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('summary') && 
        name.toLowerCase().includes('whole year')
      ) || workbook.SheetNames[0];
      
      const worksheet = workbook.Sheets[sheetName];
      const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
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
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        range: headerRowIndex + 1,
        defval: '' 
      });

      const cleanCurrency = (value: any): number => {
        if (!value) return 0;
        const str = String(value).replace(/[₹,\s]/g, '');
        return parseFloat(str) || 0;
      };

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
        const budgetItem = budgetMasterItems?.find(
          item => item.serial_no === row.serial_no || 
                  item.item_name.toLowerCase() === row.item_name.toLowerCase()
        );

        if (!budgetItem) {
          console.warn(`No budget item found for: ${row.item_name}`);
          continue;
        }

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

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Add Expense</h1>
        <p className="text-muted-foreground mt-2">
          Add expense items and submit all for approval
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
                          <th className="text-left p-2">Select</th>
                          <th className="text-left p-2">Item</th>
                          <th className="text-right p-2">Apr</th>
                          <th className="text-right p-2">May</th>
                          <th className="text-right p-2">Jun</th>
                          <th className="text-right p-2">Jul</th>
                          <th className="text-right p-2">Aug</th>
                          <th className="text-right p-2">Sep</th>
                          <th className="text-right p-2">Oct</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalPreview.map((row, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={selectedHistoricalItems.has(index)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedHistoricalItems);
                                  if (e.target.checked) {
                                    newSet.add(index);
                                  } else {
                                    newSet.delete(index);
                                  }
                                  setSelectedHistoricalItems(newSet);
                                }}
                              />
                            </td>
                            <td className="p-2">{row.item_name}</td>
                            <td className="p-2 text-right">{row.april > 0 ? formatCurrency(row.april) : '-'}</td>
                            <td className="p-2 text-right">{row.may > 0 ? formatCurrency(row.may) : '-'}</td>
                            <td className="p-2 text-right">{row.june > 0 ? formatCurrency(row.june) : '-'}</td>
                            <td className="p-2 text-right">{row.july > 0 ? formatCurrency(row.july) : '-'}</td>
                            <td className="p-2 text-right">{row.august > 0 ? formatCurrency(row.august) : '-'}</td>
                            <td className="p-2 text-right">{row.september > 0 ? formatCurrency(row.september) : '-'}</td>
                            <td className="p-2 text-right">{row.october > 0 ? formatCurrency(row.october) : '-'}</td>
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expense Entry</CardTitle>
          <CardDescription>
            Fill in the details and add to the list below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="budget-item">Budget Item *</Label>
              <Select value={selectedBudgetItem} onValueChange={setSelectedBudgetItem}>
                <SelectTrigger id="budget-item">
                  <SelectValue placeholder="Select budget item" />
                </SelectTrigger>
                <SelectContent>
                  {budgetItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.item_name} - {item.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-date">Date *</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Base Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gst-percentage">GST %</Label>
              <Select
                value={gstPercentage.toString()}
                onValueChange={(value) => setGstPercentage(parseFloat(value))}
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
              <p className="text-sm text-muted-foreground">
                GST Amount: {formatCurrency(gstAmount)}
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
              <p className="text-sm text-muted-foreground">
                TDS Amount: {formatCurrency(tdsAmount)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Net Payment</Label>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(netPayment)}
              </div>
              <p className="text-xs text-muted-foreground">
                Gross: {formatCurrency(grossAmount)} - TDS: {formatCurrency(tdsAmount)}
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the expense..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="invoice-upload">Invoice (Optional)</Label>
              <Input
                id="invoice-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleInvoiceChange}
                className="cursor-pointer"
              />
              {invoice && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {invoice.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t mt-6">
            <Button onClick={handleAddExpense} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Add to List
            </Button>
          </div>
        </CardContent>
      </Card>

      {expenseEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expenses to Submit ({expenseEntries.length})</CardTitle>
            <CardDescription>
              Review and submit all expenses for approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Budget Item</TableHead>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[120px]">Base</TableHead>
                    <TableHead className="w-[100px]">GST %</TableHead>
                    <TableHead className="w-[100px]">TDS %</TableHead>
                    <TableHead className="text-right">Net Payment</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium text-sm">{entry.budget_item_name}</TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={entry.expense_date}
                          onChange={(e) => handleEditExpense(entry.id, 'expense_date', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={entry.amount}
                          onChange={(e) => handleEditExpense(entry.id, 'amount', e.target.value)}
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={entry.gst_percentage.toString()}
                          onValueChange={(value) => handleEditExpense(entry.id, 'gst_percentage', parseFloat(value))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={entry.tds_percentage.toString()}
                          onValueChange={(value) => handleEditExpense(entry.id, 'tds_percentage', parseFloat(value))}
                        >
                          <SelectTrigger className="h-8 text-xs">
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
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">{formatCurrency(entry.net_payment)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExpense(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-6 border-t mt-6">
              <Button onClick={handleSubmitAll} size="lg" className="min-w-[200px]">
                Submit All for Approval
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Expenses Before Submitting</DialogTitle>
            <DialogDescription>
              Please verify all calculated amounts before sending to the treasurer for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Net Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.budget_item_name}</TableCell>
                    <TableCell>{new Date(entry.expense_date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(entry.amount) || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.gst_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.gross_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.tds_amount)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(entry.net_payment)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Base Amount</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(expenseEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total GST</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(expenseEntries.reduce((sum, e) => sum + e.gst_amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Gross</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(expenseEntries.reduce((sum, e) => sum + e.gross_amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total TDS</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(expenseEntries.reduce((sum, e) => sum + e.tds_amount, 0))}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Total Net Payment</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(expenseEntries.reduce((sum, e) => sum + e.net_payment, 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 flex justify-end gap-2">
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
    </div>
  );
}
