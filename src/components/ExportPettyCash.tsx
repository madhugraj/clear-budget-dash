import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, FileSpreadsheet, FileText, FileDown, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';

interface PettyCashRow {
    id: string;
    item_name: string;
    description: string;
    amount: number;
    date: string;
    status: string;
    submitted_by: string;
    submitter_name: string;
}

export function ExportPettyCash() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();
    const [viewData, setViewData] = useState<PettyCashRow[]>([]);
    const [showView, setShowView] = useState(false);
    const { toast } = useToast();

    const fetchPettyCashData = async (): Promise<PettyCashRow[]> => {
        let query = supabase
            .from('petty_cash')
            .select('*, profiles!petty_cash_submitted_by_fkey (full_name)')
            .order('date', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        if (dateFrom) {
            query = query.gte('date', format(dateFrom, 'yyyy-MM-dd'));
        }
        if (dateTo) {
            query = query.lte('date', format(dateTo, 'yyyy-MM-dd'));
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((item: any) => ({
            id: item.id,
            item_name: item.item_name,
            description: item.description,
            amount: Number(item.amount),
            date: format(new Date(item.date), 'dd/MM/yyyy'),
            status: item.status,
            submitted_by: item.submitted_by,
            submitter_name: item.profiles?.full_name || 'Unknown',
        }));
    };

    const handleView = async () => {
        setLoading(true);
        try {
            const data = await fetchPettyCashData();
            setViewData(data);
            setShowView(true);
            toast({ title: 'Petty Cash report loaded', description: `Showing ${data.length} records` });
        } catch (error: any) {
            toast({ title: 'Failed to load report', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchPettyCashData();
            const doc = new jsPDF('landscape');
            doc.setFontSize(16);
            doc.text('Petty Cash Report', 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);
            if (dateFrom || dateTo) {
                doc.text(
                    `Period: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End'}`,
                    14,
                    29,
                );
            }
            const tableData = data.map((row) => [
                row.date,
                row.item_name,
                row.description,
                row.submitter_name,
                row.status,
                `₹${row.amount.toLocaleString('en-IN')}`,
            ]);
            autoTable(doc, {
                startY: 35,
                head: [['Date', 'Item', 'Description', 'Submitted By', 'Status', 'Amount']],
                body: tableData,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [16, 185, 129] },
            });
            doc.save(`petty_cash_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'PDF exported', description: `${data.length} records exported` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportSummaryPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchPettyCashData();

            const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);
            const approvedAmount = data.filter(d => d.status === 'approved').reduce((sum, d) => sum + d.amount, 0);
            const pendingAmount = data.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0);

            const doc = new jsPDF('portrait');

            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129);
            doc.text('Petty Cash Summary Report', 14, 20);
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
            if (dateFrom || dateTo) {
                doc.text(
                    `Period: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End'}`,
                    14,
                    35,
                );
            }

            doc.setFontSize(14);
            doc.text('Overview', 14, 48);

            autoTable(doc, {
                startY: 52,
                head: [['Description', 'Amount']],
                body: [
                    ['Total Petty Cash', `₹${totalAmount.toLocaleString('en-IN')}`],
                    ['Approved Amount', `₹${approvedAmount.toLocaleString('en-IN')}`],
                    ['Pending Amount', `₹${pendingAmount.toLocaleString('en-IN')}`],
                ],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [16, 185, 129] },
                columnStyles: { 0: { fontStyle: 'bold' } },
            });

            doc.save(`petty_cash_summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'Summary PDF exported', description: 'Dashboard-style summary exported' });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (formatType: 'excel' | 'csv') => {
        setLoading(true);
        try {
            const data = await fetchPettyCashData();
            const exportData = data.map((row) => ({
                Date: row.date,
                Item: row.item_name,
                Description: row.description,
                'Submitted By': row.submitter_name,
                Status: row.status,
                Amount: row.amount,
            }));
            if (formatType === 'excel') {
                exportToExcel(exportData, 'petty_cash_report');
            } else {
                exportToCSV(exportData, 'petty_cash_report');
            }
            toast({ title: 'Export successful', description: `${data.length} records exported as ${formatType.toUpperCase()}` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const totalAmount = viewData.reduce((sum, d) => sum + d.amount, 0);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <FileDown className="h-5 w-5 text-primary" />
                    <CardTitle>Export Petty Cash</CardTitle>
                </div>
                <CardDescription>Download petty cash reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
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
                    <div className="space-y-2">
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
                        Export to PDF (Detailed)
                    </Button>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <Button onClick={handleExportSummaryPDF} disabled={loading} variant="default" className="flex-1 min-w-[200px]">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                        Export Summary PDF
                    </Button>
                    <Button onClick={() => handleExport('excel')} disabled={loading} variant="outline" className="flex-1 min-w-[200px]">
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
                            <CardTitle>Petty Cash Report ({viewData.length} entries)</CardTitle>
                            <CardDescription className="mt-2">
                                <span className="text-primary font-bold text-lg">
                                    Total Amount: ₹{totalAmount.toLocaleString('en-IN')}
                                </span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                                <div className="max-h-[600px] overflow-y-auto">
                                    <table className="w-full">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="p-2 text-left">Date</th>
                                                <th className="p-2 text-left">Item</th>
                                                <th className="p-2 text-left">Description</th>
                                                <th className="p-2 text-left">Submitted By</th>
                                                <th className="p-2 text-left">Status</th>
                                                <th className="p-2 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewData.map((row) => (
                                                <tr key={row.id} className="border-t">
                                                    <td className="p-2 whitespace-nowrap">{row.date}</td>
                                                    <td className="p-2">{row.item_name}</td>
                                                    <td className="p-2">{row.description}</td>
                                                    <td className="p-2">{row.submitter_name}</td>
                                                    <td className="p-2">
                                                        <span className={cn(
                                                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize",
                                                            row.status === 'approved' && "bg-green-100 text-green-700",
                                                            row.status === 'pending' && "bg-yellow-100 text-yellow-700",
                                                            row.status === 'rejected' && "bg-red-100 text-red-700"
                                                        )}>
                                                            {row.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-right font-medium">₹{row.amount.toLocaleString('en-IN')}</td>
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
    );
}
