import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Download, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TOWERS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
  '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
  '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

const TOWER_TOTAL_FLATS: Record<string, number> = {
  '1A': 67, '1B': 67, '2A': 67, '2B': 67, '3A': 67, '3B': 67,
  '4A': 67, '4B': 67, '5': 67, '6': 67, '7': 67, '8': 67,
  '9A': 67, '9B': 67, '9C': 67, '10': 67,
  '11': 201, '12': 201, '13': 201,
  '14': 67, '15A': 67, '15B': 67,
  '16A': 67, '16B': 67, '17A': 67, '17B': 67,
  '18A': 67, '18B': 67, '18C': 67, '19': 67,
  '20A': 67, '20B': 67, '20C': 67
};

const FISCAL_QUARTERS = [
  { value: 1, label: 'Q1 (Apr-Jun)', months: [4, 5, 6] },
  { value: 2, label: 'Q2 (Jul-Sep)', months: [7, 8, 9] },
  { value: 3, label: 'Q3 (Oct-Dec)', months: [10, 11, 12] },
  { value: 4, label: 'Q4 (Jan-Mar)', months: [1, 2, 3] }
];

const MONTH_NAMES: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
};

interface CAMRecord {
  id: string;
  tower: string;
  year: number;
  quarter: number;
  month: number | null;
  paid_flats: number;
  pending_flats: number;
  total_flats: number;
  dues_cleared_from_previous: number;
  advance_payments: number;
  status: string;
  notes: string | null;
}

export function ExportCAM() {
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [camData, setCamData] = useState<CAMRecord[]>([]);

  const years = Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i);

  useEffect(() => {
    fetchCAMData();
  }, [selectedYear, selectedQuarter]);

  const getCalendarYear = () => {
    return selectedQuarter === 4 ? selectedYear + 1 : selectedYear;
  };

  const fetchCAMData = async () => {
    setLoading(true);
    try {
      const calendarYear = getCalendarYear();
      const quarterConfig = FISCAL_QUARTERS.find(q => q.value === selectedQuarter);
      const months = quarterConfig?.months || [];

      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('year', calendarYear)
        .eq('status', 'approved');

      if (error) throw error;

      // Filter to relevant months
      const filteredData = (data || []).filter(d => d.month && months.includes(d.month)) as unknown as CAMRecord[];
      setCamData(filteredData);
    } catch (error: any) {
      toast.error('Failed to fetch CAM data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getQuarterSummary = () => {
    const quarterConfig = FISCAL_QUARTERS.find(q => q.value === selectedQuarter);
    const months = quarterConfig?.months || [];

    const summary: Record<string, { tower: string; totalFlats: number; paidFlats: number; pendingFlats: number; duesCleared: number; advance: number }> = {};

    TOWERS.forEach(tower => {
      summary[tower] = {
        tower,
        totalFlats: TOWER_TOTAL_FLATS[tower],
        paidFlats: 0,
        pendingFlats: TOWER_TOTAL_FLATS[tower],
        duesCleared: 0,
        advance: 0
      };
    });

    // Use the last month's data for each tower
    camData.forEach(record => {
      if (record.month && months.includes(record.month)) {
        const lastMonthInQuarter = Math.max(...months);
        if (record.month === lastMonthInQuarter) {
          summary[record.tower] = {
            tower: record.tower,
            totalFlats: record.total_flats,
            paidFlats: record.paid_flats,
            pendingFlats: record.pending_flats,
            duesCleared: record.dues_cleared_from_previous,
            advance: record.advance_payments
          };
        }
      }
    });

    return Object.values(summary);
  };

  const exportToExcel = () => {
    const summary = getQuarterSummary();
    const exportData = summary.map(row => ({
      'Tower': row.tower,
      'Total Flats': row.totalFlats,
      'Paid Flats': row.paidFlats,
      'Pending Flats': row.pendingFlats,
      'Dues Cleared': row.duesCleared,
      'Advance Payments': row.advance,
      'Collection Rate (%)': ((row.paidFlats / row.totalFlats) * 100).toFixed(1)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CAM Report");
    XLSX.writeFile(wb, `CAM_Report_FY${selectedYear}_Q${selectedQuarter}.xlsx`);
    toast.success('Excel file downloaded');
  };

  const exportToPDF = () => {
    const summary = getQuarterSummary();
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text(`CAM Collection Report - FY${selectedYear} Q${selectedQuarter}`, 14, 20);
    
    const tableData = summary.map(row => [
      row.tower,
      row.totalFlats.toString(),
      row.paidFlats.toString(),
      row.pendingFlats.toString(),
      row.duesCleared.toString(),
      row.advance.toString(),
      `${((row.paidFlats / row.totalFlats) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      head: [['Tower', 'Total', 'Paid', 'Pending', 'Dues Cleared', 'Advance', 'Rate']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Add summary at the bottom
    const totalPaid = summary.reduce((sum, r) => sum + r.paidFlats, 0);
    const totalPending = summary.reduce((sum, r) => sum + r.pendingFlats, 0);
    const totalFlats = summary.reduce((sum, r) => sum + r.totalFlats, 0);

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Total Flats: ${totalFlats} | Paid: ${totalPaid} | Pending: ${totalPending} | Collection Rate: ${((totalPaid / totalFlats) * 100).toFixed(1)}%`, 14, finalY);

    doc.save(`CAM_Report_FY${selectedYear}_Q${selectedQuarter}.pdf`);
    toast.success('PDF file downloaded');
  };

  const summary = getQuarterSummary();
  const totalPaid = summary.reduce((sum, r) => sum + r.paidFlats, 0);
  const totalPending = summary.reduce((sum, r) => sum + r.pendingFlats, 0);
  const totalFlats = summary.reduce((sum, r) => sum + r.totalFlats, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            CAM Collection Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Fiscal Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>FY {year}-{(year + 1).toString().slice(-2)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedQuarter.toString()} onValueChange={(v) => setSelectedQuarter(parseInt(v))}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent>
                {FISCAL_QUARTERS.map(q => (
                  <SelectItem key={q.value} value={q.value.toString()}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" onClick={exportToPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Flats</div>
                <div className="text-2xl font-bold">{totalFlats.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Paid</div>
                <div className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Pending</div>
                <div className="text-2xl font-bold text-red-600">{totalPending.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Collection Rate</div>
                <div className="text-2xl font-bold text-primary">
                  {totalFlats > 0 ? ((totalPaid / totalFlats) * 100).toFixed(1) : 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tower</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Dues Cleared</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((row) => (
                    <TableRow key={row.tower}>
                      <TableCell className="font-medium">{row.tower}</TableCell>
                      <TableCell className="text-right">{row.totalFlats}</TableCell>
                      <TableCell className="text-right text-green-600">{row.paidFlats}</TableCell>
                      <TableCell className="text-right text-red-600">{row.pendingFlats}</TableCell>
                      <TableCell className="text-right">{row.duesCleared}</TableCell>
                      <TableCell className="text-right">{row.advance}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.paidFlats / row.totalFlats >= 0.9 ? 'default' : 'secondary'}>
                          {((row.paidFlats / row.totalFlats) * 100).toFixed(1)}%
                        </Badge>
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