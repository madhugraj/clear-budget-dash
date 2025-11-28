import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Loader2, CalendarIcon, Eye, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function ExportExpenses() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [viewData, setViewData] = useState<any[]>([]);
  const [showView, setShowView] = useState(false);
  const { toast } = useToast();

  const fetchExpenseData = async () => {
    // Build query
    let query = supabase
      .from('expenses')
      .select(`
        id,
        description,
        amount,
        gst_amount,
        tds_amount,
        status,
        expense_date,
        budget_master!expenses_budget_master_id_fkey (
          item_name,
          category,
          committee
        ),
        profiles!expenses_claimed_by_fkey (full_name, email),
        approver:profiles!expenses_approved_by_fkey (full_name)
      `)
      .order('expense_date', { ascending: false });

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('expense_date', format(dateFrom, 'yyyy-MM-dd'));
    }

    if (dateTo) {
      query = query.lte('expense_date', format(dateTo, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error('No expenses match the selected filters');
    }

    return data;
  };

  const handleView = async () => {
    setLoading(true);
    try {
      const data = await fetchExpenseData();

      // Transform data for view
      const transformedData = data.map((expense: any) => ({
        date: format(new Date(expense.expense_date), 'dd/MM/yyyy'),
        description: expense.description,
        category: expense.budget_master?.category || 'N/A',
        committee: expense.budget_master?.committee || 'N/A',
        item_name: expense.budget_master?.item_name || 'N/A',
        base_amount: Number(expense.amount),
        gst_amount: Number(expense.gst_amount || 0),
        tds_amount: Number(expense.tds_amount || 0),
        gross_amount: Number(expense.amount) + Number(expense.gst_amount || 0),
        net_payment: Number(expense.amount) + Number(expense.gst_amount || 0) - Number(expense.tds_amount || 0),
        status: expense.status,
        claimed_by: expense.profiles?.full_name || expense.profiles?.email || 'N/A',
        approved_by: expense.approver?.full_name || 'Pending',
      }));

      setViewData(transformedData);
      setShowView(true);

      toast({
        title: 'Report loaded',
        description: `Showing ${transformedData.length} expenses`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to load report',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setLoading(true);
    try {
      const data = await fetchExpenseData();

      const doc = new jsPDF('landscape');

      doc.setFontSize(16);
      doc.text('Expense Report', 14, 15);

      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

      if (status !== 'all') {
        doc.text(`Status: ${status}`, 14, 27);
      }
      if (dateFrom || dateTo) {
        doc.text(
          `Period: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End'}`,
          14,
          32
        );
      }

      const tableData = data.map((expense: any) => [
        format(new Date(expense.expense_date), 'dd/MM/yyyy'),
        expense.budget_master?.item_name || 'N/A',
        expense.description,
        `₹${Number(expense.amount).toLocaleString('en-IN')}`,
        `₹${Number(expense.gst_amount || 0).toLocaleString('en-IN')}`,
        `₹${Number(expense.tds_amount || 0).toLocaleString('en-IN')}`,
        `₹${(Number(expense.amount) + Number(expense.gst_amount || 0) - Number(expense.tds_amount || 0)).toLocaleString('en-IN')}`,
        expense.status,
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['Date', 'Item', 'Description', 'Base', 'GST', 'TDS', 'Net Payment', 'Status']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`expense_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast({
        title: 'PDF exported',
        description: `${data.length} expenses exported to PDF`,
      });
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (exportFormat: 'excel' | 'csv') => {
    setLoading(true);
    try {
      const data = await fetchExpenseData();

      // Transform data for export
      // Transform data for export with proper headers
      const exportData = data.map((expense: any) => ({
        'Date': format(new Date(expense.expense_date), 'dd/MM/yyyy'),
        'Description': expense.description,
        'Category': expense.budget_master?.category || 'N/A',
        'Committee': expense.budget_master?.committee || 'N/A',
        'Budget Item': expense.budget_master?.item_name || 'N/A',
        'Amount (₹)': Number(expense.amount),
        'Status': expense.status,
        'Claimed By': expense.profiles?.full_name || expense.profiles?.email || 'N/A',
        'Approved By': expense.approver?.full_name || 'N/A',
      }));

      // Export based on format
      if (exportFormat === 'excel') {
        exportToExcel(exportData, 'expense_report');
      } else {
        exportToCSV(exportData, 'expense_report');
      }

      toast({
        title: 'Export successful',
        description: `${data.length} expenses exported as ${exportFormat.toUpperCase()}`,
      });
    } catch (error: any) {
      toast({
        title: 'Export failed',
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <CardTitle>Export Expenses</CardTitle>
          </div>
          <CardDescription>
            Download expense reports in Excel or CSV format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status Filter</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dateFrom && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dateTo && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleView}
              disabled={loading}
              variant="secondary"
              className="flex-1 min-w-[200px]"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              View Report
            </Button>
            <Button
              onClick={handleExportPDF}
              disabled={loading}
              variant="outline"
              className="flex-1 min-w-[200px]"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Export to PDF
            </Button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => handleExport('excel')}
              disabled={loading}
              className="flex-1 min-w-[200px]"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export to Excel
            </Button>
            <Button
              onClick={() => handleExport('csv')}
              disabled={loading}
              variant="outline"
              className="flex-1 min-w-[200px]"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Export to CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {showView && viewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expense Report ({viewData.length} entries)</CardTitle>
            <CardDescription>
              Filtered results based on your criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead className="text-right">Net Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Claimed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                        <TableCell className="font-medium">{row.item_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.base_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.gst_amount)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.gross_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.tds_amount)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(row.net_payment)}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                            row.status === 'approved' && "bg-green-100 text-green-700",
                            row.status === 'pending' && "bg-yellow-100 text-yellow-700",
                            row.status === 'rejected' && "bg-red-100 text-red-700"
                          )}>
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell>{row.claimed_by}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Base</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(viewData.reduce((sum, row) => sum + row.base_amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total GST</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(viewData.reduce((sum, row) => sum + row.gst_amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total TDS</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(viewData.reduce((sum, row) => sum + row.tds_amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Net Payment</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(viewData.reduce((sum, row) => sum + row.net_payment, 0))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
