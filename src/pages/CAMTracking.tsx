import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Save, Upload, Building2, AlertCircle, Download, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as XLSX from 'xlsx';

const TOWERS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
  '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
  '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

// Tower-specific total flats: 67 per tower, except 11, 12, 13 which have 201 each
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

const TOTAL_FLATS_IN_COMPLEX = 2613;

// Fiscal Year Quarters (Q1 starts April)
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

interface CAMData {
  id?: string;
  tower: string;
  year: number;
  quarter: number;
  month?: number;
  paid_flats: number;
  pending_flats: number;
  total_flats: number;
  dues_cleared_from_previous: number;
  advance_payments: number;
  notes?: string;
  is_locked?: boolean;
  status?: string;
}

interface CAMDataFromDB {
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
  notes: string | null;
  is_locked: boolean;
  status: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export default function CAMTracking() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Fiscal Year
  const [selectedQuarter, setSelectedQuarter] = useState(1); // Default to Q1
  const [selectedTower, setSelectedTower] = useState<string>('1A');
  // Map: Tower -> Month -> Data
  const [camData, setCamData] = useState<Record<string, Record<number, CAMData>>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const years = Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i);

  useEffect(() => {
    fetchUserRole();
  }, [user]);

  useEffect(() => {
    fetchCAMData();
  }, [selectedYear, selectedQuarter]);

  const fetchUserRole = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    setUserRole(data?.role || null);
  };

  const getCalendarYearAndMonths = () => {
    const quarterConfig = FISCAL_QUARTERS.find(q => q.value === selectedQuarter);
    if (!quarterConfig) return { year: selectedYear, months: [] };

    const months = quarterConfig.months;
    // If Q4 (Jan-Mar), it falls in the next calendar year
    const calendarYear = selectedQuarter === 4 ? selectedYear + 1 : selectedYear;

    return { calendarYear, months };
  };

  const fetchCAMData = async () => {
    setLoading(true);
    try {
      const { calendarYear, months } = getCalendarYearAndMonths();

      // Fetch data for the specific months in the calendar year
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('year', calendarYear);

      if (error) throw error;

      // Cast data to our expected type (types.ts may not have month/is_locked yet)
      const typedData = (data || []) as unknown as CAMDataFromDB[];

      const dataMap: Record<string, Record<number, CAMData>> = {};

      // Initialize structure
      TOWERS.forEach(tower => {
        dataMap[tower] = {};
        months.forEach(month => {
          const existing = typedData.find(d => d.tower === tower && d.month === month);
          dataMap[tower][month] = existing ? {
            id: existing.id,
            tower: existing.tower,
            year: existing.year,
            quarter: existing.quarter,
            month: existing.month || month,
            paid_flats: existing.paid_flats,
            pending_flats: existing.pending_flats,
            total_flats: existing.total_flats,
            dues_cleared_from_previous: existing.dues_cleared_from_previous,
            advance_payments: existing.advance_payments,
            notes: existing.notes || undefined,
            is_locked: existing.is_locked,
            status: existing.status
          } : {
            tower,
            year: calendarYear,
            quarter: Math.ceil(month / 3),
            month,
            paid_flats: 0,
            pending_flats: 0,
            total_flats: TOWER_TOTAL_FLATS[tower],
            dues_cleared_from_previous: 0,
            advance_payments: 0,
            is_locked: false,
            status: 'draft'
          };
        });
      });

      setCamData(dataMap);
      setValidationErrors({});
    } catch (error: any) {
      toast.error('Failed to fetch CAM data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateTowerData = (tower: string, month: number, data: CAMData): string | null => {
    const maxFlats = TOWER_TOTAL_FLATS[tower];

    if (data.paid_flats < 0 || data.pending_flats < 0) {
      return 'Values cannot be negative';
    }

    if (data.paid_flats > maxFlats) {
      return `Paid flats cannot exceed ${maxFlats} for tower ${tower}`;
    }

    if (data.pending_flats > maxFlats) {
      return `Pending flats cannot exceed ${maxFlats} for tower ${tower}`;
    }

    if (data.paid_flats + data.pending_flats > maxFlats) {
      return `Total (paid + pending) cannot exceed ${maxFlats} flats in ${MONTH_NAMES[month]}`;
    }

    return null;
  };

  const handleInputChange = (
    tower: string,
    month: number,
    field: 'paid_flats' | 'pending_flats' | 'dues_cleared_from_previous' | 'advance_payments',
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    const currentMonthData = camData[tower][month];

    const updatedMonthData = {
      ...currentMonthData,
      [field]: numValue,
      total_flats: TOWER_TOTAL_FLATS[tower]
    };

    setCamData(prev => ({
      ...prev,
      [tower]: {
        ...prev[tower],
        [month]: updatedMonthData
      }
    }));

    const error = validateTowerData(tower, month, updatedMonthData);
    setValidationErrors(prev => ({
      ...prev,
      [`${tower}-${month}`]: error || ''
    }));
  };

  const handleSaveTower = async (tower: string) => {
    if (!user) return;

    const { months } = getCalendarYearAndMonths();
    const towerMonthsData = camData[tower];

    // Validate all months first
    for (const month of months) {
      const error = validateTowerData(tower, month, towerMonthsData[month]);
      if (error) {
        toast.error(`Error in ${MONTH_NAMES[month]}: ${error}`);
        return;
      }
    }

    setSaving(true);
    try {
      const upsertData = months.map(month => {
        const data = towerMonthsData[month];
        return {
          tower: data.tower,
          year: data.year,
          quarter: data.quarter, // Calendar quarter
          month: month,
          paid_flats: data.paid_flats,
          pending_flats: data.pending_flats,
          total_flats: TOWER_TOTAL_FLATS[tower],
          dues_cleared_from_previous: data.dues_cleared_from_previous || 0,
          advance_payments: data.advance_payments || 0,
          notes: data.notes || null,
          uploaded_by: user.id
        };
      });

      // We need to upsert each record. 
      // Since we have a unique constraint on (tower, year, month), we can use upsert.
      // However, we need to handle the ID if it exists to avoid creating new IDs if not needed, 
      // but upsert handles that if we match the unique key? 
      // Supabase upsert matches on Primary Key by default, or we can specify `onConflict`.

      // Cast to any to bypass type checking until types.ts is regenerated
      const { error } = await supabase
        .from('cam_tracking')
        .upsert(upsertData as any, { onConflict: 'tower,year,month' });

      if (error) throw error;

      toast.success(`Tower ${tower} data saved as draft`);
      fetchCAMData();
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitTower = async (tower: string) => {
    if (!user) return;

    const { months } = getCalendarYearAndMonths();
    const towerMonthsData = camData[tower];

    // Validate all months first
    for (const month of months) {
      const error = validateTowerData(tower, month, towerMonthsData[month]);
      if (error) {
        toast.error(`Error in ${MONTH_NAMES[month]}: ${error}`);
        return;
      }
    }

    // Check if all months have data (paid_flats > 0 or pending_flats > 0)
    const hasData = months.every(month => {
      const data = towerMonthsData[month];
      return data.paid_flats > 0 || data.pending_flats > 0;
    });

    if (!hasData) {
      toast.error('Please enter data for all months before submitting');
      return;
    }

    setSaving(true);
    try {
      const { calendarYear } = getCalendarYearAndMonths();

      // Update status to 'submitted' for all months of this tower
      const { error } = await supabase
        .from('cam_tracking')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString()
        } as any)
        .eq('tower', tower)
      if (error) throw error;

      // Send notification to treasurers (asynchronously, don't block on it)
      // Get the IDs of records that were just submitted
      const { data: submittedRecords } = await supabase
        .from('cam_tracking')
        .select('id')
        .eq('tower', tower)
        .eq('year', calendarYear)
        .in('month', months)
        .eq('status', 'submitted');

      // Send notifications for each record
      if (submittedRecords && submittedRecords.length > 0) {
        for (const record of submittedRecords) {
          supabase.functions.invoke('send-cam-notification', {
            body: { camId: record.id, action: 'submitted' }
          }).catch(err => console.error('Notification failed:', err));
        }
      }

      toast.success(`Tower ${tower} data submitted for approval`);
      fetchCAMData();
    } catch (error: any) {
      toast.error('Failed to submit: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getTowerStatus = (tower: string): string => {
    const { months } = getCalendarYearAndMonths();
    const statuses = months.map(m => camData[tower]?.[m]?.status || 'draft');

    if (statuses.every(s => s === 'approved')) return 'approved';
    if (statuses.some(s => s === 'submitted')) return 'submitted';
    if (statuses.some(s => s === 'correction_pending')) return 'correction_pending';
    if (statuses.some(s => s === 'correction_approved')) return 'correction_approved';
    return 'draft';
  };

  const canEditTower = (tower: string): boolean => {
    const status = getTowerStatus(tower);
    return status === 'draft' || status === 'correction_approved';
  };

  const handleDownload = () => {
    if (!camData) return;

    const { months } = getCalendarYearAndMonths();
    const exportData: any[] = [];

    TOWERS.forEach(tower => {
      const row: any = { Tower: tower };
      months.forEach(month => {
        const data = camData[tower]?.[month];
        if (data) {
          const mName = MONTH_NAMES[month];
          row[`${mName} Paid`] = data.paid_flats;
          row[`${mName} Pending`] = data.pending_flats;
          row[`${mName} Dues Cleared`] = data.dues_cleared_from_previous;
          row[`${mName} Advance`] = data.advance_payments;
        }
      });
      exportData.push(row);
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CAM Data");
    XLSX.writeFile(wb, `CAM_Report_FY${selectedYear}_Q${selectedQuarter}.xlsx`);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, tower: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Expecting rows to have Month column or we assume order?
        // Let's assume the user uploads a file with columns like: Month, Paid, Pending...
        // Or one row per month.

        // For simplicity, let's assume the file has 3 rows, one for each month of the quarter.
        // Or we look for a 'Month' column.

        const { months } = getCalendarYearAndMonths();

        const updatedTowerData = { ...camData[tower] };
        let hasUpdates = false;

        jsonData.forEach(row => {
          // Try to match month
          const rowMonthStr = row.Month || row.month;
          let monthNum = -1;

          if (typeof rowMonthStr === 'string') {
            // Get first 3 characters (e.g., "Apr" from "April" or just "Apr")
            const monthAbbr = rowMonthStr.trim().slice(0, 3);

            // Find the month number where MONTH_NAMES matches
            for (const [key, value] of Object.entries(MONTH_NAMES)) {
              if (value === monthAbbr) {
                monthNum = parseInt(key);
                break;
              }
            }
          } else if (typeof rowMonthStr === 'number') {
            monthNum = rowMonthStr;
          }

          console.log('Processing row:', row, 'Month String:', rowMonthStr, 'Parsed Month Num:', monthNum);

          if (monthNum !== -1 && months.includes(monthNum)) {
            updatedTowerData[monthNum] = {
              ...updatedTowerData[monthNum],
              paid_flats: parseInt(row.Paid || row.paid || row.paid_flats || 0),
              pending_flats: parseInt(row.Pending || row.pending || row.pending_flats || 0),
              dues_cleared_from_previous: parseInt(row['Dues Cleared'] || row.dues_cleared || row.dues_cleared_from_previous || 0),
              advance_payments: parseInt(row['Advance'] || row.advance || row.advance_payments || 0),
            };
            hasUpdates = true;
          }
        });

        if (hasUpdates) {
          setCamData(prev => ({
            ...prev,
            [tower]: updatedTowerData
          }));
          toast.success(`Data loaded for Tower ${tower}. Review and save.`);
        } else {
          toast.warning('No matching month data found in file. Ensure "Month" column exists (e.g. "Apr", "May").');
        }
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast.error('Failed to parse file: ' + error.message);
    }
    event.target.value = '';
  };

  const getTowerMonthData = (tower: string, month: number) => camData[tower]?.[month] || {
    tower,
    year: selectedYear,
    quarter: selectedQuarter,
    month,
    paid_flats: 0,
    pending_flats: 0,
    total_flats: TOWER_TOTAL_FLATS[tower],
    dues_cleared_from_previous: 0,
    advance_payments: 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            CAM Tracking
          </h1>
          <p className="text-muted-foreground">
            Track Common Area Maintenance payments by tower (Total: {TOTAL_FLATS_IN_COMPLEX} flats)
          </p>
        </div>
      </div>

      <Tabs defaultValue="tower-entry" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tower-entry">Tower-wise Entry</TabsTrigger>
          <TabsTrigger value="overview">All Towers Overview</TabsTrigger>
          <TabsTrigger value="summary">Quarterly Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="tower-entry" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={selectedTower} onValueChange={setSelectedTower}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Tower" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOWERS.map(tower => (
                      <SelectItem key={tower} value={tower}>
                        Tower {tower} ({TOWER_TOTAL_FLATS[tower]} flats)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={String(year)}>FY {year}-{year + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(Number(v))}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {FISCAL_QUARTERS.map(q => (
                      <SelectItem key={q.value} value={String(q.value)}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Tower {selectedTower} has <strong>{TOWER_TOTAL_FLATS[selectedTower]}</strong> total flats.
                  Paid + Pending cannot exceed this limit.
                </AlertDescription>
              </Alert>

              <div className="space-y-6">
                {getCalendarYearAndMonths().months.map(month => (
                  <div key={month} className="p-4 border rounded-lg bg-muted/20">
                    <h3 className="font-semibold mb-3 text-primary">{MONTH_NAMES[month]}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Paid Flats</label>
                        <Input
                          type="number"
                          min="0"
                          max={TOWER_TOTAL_FLATS[selectedTower]}
                          value={getTowerMonthData(selectedTower, month).paid_flats || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'paid_flats', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Pending Flats</label>
                        <Input
                          type="number"
                          min="0"
                          max={TOWER_TOTAL_FLATS[selectedTower]}
                          value={getTowerMonthData(selectedTower, month).pending_flats || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'pending_flats', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Dues Cleared</label>
                        <Input
                          type="number"
                          min="0"
                          value={getTowerMonthData(selectedTower, month).dues_cleared_from_previous || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'dues_cleared_from_previous', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Advance</label>
                        <Input
                          type="number"
                          min="0"
                          value={getTowerMonthData(selectedTower, month).advance_payments || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'advance_payments', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {validationErrors[`${selectedTower}-${month}`] && (
                      <p className="text-sm text-destructive mt-2">{validationErrors[`${selectedTower}-${month}`]}</p>
                    )}
                  </div>
                ))}
              </div>



              <div className="flex items-center justify-between gap-3 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => handleFileUpload(e, selectedTower)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={!canEditTower(selectedTower)}
                    />
                    <Button variant="outline" size="sm" disabled={!canEditTower(selectedTower)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleSaveTower(selectedTower)}
                    disabled={saving || !!validationErrors[selectedTower] || !canEditTower(selectedTower)}
                    variant="outline"
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Draft
                  </Button>
                  {userRole === 'lead' && getTowerStatus(selectedTower) === 'draft' && (
                    <Button
                      onClick={() => handleSubmitTower(selectedTower)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Submit for Approval
                    </Button>
                  )}
                </div>
                <Badge variant={
                  getTowerStatus(selectedTower) === 'approved' ? 'default' :
                    getTowerStatus(selectedTower) === 'submitted' ? 'secondary' :
                      getTowerStatus(selectedTower) === 'correction_pending' ? 'destructive' :
                        'outline'
                }>
                  {getTowerStatus(selectedTower) === 'draft' ? 'Draft' :
                    getTowerStatus(selectedTower) === 'submitted' ? 'Pending Approval' :
                      getTowerStatus(selectedTower) === 'approved' ? 'Approved' :
                        getTowerStatus(selectedTower) === 'correction_pending' ? 'Correction Pending' :
                          getTowerStatus(selectedTower) === 'correction_approved' ? 'Edit Allowed' :
                            'Draft'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-lg">All Towers - {FISCAL_QUARTERS.find(q => q.value === selectedQuarter)?.label} {selectedYear}</CardTitle>
                <div className="flex items-center gap-3">
                  {(userRole === 'treasurer' || userRole === 'lead') && (
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  )}
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={String(year)}>FY {year}-{year + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(Number(v))}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_QUARTERS.map(q => (
                        <SelectItem key={q.value} value={String(q.value)}>{q.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[80px]">Tower</TableHead>
                      <TableHead className="w-[80px]">Total</TableHead>
                      {getCalendarYearAndMonths().months.map(m => (
                        <TableHead key={m} className="text-center border-l" colSpan={2}>{MONTH_NAMES[m]}</TableHead>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead></TableHead>
                      {getCalendarYearAndMonths().months.map(m => (
                        <>
                          <TableHead key={`${m}-paid`} className="text-xs text-center border-l text-green-600">Paid</TableHead>
                          <TableHead key={`${m}-pending`} className="text-xs text-center text-red-600">Pending</TableHead>
                        </>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TOWERS.map(tower => {
                      const maxFlats = TOWER_TOTAL_FLATS[tower];
                      const months = getCalendarYearAndMonths().months;

                      return (
                        <TableRow key={tower}>
                          <TableCell className="font-medium">{tower}</TableCell>
                          <TableCell>{maxFlats}</TableCell>
                          {months.map(m => {
                            const data = getTowerMonthData(tower, m);
                            return (
                              <>
                                <TableCell className="text-center border-l text-green-600">{data.paid_flats}</TableCell>
                                <TableCell className="text-center text-red-600">{data.pending_flats}</TableCell>
                              </>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell>{TOTAL_FLATS_IN_COMPLEX}</TableCell>
                      {getCalendarYearAndMonths().months.map(m => {
                        const totalPaid = Object.values(camData).reduce((sum, tData) => sum + (tData[m]?.paid_flats || 0), 0);
                        const totalPending = Object.values(camData).reduce((sum, tData) => sum + (tData[m]?.pending_flats || 0), 0);
                        return (
                          <>
                            <TableCell className="text-center border-l text-green-600">{totalPaid}</TableCell>
                            <TableCell className="text-center text-red-600">{totalPending}</TableCell>
                          </>
                        );
                      })}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <QuarterlySummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuarterlySummary() {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<CAMData[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const years = Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i);

  useEffect(() => {
    fetchSummary();
  }, [selectedYear]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      // Fetch data for the fiscal year (Apr of selectedYear to Mar of selectedYear + 1)
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .or(`and(year.eq.${selectedYear},month.gte.4),and(year.eq.${selectedYear + 1},month.lte.3)`);

      if (error) throw error;
      setSummaryData(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch summary: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getQuarterTotals = (quarter: number) => {
    const quarterConfig = FISCAL_QUARTERS.find(q => q.value === quarter);
    if (!quarterConfig) return { paid: 0, pending: 0, duesCleared: 0, advance: 0, total: TOTAL_FLATS_IN_COMPLEX };

    const qData = summaryData.filter(d => quarterConfig.months.includes(d.month || 0));

    // For total flats, we shouldn't sum them up across months, as it's the same flats.
    // But paid/pending are cumulative? 
    // Wait, if I pay for April and May, my total paid is sum of both.
    // Total flats for the quarter? 
    // Usually "Total Flats" is constant for the complex.
    // But if we are showing "Collection Rate", it should be (Total Paid / (Total Flats * 3))?
    // Or is it (Total Paid / Total Demand)?
    // Total Demand for a quarter = Total Flats * 3 (if monthly billing).
    // Let's assume Total Demand = Total Flats * 3.

    const totalDemand = TOTAL_FLATS_IN_COMPLEX * 3;

    return {
      paid: qData.reduce((sum, d) => sum + d.paid_flats, 0),
      pending: qData.reduce((sum, d) => sum + d.pending_flats, 0),
      duesCleared: qData.reduce((sum, d) => sum + (d.dues_cleared_from_previous || 0), 0),
      advance: qData.reduce((sum, d) => sum + (d.advance_payments || 0), 0),
      total: totalDemand
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={String(year)}>FY {year}-{year + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FISCAL_QUARTERS.map(q => {
          const totals = getQuarterTotals(q.value);
          return (
            <Card key={q.value}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{q.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Demand (3 months):</span>
                  <span className="font-medium">{totals.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="font-medium text-green-600">{totals.paid}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-medium text-red-600">{totals.pending}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dues Cleared:</span>
                  <span className="font-medium text-blue-600">{totals.duesCleared}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Advance Paid:</span>
                  <span className="font-medium text-purple-600">{totals.advance}</span>
                </div>
                {totals.paid > 0 && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Collection Rate</div>
                    <div className="text-lg font-bold">
                      {((totals.paid / totals.total) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tower-wise Quarterly Comparison - Pending Flats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tower</TableHead>
                  <TableHead className="text-center">Total Flats</TableHead>
                  {FISCAL_QUARTERS.map(q => (
                    <TableHead key={q.value} className="text-center">{q.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {TOWERS.map(tower => (
                  <TableRow key={tower}>
                    <TableCell className="font-medium">{tower}</TableCell>
                    <TableCell className="text-center">{TOWER_TOTAL_FLATS[tower]}</TableCell>
                    {FISCAL_QUARTERS.map(q => {
                      const qMonths = q.months;
                      const towerData = summaryData.filter(d => d.tower === tower && qMonths.includes(d.month || 0));
                      const totalPending = towerData.reduce((sum, d) => sum + d.pending_flats, 0);

                      // Note: Summing pending flats across months might be misleading if it's the same flat pending for 3 months.
                      // But "Pending Flats" usually means "Number of flats that haven't paid for this month".
                      // So if Flat 101 didn't pay for Apr, May, Jun -> it contributes 1 to each month's pending count.
                      // So Sum is correct for "Total Pending Instances".

                      return (
                        <TableCell key={q.value} className="text-center">
                          <span className={totalPending > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                            {totalPending}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
