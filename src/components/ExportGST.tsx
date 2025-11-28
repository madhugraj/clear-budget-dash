import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';

export function ExportGST() {
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();
    const [viewData, setViewData] = useState<any[]>([]);
    const [showView, setShowView] = useState(false);
    const { toast } = useToast();

    // Fetch combined GST data
    const fetchGSTData = async () => {
        // Expense GST
        let expenseQuery = supabase
            .from('expenses')
            .select('id, gst_amount, created_at, expense_date, budget_master!expenses_budget_master_id_fkey (category, item_name)')
            .eq('status', 'approved');
        // Income GST
        let incomeQuery = supabase
            .from('income_actuals')
            .select('id, gst_amount, created_at, income_categories!income_actuals_category_id_fkey (category_name, subcategory_name)')
            .eq('status', 'approved');

        if (dateFrom) {
            const fromStr = format(dateFrom, 'yyyy-MM-dd') + 'T00:00:00';
            expenseQuery = expenseQuery.gte('created_at', fromStr);
            incomeQuery = incomeQuery.gte('created_at', fromStr);
        }
        if (dateTo) {
            const toStr = format(dateTo, 'yyyy-MM-dd') + 'T23:59:59';
            expenseQuery = expenseQuery.lte('created_at', toStr);
            incomeQuery = incomeQuery.lte('created_at', toStr);
        }

        const [{ data: expenseData, error: expenseError }, { data: incomeData, error: incomeError }] = await Promise.all([
            expenseQuery,
            incomeQuery,
        ]);
        if (expenseError) throw expenseError;
        if (incomeError) throw incomeError;

        const expenseRows = (expenseData || []).map((e: any) => ({
            type: 'Expense',
            category: e.budget_master?.category || 'N/A',
            item: e.budget_master?.item_name || 'N/A',
            gst: Number(e.gst_amount) || 0,
            date: format(new Date(e.created_at), 'dd/MM/yyyy'),
        }));
        const incomeRows = (incomeData || []).map((i: any) => ({
            type: 'Income',
            category: i.income_categories?.category_name || 'N/A',
            item: i.income_categories?.subcategory_name || '-',
            gst: Number(i.gst_amount) || 0,
            date: format(new Date(i.created_at), 'dd/MM/yyyy'),
        }));
        return [...expenseRows, ...incomeRows];
    };

    const handleView = async () => {
        setLoading(true);
        try {
            const data = await fetchGSTData();
            setViewData(data);
            setShowView(true);
            toast({ title: 'GST report loaded', description: `Showing ${data.length} records` });
        } catch (error: any) {
            toast({ title: 'Failed to load GST report', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchGSTData();
            const doc = new jsPDF('landscape');
            doc.setFontSize(16);
            doc.text('Combined GST Report', 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);
            if (dateFrom || dateTo) {
                doc.text(
                    `Period: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End'}`,
                    14,
                    32,
                );
            }
            const tableData = data.map((row) => [row.date, row.type, row.category, row.item, `₹${row.gst.toLocaleString('en-IN')}`]);
            autoTable(doc, {
                startY: 38,
                head: [['Date', 'Type', 'Category', 'Item/Subcategory', 'GST']],
                body: tableData,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [16, 185, 129] },
            });
            doc.save(`gst_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'PDF exported', description: `${data.length} records exported` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (formatType: 'excel' | 'csv') => {
        setLoading(true);
        try {
            const data = await fetchGSTData();
            const exportData = data.map((row) => ({
                Date: row.date,
                Type: row.type,
                Category: row.category,
                Item: row.item,
                GST: row.gst,
            }));
            if (formatType === 'excel') {
                exportToExcel(exportData, 'gst_report');
            } else {
                exportToCSV(exportData, 'gst_report');
            }
            toast({ title: 'Export successful', description: `${data.length} records exported as ${formatType.toUpperCase()}` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileDown className="h-5 w-5 text-primary" />
                        <CardTitle>Export GST (Income + Expense)</CardTitle>
                    </div>
                    <CardDescription>Download combined GST report for income and expenses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Date From</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFrom ? format(dateFrom, 'PPP') : 'Select date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Date To</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateTo ? format(dateTo, 'PPP') : 'Select date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <Button onClick={handleView} disabled={loading} variant="secondary" className="flex-1 min-w-[200px]">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                            View Report
                        </Button>
                        <Button onClick={handleExportPDF} disabled={loading} variant="outline" className="flex-1 min-w-[200px]">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                            Export to PDF
                        </Button>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <Button onClick={() => handleExport('excel')} disabled={loading} className="flex-1 min-w-[200px]">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                            Export to Excel
                        </Button>
                        <Button onClick={() => handleExport('csv')} disabled={loading} variant="outline" className="flex-1 min-w-[200px]">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                            Export to CSV
                        </Button>
                    </div>
                    {showView && viewData.length > 0 && (
                        <Card className="mt-6">
                            <CardHeader>
                                <CardTitle>GST Report ({viewData.length} entries)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="max-h-[600px] overflow-y-auto">
                                        <table className="w-full">
                                            <thead className="bg-muted">
                                                <tr>
                                                    <th className="p-2 text-left">Date</th>
                                                    <th className="p-2 text-left">Type</th>
                                                    <th className="p-2 text-left">Category</th>
                                                    <th className="p-2 text-left">Item/Subcategory</th>
                                                    <th className="p-2 text-right">GST</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewData.map((row, idx) => (
                                                    <tr key={idx} className="border-t">
                                                        <td className="p-2 whitespace-nowrap">{row.date}</td>
                                                        <td className="p-2">{row.type}</td>
                                                        <td className="p-2">{row.category}</td>
                                                        <td className="p-2">{row.item}</td>
                                                        <td className="p-2 text-right">₹{row.gst.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
