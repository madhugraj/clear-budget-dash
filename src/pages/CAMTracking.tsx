import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Save, Upload, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as XLSX from 'xlsx';

const TOWERS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
  '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
  '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

const QUARTERS = [
  { value: 1, label: 'Q1 (Jan-Mar)' },
  { value: 2, label: 'Q2 (Apr-Jun)' },
  { value: 3, label: 'Q3 (Jul-Sep)' },
  { value: 4, label: 'Q4 (Oct-Dec)' }
];

interface CAMData {
  id?: string;
  tower: string;
  year: number;
  quarter: number;
  paid_flats: number;
  pending_flats: number;
  total_flats: number;
  notes?: string;
}

export default function CAMTracking() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [camData, setCamData] = useState<Record<string, CAMData>>({});
  const [existingData, setExistingData] = useState<CAMData[]>([]);

  const years = Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i);

  useEffect(() => {
    fetchCAMData();
  }, [selectedYear, selectedQuarter]);

  const fetchCAMData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('year', selectedYear)
        .eq('quarter', selectedQuarter);

      if (error) throw error;

      const dataMap: Record<string, CAMData> = {};
      TOWERS.forEach(tower => {
        const existing = data?.find(d => d.tower === tower);
        dataMap[tower] = existing || {
          tower,
          year: selectedYear,
          quarter: selectedQuarter,
          paid_flats: 0,
          pending_flats: 0,
          total_flats: 0
        };
      });
      setCamData(dataMap);
      setExistingData(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch CAM data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (tower: string, field: 'paid_flats' | 'pending_flats' | 'total_flats', value: string) => {
    const numValue = parseInt(value) || 0;
    setCamData(prev => ({
      ...prev,
      [tower]: {
        ...prev[tower],
        [field]: numValue
      }
    }));
  };

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const dataToUpsert = Object.values(camData).map(item => ({
        tower: item.tower,
        year: selectedYear,
        quarter: selectedQuarter,
        paid_flats: item.paid_flats,
        pending_flats: item.pending_flats,
        total_flats: item.total_flats,
        notes: item.notes || null,
        uploaded_by: user.id
      }));

      for (const item of dataToUpsert) {
        const existing = existingData.find(d => d.tower === item.tower);
        if (existing?.id) {
          const { error } = await supabase
            .from('cam_tracking')
            .update({
              paid_flats: item.paid_flats,
              pending_flats: item.pending_flats,
              total_flats: item.total_flats,
              notes: item.notes
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else if (item.paid_flats > 0 || item.pending_flats > 0 || item.total_flats > 0) {
          const { error } = await supabase
            .from('cam_tracking')
            .insert(item);
          if (error) throw error;
        }
      }

      toast.success('CAM data saved successfully');
      fetchCAMData();
    } catch (error: any) {
      toast.error('Failed to save CAM data: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

        const updatedData = { ...camData };
        jsonData.forEach(row => {
          const tower = String(row.Tower || row.tower || row.TOWER || '').toUpperCase();
          if (TOWERS.includes(tower)) {
            updatedData[tower] = {
              ...updatedData[tower],
              paid_flats: parseInt(row.Paid || row.paid || row.PAID || row['Paid Flats'] || 0),
              pending_flats: parseInt(row.Pending || row.pending || row.PENDING || row['Pending Flats'] || 0),
              total_flats: parseInt(row.Total || row.total || row.TOTAL || row['Total Flats'] || 0)
            };
          }
        });
        setCamData(updatedData);
        toast.success('File data loaded. Review and click Save to confirm.');
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast.error('Failed to parse file: ' + error.message);
    }
    event.target.value = '';
  };

  const getTotalPending = () => {
    return Object.values(camData).reduce((sum, item) => sum + item.pending_flats, 0);
  };

  const getTotalPaid = () => {
    return Object.values(camData).reduce((sum, item) => sum + item.paid_flats, 0);
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
          <p className="text-muted-foreground">Track Common Area Maintenance payments by tower</p>
        </div>
      </div>

      <Tabs defaultValue="entry" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entry">Data Entry</TabsTrigger>
          <TabsTrigger value="summary">Quarterly Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-lg">Tower-wise CAM Data</CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(Number(v))}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUARTERS.map(q => (
                        <SelectItem key={q.value} value={String(q.value)}>{q.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Excel/CSV
                    </Button>
                  </div>
                  <Button onClick={handleSaveAll} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[100px]">Tower</TableHead>
                      <TableHead className="w-[150px]">Total Flats</TableHead>
                      <TableHead className="w-[150px]">Paid Flats</TableHead>
                      <TableHead className="w-[150px]">Pending Flats</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TOWERS.map(tower => (
                      <TableRow key={tower}>
                        <TableCell className="font-medium">{tower}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={camData[tower]?.total_flats || ''}
                            onChange={(e) => handleInputChange(tower, 'total_flats', e.target.value)}
                            className="w-full"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={camData[tower]?.paid_flats || ''}
                            onChange={(e) => handleInputChange(tower, 'paid_flats', e.target.value)}
                            className="w-full"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={camData[tower]?.pending_flats || ''}
                            onChange={(e) => handleInputChange(tower, 'pending_flats', e.target.value)}
                            className="w-full"
                            placeholder="0"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell>{Object.values(camData).reduce((sum, d) => sum + d.total_flats, 0)}</TableCell>
                      <TableCell className="text-green-600">{getTotalPaid()}</TableCell>
                      <TableCell className="text-red-600">{getTotalPending()}</TableCell>
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
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('year', selectedYear)
        .order('quarter')
        .order('tower');

      if (error) throw error;
      setSummaryData(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch summary: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getQuarterData = (quarter: number) => {
    return summaryData.filter(d => d.quarter === quarter);
  };

  const getQuarterTotals = (quarter: number) => {
    const qData = getQuarterData(quarter);
    return {
      paid: qData.reduce((sum, d) => sum + d.paid_flats, 0),
      pending: qData.reduce((sum, d) => sum + d.pending_flats, 0),
      total: qData.reduce((sum, d) => sum + d.total_flats, 0)
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
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUARTERS.map(q => {
          const totals = getQuarterTotals(q.value);
          return (
            <Card key={q.value}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{q.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Flats:</span>
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
                {totals.total > 0 && (
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
          <CardTitle className="text-lg">Tower-wise Quarterly Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tower</TableHead>
                  {QUARTERS.map(q => (
                    <TableHead key={q.value} className="text-center">{q.label} Pending</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {TOWERS.map(tower => (
                  <TableRow key={tower}>
                    <TableCell className="font-medium">{tower}</TableCell>
                    {QUARTERS.map(q => {
                      const towerData = summaryData.find(d => d.tower === tower && d.quarter === q.value);
                      return (
                        <TableCell key={q.value} className="text-center">
                          {towerData?.pending_flats || '-'}
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
