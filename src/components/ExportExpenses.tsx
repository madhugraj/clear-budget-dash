import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Loader2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { cn } from '@/lib/utils';

export function ExportExpenses() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const { toast } = useToast();

  const handleExport = async (exportFormat: 'excel' | 'csv') => {
    setLoading(true);
    try {
      // Build query
      let query = supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
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
        toast({
          title: 'No data to export',
          description: 'No expenses match the selected filters',
          variant: 'destructive',
        });
        return;
      }

      // Transform data for export
      const exportData = data.map((expense: any) => ({
        date: format(new Date(expense.expense_date), 'dd/MM/yyyy'),
        description: expense.description,
        category: expense.budget_master?.category || 'N/A',
        committee: expense.budget_master?.committee || 'N/A',
        item_name: expense.budget_master?.item_name || 'N/A',
        amount: Number(expense.amount),
        status: expense.status,
        claimed_by: expense.profiles?.full_name || expense.profiles?.email || 'N/A',
        approved_by: expense.approver?.full_name || undefined,
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

  return (
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

        <div className="flex gap-3">
          <Button
            onClick={() => handleExport('excel')}
            disabled={loading}
            className="flex-1"
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
            className="flex-1"
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
  );
}
