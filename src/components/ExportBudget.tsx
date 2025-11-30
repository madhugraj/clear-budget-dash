import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { BarChart3 } from 'lucide-react';

export function ExportBudget() {
    const [loading, setLoading] = useState(false);
    const [viewData, setViewData] = useState<any[]>([]);
    const [showView, setShowView] = useState(false);
    const { toast } = useToast();

    const fetchBudgetData = async () => {
        // Fetch Expense Budget
        const { data: expenseData, error: expenseError } = await supabase
            .from('budget_master')
            .select('category, item_name, annual_budget')
            .eq('fiscal_year', 'FY25-26')
            .order('category');

        if (expenseError) throw expenseError;

        const expenses = (expenseData || []).map((b: any) => ({
            Type: 'Expense',
            Category: b.category || 'N/A',
            Item: b.item_name || 'N/A',
            Budget: Number(b.annual_budget) || 0,
        }));

        // Fetch Income Budget
        const { data: incomeData, error: incomeError } = await supabase
            .from('income_budget')
            .select(`
                budgeted_amount,
                income_categories (
                    category_name,
                    subcategory_name
                )
            `)
            .eq('fiscal_year', 'FY25-26');

        if (incomeError) throw incomeError;

        const income = (incomeData || []).map((b: any) => ({
            Type: 'Income',
            Category: b.income_categories?.category_name || 'N/A',
            Item: b.income_categories?.subcategory_name || '-',
            Budget: Number(b.budgeted_amount) || 0,
        }));

        return [...income, ...expenses];
    };

    const handleView = async () => {
        setLoading(true);
        try {
            const data = await fetchBudgetData();
            setViewData(data);
            setShowView(true);
            toast({ title: 'Budget loaded', description: `Showing ${data.length} budget items` });
        } catch (error: any) {
            toast({ title: 'Failed to load budget', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportSummaryPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchBudgetData();

            const incomeData = data.filter((d: any) => d.Type === 'Income');
            const expenseData = data.filter((d: any) => d.Type === 'Expense');

            const totalIncome = incomeData.reduce((sum: number, d: any) => sum + Number(d.Budget), 0);
            const totalExpense = expenseData.reduce((sum: number, d: any) => sum + Number(d.Budget), 0);

            const doc = new jsPDF('portrait');

            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129);
            doc.text('Budget Summary Report', 14, 20);
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

            doc.setFontSize(14);
            doc.text('Overview', 14, 40);

            autoTable(doc, {
                startY: 44,
                head: [['Description', 'Amount']],
                body: [
                    ['Total Income Budget', `₹${totalIncome.toLocaleString('en-IN')}`],
                    ['Total Expense Budget', `₹${totalExpense.toLocaleString('en-IN')}`],
                    ['Net Budget', `₹${(totalIncome - totalExpense).toLocaleString('en-IN')}`],
                ],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [16, 185, 129] },
                columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
            });

            let yPos = (doc as any).lastAutoTable.finalY + 15;

            // Income Section
            if (incomeData.length > 0) {
                doc.setFontSize(14);
                doc.text('Income Budget', 14, yPos);

                const incomeByCategory: Record<string, number> = {};
                incomeData.forEach((d: any) => {
                    const cat = d.Category || 'Uncategorized';
                    incomeByCategory[cat] = (incomeByCategory[cat] || 0) + Number(d.Budget);
                });

                const incomeRows = Object.entries(incomeByCategory).map(([cat, amount]) => [
                    cat,
                    `₹${amount.toLocaleString('en-IN')}`
                ]);

                autoTable(doc, {
                    startY: yPos + 4,
                    head: [['Category', 'Budget Amount']],
                    body: incomeRows,
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [79, 70, 229] },
                    columnStyles: { 1: { halign: 'right' } },
                });

                yPos = (doc as any).lastAutoTable.finalY + 15;
            }

            // Expense Section
            if (expenseData.length > 0) {
                doc.setFontSize(14);
                doc.text('Expense Budget', 14, yPos);

                const expenseByCategory: Record<string, number> = {};
                expenseData.forEach((d: any) => {
                    const cat = d.Category || 'Uncategorized';
                    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(d.Budget);
                });

                const expenseRows = Object.entries(expenseByCategory).map(([cat, amount]) => [
                    cat,
                    `₹${amount.toLocaleString('en-IN')}`
                ]);

                autoTable(doc, {
                    startY: yPos + 4,
                    head: [['Category', 'Budget Amount']],
                    body: expenseRows,
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [220, 38, 38] }, // Red for expenses
                    columnStyles: { 1: { halign: 'right' } },
                });
            }

            doc.save(`budget_summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'Summary PDF exported', description: 'Budget summary exported' });
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (formatType: 'excel' | 'csv') => {
        setLoading(true);
        try {
            const data = await fetchBudgetData();
            if (formatType === 'excel') {
                exportToExcel(data, 'budget_report');
            } else {
                exportToCSV(data, 'budget_report');
            }
            toast({ title: 'Export successful', description: `${data.length} records exported as ${formatType.toUpperCase()}` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <FileDown className="h-5 w-5 text-primary" />
                    <CardTitle>Export Budget (Income & Expense)</CardTitle>
                </div>
                <CardDescription>Download planned budget for income and expenses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleView} disabled={loading} variant="secondary" className="flex-1 min-w-[200px]">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    View Budget
                </Button>
                <Button onClick={handleExportSummaryPDF} disabled={loading} variant="default" className="flex-1 min-w-[200px]">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                    Export Summary PDF
                </Button>
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
                            <CardTitle>Budget ({viewData.length} entries)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <table className="w-full border">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="p-2 text-left">Type</th>
                                        <th className="p-2 text-left">Category</th>
                                        <th className="p-2 text-left">Item</th>
                                        <th className="p-2 text-right">Budget (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewData.map((row, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="p-2">
                                                <span className={`px-2 py-1 rounded text-xs ${row.Type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {row.Type}
                                                </span>
                                            </td>
                                            <td className="p-2">{row.Category}</td>
                                            <td className="p-2">{row.Item}</td>
                                            <td className="p-2 text-right">₹{row.Budget.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}
            </CardContent>
        </Card>
    );
}
