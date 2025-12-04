import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const MONTH_NUMBERS: Record<string, number> = {
    'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9,
    'Oct': 10, 'Nov': 11, 'Dec': 12, 'Jan': 1, 'Feb': 2, 'Mar': 3
};

interface MissingEntry {
    category: string;
    subcategory?: string;
    month: string;
    type: 'Income' | 'Expense' | 'Petty Cash' | 'CAM';
}

export default function MissingDataReport() {
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [fromMonth, setFromMonth] = useState<string>('Apr');
    const [toMonth, setToMonth] = useState<string>('Mar');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [missingData, setMissingData] = useState<MissingEntry[]>([]);

    useEffect(() => {
        if (userRole === 'treasurer') {
            loadMissingData();
        }
    }, [userRole]);

    const loadMissingData = async () => {
        setLoading(true);
        try {
            const missing: MissingEntry[] = [];
            const currentYear = new Date().getFullYear();
            const fiscalYear = 'FY25-26';

            // Check Income Categories - only approved entries count
            const { data: incomeCategories } = await supabase
                .from('income_categories')
                .select('id, category_name, subcategory_name')
                .eq('is_active', true);

            const { data: incomeActuals } = await supabase
                .from('income_actuals')
                .select('category_id, month, fiscal_year, status')
                .eq('fiscal_year', fiscalYear)
                .eq('status', 'approved'); // Only count approved entries

            // Build a map of what exists (approved only)
            const incomeMap = new Map<string, Set<number>>();
            incomeActuals?.forEach(actual => {
                if (!incomeMap.has(actual.category_id)) {
                    incomeMap.set(actual.category_id, new Set());
                }
                incomeMap.get(actual.category_id)?.add(actual.month);
            });

            // Find missing income entries
            incomeCategories?.forEach(category => {
                const existingMonths = incomeMap.get(category.id) || new Set();
                MONTHS.forEach(month => {
                    const monthNum = MONTH_NUMBERS[month];
                    if (!existingMonths.has(monthNum)) {
                        missing.push({
                            category: category.category_name,
                            subcategory: category.subcategory_name || undefined,
                            month,
                            type: 'Income'
                        });
                    }
                });
            });

            // Check Petty Cash - only approved entries count
            const { data: pettyCashData } = await supabase
                .from('petty_cash')
                .select('date, status')
                .gte('date', `${currentYear}-04-01`)
                .lte('date', `${currentYear + 1}-03-31`)
                .eq('status', 'approved'); // Only count approved entries

            const pettyCashMonths = new Set<number>();
            pettyCashData?.forEach(entry => {
                const date = new Date(entry.date);
                pettyCashMonths.add(date.getMonth() + 1);
            });

            MONTHS.forEach(month => {
                const monthNum = MONTH_NUMBERS[month];
                if (!pettyCashMonths.has(monthNum)) {
                    missing.push({
                        category: 'Petty Cash Entries',
                        month,
                        type: 'Petty Cash'
                    });
                }
            });

            // Check CAM Tracking - only approved/submitted entries count
            const TOWERS = [
                '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
                '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
                '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
            ];

            const { data: camData } = await supabase
                .from('cam_tracking')
                .select('tower, month, year, status')
                .eq('year', currentYear)
                .in('status', ['submitted', 'approved']); // Only count submitted or approved

            const camMap = new Map<string, Set<number>>();
            camData?.forEach(entry => {
                const key = entry.tower;
                if (!camMap.has(key)) {
                    camMap.set(key, new Set());
                }
                if (entry.month) {
                    camMap.get(key)?.add(entry.month);
                }
            });

            TOWERS.forEach(tower => {
                const existingMonths = camMap.get(tower) || new Set();
                MONTHS.forEach(month => {
                    const monthNum = MONTH_NUMBERS[month];
                    if (!existingMonths.has(monthNum)) {
                        missing.push({
                            category: `Tower ${tower}`,
                            month,
                            type: 'CAM'
                        });
                    }
                });
            });

            setMissingData(missing);
        } catch (error: any) {
            toast.error('Failed to load missing data report: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter by month range
    const getMonthIndex = (month: string) => MONTHS.indexOf(month);

    const filteredData = missingData.filter(item => {
        // Type filter
        if (selectedType !== 'all' && item.type !== selectedType) return false;

        // Month range filter
        const itemMonthIndex = getMonthIndex(item.month);
        const fromIndex = getMonthIndex(fromMonth);
        const toIndex = getMonthIndex(toMonth);

        // Handle wrap-around (e.g., Oct to Mar crosses year boundary)
        if (fromIndex <= toIndex) {
            // Normal range (e.g., Apr to Sep)
            if (itemMonthIndex < fromIndex || itemMonthIndex > toIndex) return false;
        } else {
            // Wrap-around range (e.g., Oct to Mar)
            if (itemMonthIndex < fromIndex && itemMonthIndex > toIndex) return false;
        }

        return true;
    });

    const downloadReport = () => {
        const exportData = filteredData.map(item => ({
            'Type': item.type,
            'Category': item.category,
            'Subcategory': item.subcategory || '-',
            'Month': item.month,
            'Status': 'Missing'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Missing Data');
        XLSX.writeFile(wb, `Missing_Data_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Report downloaded successfully');
    };

    if (userRole !== 'treasurer') {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-muted-foreground">
                            This report is only available to Treasurers.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Missing Data Report</h1>
                    <p className="text-muted-foreground mt-1">
                        Track which entries haven't been recorded yet
                    </p>
                </div>
                <Button onClick={downloadReport} disabled={filteredData.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Report
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Filter missing entries by month and type</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">From Month</label>
                            <Select value={fromMonth} onValueChange={setFromMonth}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(month => (
                                        <SelectItem key={month} value={month}>{month}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">To Month</label>
                            <Select value={toMonth} onValueChange={setToMonth}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(month => (
                                        <SelectItem key={month} value={month}>{month}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Type</label>
                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="Income">Income</SelectItem>
                                    <SelectItem value="Expense">Expense</SelectItem>
                                    <SelectItem value="Petty Cash">Petty Cash</SelectItem>
                                    <SelectItem value="CAM">CAM</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        Missing Entries ({filteredData.length})
                    </CardTitle>
                    <CardDescription>
                        These entries need to be recorded by the accountant
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center py-8 text-muted-foreground">Loading...</p>
                    ) : filteredData.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">
                            No missing entries found! All data is up to date.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Subcategory</TableHead>
                                        <TableHead>Month</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <Badge variant="outline">{item.type}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{item.category}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {item.subcategory || '-'}
                                            </TableCell>
                                            <TableCell>{item.month}</TableCell>
                                            <TableCell>
                                                <Badge variant="destructive">Missing</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
