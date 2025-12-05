import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';

const TOWERS = [
    'All', '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
    '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
    '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

const MONTHS = [
    { value: 'all', label: 'All Months' },
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

const QUARTERS = [
    { value: 'all', label: 'All Quarters' },
    { value: 1, label: 'Q1 (Apr-Jun)' },
    { value: 2, label: 'Q2 (Jul-Sep)' },
    { value: 3, label: 'Q3 (Oct-Dec)' },
    { value: 4, label: 'Q4 (Jan-Mar)' }
];

interface CAMRecord {
    id: string;
    tower: string;
    month: number;
    year: number;
    quarter: number;
    paid_flats: number;
    pending_flats: number;
    total_flats: number;
    dues_cleared_from_previous: number;
    advance_payments: number;
    status: string;
    submitted_at: string | null;
    approved_at: string | null;
    notes: string | null;
}

export default function CAMReports() {
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState<CAMRecord[]>([]);
    const [selectedTower, setSelectedTower] = useState('All');
    const [selectedMonth, setSelectedMonth] = useState<string | number>('all');
    const [selectedQuarter, setSelectedQuarter] = useState<string | number>('all');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [viewMode, setViewMode] = useState<'month' | 'quarter'>('month');

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        if (userRole === 'treasurer') {
            loadRecords();
        }
    }, [selectedTower, selectedMonth, selectedQuarter, selectedYear, viewMode, userRole]);

    const loadRecords = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('cam_tracking')
                .select('*')
                .eq('year', selectedYear)
                .in('status', ['submitted', 'approved'])
                .order('tower')
                .order('month');

            // Tower filter
            if (selectedTower !== 'All') {
                query = query.eq('tower', selectedTower);
            }

            // Month/Quarter filter
            if (viewMode === 'month' && selectedMonth !== 'all') {
                query = query.eq('month', selectedMonth);
            } else if (viewMode === 'quarter' && selectedQuarter !== 'all') {
                query = query.eq('quarter', selectedQuarter);
            }

            const { data, error } = await query;

            if (error) throw error;

            setRecords(data || []);
        } catch (error: any) {
            toast.error('Failed to load records: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getMonthName = (month: number) => {
        return MONTHS.find(m => m.value === month)?.label || month.toString();
    };

    const downloadExcel = () => {
        if (records.length === 0) {
            toast.error('No records to download');
            return;
        }

        const exportData = records.map(record => ({
            'Tower': record.tower,
            'Month': getMonthName(record.month),
            'Quarter': `Q${record.quarter}`,
            'Year': record.year,
            'Paid Flats': record.paid_flats,
            'Pending Flats': record.pending_flats,
            'Total Flats': record.total_flats,
            'Payment Rate %': record.total_flats > 0 ? ((record.paid_flats / record.total_flats) * 100).toFixed(1) : '0',
            'Dues Cleared': record.dues_cleared_from_previous,
            'Advance Payments': record.advance_payments,
            'Status': record.status,
            'Submitted At': record.submitted_at ? new Date(record.submitted_at).toLocaleDateString() : '-',
            'Approved At': record.approved_at ? new Date(record.approved_at).toLocaleDateString() : '-',
            'Notes': record.notes || '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'CAM Records');

        // Auto-size columns
        const maxWidth = exportData.reduce((w, r) => Math.max(w, ...Object.values(r).map(val => String(val).length)), 10);
        worksheet['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wch: Math.min(maxWidth, 30) }));

        const fileName = `CAM_Records_${selectedTower}_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);

        toast.success('Report downloaded successfully');
    };

    if (userRole !== 'treasurer') {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-muted-foreground">
                            This page is only accessible to Treasurers.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <FileSpreadsheet className="h-8 w-8" />
                    CAM Records & Reports
                </h1>
                <p className="text-muted-foreground mt-1">
                    Download tower-wise CAM collection reports for MC follow-up
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filter & Download</CardTitle>
                    <CardDescription>
                        Select filters to view and download CAM records
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tower</label>
                            <Select value={selectedTower} onValueChange={setSelectedTower}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TOWERS.map(tower => (
                                        <SelectItem key={tower} value={tower}>{tower}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Year</label>
                            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(year => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">View By</label>
                            <Select value={viewMode} onValueChange={(val: 'month' | 'quarter') => setViewMode(val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="month">Monthly</SelectItem>
                                    <SelectItem value="quarter">Quarterly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {viewMode === 'month' ? (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Month</label>
                                <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(val === 'all' ? 'all' : parseInt(val))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map(month => (
                                            <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Quarter</label>
                                <Select value={selectedQuarter.toString()} onValueChange={(val) => setSelectedQuarter(val === 'all' ? 'all' : parseInt(val))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {QUARTERS.map(quarter => (
                                            <SelectItem key={quarter.value} value={quarter.value.toString()}>{quarter.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            {records.length} record(s) found
                        </div>
                        <Button onClick={downloadExcel} disabled={records.length === 0}>
                            <Download className="w-4 h-4 mr-2" />
                            Download Excel
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Records Preview</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : records.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">
                            No records found for the selected filters
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tower</TableHead>
                                        <TableHead>Month</TableHead>
                                        <TableHead>Quarter</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Pending</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Rate %</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.map((record) => {
                                        const paymentRate = record.total_flats > 0
                                            ? ((record.paid_flats / record.total_flats) * 100).toFixed(1)
                                            : '0';

                                        return (
                                            <TableRow key={record.id}>
                                                <TableCell className="font-medium">{record.tower}</TableCell>
                                                <TableCell>{getMonthName(record.month)}</TableCell>
                                                <TableCell>Q{record.quarter}</TableCell>
                                                <TableCell className="text-right text-green-600">{record.paid_flats}</TableCell>
                                                <TableCell className="text-right text-red-600">{record.pending_flats}</TableCell>
                                                <TableCell className="text-right">{record.total_flats}</TableCell>
                                                <TableCell className="text-right font-medium">{paymentRate}%</TableCell>
                                                <TableCell>
                                                    <Badge variant={record.status === 'approved' ? 'default' : 'secondary'}>
                                                        {record.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
