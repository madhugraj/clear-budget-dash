import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, FileSpreadsheet, FileText, FileDown, BarChart3 } from 'lucide-react';
import { format, getMonth, getYear, parseISO } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';

interface GSTRow {
    type: 'Income' | 'Expense';
    category: string;
    item: string;
    gst: number;
    date: string;
    baseAmount: number;
    totalAmount: number;
}

export function ExportGST() {
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();
    const [viewData, setViewData] = useState<GSTRow[]>([]);
    const [showView, setShowView] = useState(false);
    const { toast } = useToast();

    // Fetch combined GST data with corrected logic
    const fetchGSTData = async (): Promise<GSTRow[]> => {
        // Expense GST - use expense_date for filtering
        let expenseQuery = supabase
            .from('expenses')
            .select('id, amount, gst_amount, expense_date, budget_master!expenses_budget_master_id_fkey (category, item_name)')
            .eq('status', 'approved');

        if (dateFrom) {
            const fromStr = format(dateFrom, 'yyyy-MM-dd');
            expenseQuery = expenseQuery.gte('expense_date', fromStr);
        }
        if (dateTo) {
            const toStr = format(dateTo, 'yyyy-MM-dd');
            expenseQuery = expenseQuery.lte('expense_date', toStr);
        }

        const { data: expenseData, error: expenseError } = await expenseQuery;
        if (expenseError) throw expenseError;

        // Income GST - fetch all and filter by month/fiscal_year
        const { data: incomeData, error: incomeError } = await supabase
            .from('income_actuals')
            .select('id, actual_amount, gst_amount, month, fiscal_year, income_categories!income_actuals_category_id_fkey (category_name, subcategory_name)')
            .eq('status', 'approved');

        if (incomeError) throw incomeError;

        // Filter income by date range using month and fiscal_year
        const filteredIncome = (incomeData || []).filter((i: any) => {
            // Convert month (4=Apr, 5=May, etc.) and fiscal_year to a date
            // FY25-26 means Apr 2025 to Mar 2026
            const fiscalYear = i.fiscal_year;
            const month = i.month;
            
            // Determine calendar year based on fiscal year and month
            let year: number;
            if (fiscalYear === 'FY25-26') {
                year = month >= 4 ? 2025 : 2026;
            } else if (fiscalYear === 'FY24-25') {
                year = month >= 4 ? 2024 : 2025;
            } else {
                // Default fallback
                year = 2025;
            }
            
            // Create date for first day of the month
            const incomeDate = new Date(year, month - 1, 1);
            
            if (dateFrom && incomeDate < dateFrom) return false;
            if (dateTo && incomeDate > dateTo) return false;
            return true;
        });

        const expenseRows: GSTRow[] = (expenseData || []).map((e: any) => {
            const baseAmount = Number(e.amount) || 0;
            const gstAmount = Number(e.gst_amount) || 0;
            return {
                type: 'Expense' as const,
                category: e.budget_master?.category || 'N/A',
                item: e.budget_master?.item_name || 'N/A',
                gst: gstAmount,
                baseAmount: baseAmount,
                totalAmount: baseAmount + gstAmount,
                date: format(new Date(e.expense_date), 'dd/MM/yyyy'),
            };
        });

        const incomeRows: GSTRow[] = filteredIncome.map((i: any) => {
            const baseAmount = Number(i.actual_amount) || 0;
            const gstAmount = Number(i.gst_amount) || 0;
            
            // Convert month to display format
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[i.month - 1] || 'N/A';
            const fiscalYear = i.fiscal_year?.replace('FY', '20') || '';
            
            return {
                type: 'Income' as const,
                category: i.income_categories?.category_name || 'N/A',
                item: i.income_categories?.subcategory_name || '-',
                gst: gstAmount,
                baseAmount: baseAmount,
                totalAmount: baseAmount + gstAmount,
                date: `${monthName} ${fiscalYear.split('-')[0]}`,
            };
        });

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
                    29,
                );
            }
            const tableData = data.map((row) => [
                row.date,
                row.type,
                row.category,
                row.item,
                `₹${row.baseAmount.toLocaleString('en-IN')}`,
                `₹${row.gst.toLocaleString('en-IN')}`,
                `₹${row.totalAmount.toLocaleString('en-IN')}`,
            ]);
            autoTable(doc, {
                startY: 35,
                head: [['Date', 'Type', 'Category', 'Item/Subcategory', 'Base Amount', 'GST', 'Total']],
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

    // Dashboard-style summary PDF export
    const handleExportSummaryPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchGSTData();
            
            // Calculate summaries
            const expenseData = data.filter(d => d.type === 'Expense');
            const incomeData = data.filter(d => d.type === 'Income');
            
            const totalExpenseGST = expenseData.reduce((sum, d) => sum + d.gst, 0);
            const totalIncomeGST = incomeData.reduce((sum, d) => sum + d.gst, 0);
            const totalExpenseBase = expenseData.reduce((sum, d) => sum + d.baseAmount, 0);
            const totalIncomeBase = incomeData.reduce((sum, d) => sum + d.baseAmount, 0);
            const netGST = totalIncomeGST - totalExpenseGST;
            
            // Category-wise GST breakdown
            const expenseByCategory: Record<string, { base: number; gst: number; total: number }> = {};
            expenseData.forEach(d => {
                if (!expenseByCategory[d.category]) {
                    expenseByCategory[d.category] = { base: 0, gst: 0, total: 0 };
                }
                expenseByCategory[d.category].base += d.baseAmount;
                expenseByCategory[d.category].gst += d.gst;
                expenseByCategory[d.category].total += d.totalAmount;
            });
            
            const incomeByCategory: Record<string, { base: number; gst: number; total: number }> = {};
            incomeData.forEach(d => {
                if (!incomeByCategory[d.category]) {
                    incomeByCategory[d.category] = { base: 0, gst: 0, total: 0 };
                }
                incomeByCategory[d.category].base += d.baseAmount;
                incomeByCategory[d.category].gst += d.gst;
                incomeByCategory[d.category].total += d.totalAmount;
            });

            const doc = new jsPDF('portrait');
            
            // Header
            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129);
            doc.text('GST Summary Report', 14, 20);
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
            
            // Summary Section
            doc.setFontSize(14);
            doc.text('GST Overview', 14, 48);
            
            autoTable(doc, {
                startY: 52,
                head: [['Description', 'Base Amount', 'GST Amount', 'Total']],
                body: [
                    ['Total Income', `₹${totalIncomeBase.toLocaleString('en-IN')}`, `₹${totalIncomeGST.toLocaleString('en-IN')}`, `₹${(totalIncomeBase + totalIncomeGST).toLocaleString('en-IN')}`],
                    ['Total Expense', `₹${totalExpenseBase.toLocaleString('en-IN')}`, `₹${totalExpenseGST.toLocaleString('en-IN')}`, `₹${(totalExpenseBase + totalExpenseGST).toLocaleString('en-IN')}`],
                    ['Net GST (Income - Expense)', '', `₹${netGST.toLocaleString('en-IN')}`, netGST >= 0 ? 'GST Collected' : 'GST Credit'],
                ],
                styles: { fontSize: 9 },
                headStyles: { fillColor: [16, 185, 129] },
                columnStyles: {
                    0: { fontStyle: 'bold' },
                },
            });
            
            // Expense GST by Category
            let yPos = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.text('Expense GST by Category', 14, yPos);
            
            const expenseCategoryData = Object.entries(expenseByCategory).map(([cat, data]) => [
                cat,
                `₹${data.base.toLocaleString('en-IN')}`,
                `₹${data.gst.toLocaleString('en-IN')}`,
                `₹${data.total.toLocaleString('en-IN')}`,
            ]);
            
            if (expenseCategoryData.length > 0) {
                autoTable(doc, {
                    startY: yPos + 4,
                    head: [['Category', 'Base Amount', 'GST', 'Total']],
                    body: expenseCategoryData,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [239, 68, 68] },
                });
                yPos = (doc as any).lastAutoTable.finalY + 15;
            } else {
                yPos += 10;
                doc.setFontSize(10);
                doc.text('No expense data in selected period', 14, yPos);
                yPos += 15;
            }
            
            // Income GST by Category
            doc.setFontSize(14);
            doc.text('Income GST by Category', 14, yPos);
            
            const incomeCategoryData = Object.entries(incomeByCategory).map(([cat, data]) => [
                cat,
                `₹${data.base.toLocaleString('en-IN')}`,
                `₹${data.gst.toLocaleString('en-IN')}`,
                `₹${data.total.toLocaleString('en-IN')}`,
            ]);
            
            if (incomeCategoryData.length > 0) {
                autoTable(doc, {
                    startY: yPos + 4,
                    head: [['Category', 'Base Amount', 'GST', 'Total']],
                    body: incomeCategoryData,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [34, 197, 94] },
                });
            } else {
                doc.setFontSize(10);
                doc.text('No income data in selected period', 14, yPos + 10);
            }
            
            doc.save(`gst_summary_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'Summary PDF exported', description: 'Dashboard-style GST summary exported' });
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
                'Base Amount': row.baseAmount,
                GST: row.gst,
                'Total Amount': row.totalAmount,
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

    // Calculate totals for display
    const expenseTotal = viewData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + d.gst, 0);
    const incomeTotal = viewData.filter(d => d.type === 'Income').reduce((sum, d) => sum + d.gst, 0);

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
                                <CardTitle>GST Report ({viewData.length} entries)</CardTitle>
                                <CardDescription className="flex flex-wrap gap-4 mt-2">
                                    <span className="text-destructive font-medium">
                                        Expense GST: ₹{expenseTotal.toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-green-600 font-medium">
                                        Income GST: ₹{incomeTotal.toLocaleString('en-IN')}
                                    </span>
                                    <span className={cn("font-medium", incomeTotal - expenseTotal >= 0 ? "text-green-600" : "text-destructive")}>
                                        Net: ₹{(incomeTotal - expenseTotal).toLocaleString('en-IN')}
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
                                                    <th className="p-2 text-left">Type</th>
                                                    <th className="p-2 text-left">Category</th>
                                                    <th className="p-2 text-left">Item/Subcategory</th>
                                                    <th className="p-2 text-right">Base Amount</th>
                                                    <th className="p-2 text-right">GST</th>
                                                    <th className="p-2 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewData.map((row, idx) => (
                                                    <tr key={idx} className="border-t">
                                                        <td className="p-2 whitespace-nowrap">{row.date}</td>
                                                        <td className="p-2">
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded text-xs font-medium",
                                                                row.type === 'Income' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                            )}>
                                                                {row.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-2">{row.category}</td>
                                                        <td className="p-2">{row.item}</td>
                                                        <td className="p-2 text-right">₹{row.baseAmount.toLocaleString('en-IN')}</td>
                                                        <td className="p-2 text-right">₹{row.gst.toLocaleString('en-IN')}</td>
                                                        <td className="p-2 text-right font-medium">₹{row.totalAmount.toLocaleString('en-IN')}</td>
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
