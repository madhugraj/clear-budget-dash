import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Upload, FileText, Plus, Trash2, History, FileSpreadsheet } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface PettyCashItem {
    id: string;
    item_name: string;
    description: string;
    amount: number;
    bill_url: string | null;
    date: string;
    status: string;
    created_at: string;
}

export default function PettyCash() {
    const { userRole } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<PettyCashItem[]>([]);

    // Form states
    const [itemName, setItemName] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [bill, setBill] = useState<File | null>(null);

    // Historical Upload states
    const [historicalFile, setHistoricalFile] = useState<File | null>(null);
    const [historicalPreview, setHistoricalPreview] = useState<any[]>([]);
    const [uploadingHistorical, setUploadingHistorical] = useState(false);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        const { data, error } = await supabase
            .from('petty_cash')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching petty cash:', error);
        } else {
            setItems(data || []);
        }
    };

    const handleBillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setBill(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName || !amount || !date) {
            toast({ title: 'Missing fields', description: 'Please fill in all required fields', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            let billUrl = null;
            if (bill) {
                const fileExt = bill.name.split('.').pop();
                const fileName = `${user.id}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('petty-cash')
                    .upload(fileName, bill);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('petty-cash')
                    .getPublicUrl(fileName);
                billUrl = publicUrl;
            }

            const { error } = await supabase.from('petty_cash').insert({
                item_name: itemName,
                description,
                amount: parseFloat(amount),
                date,
                bill_url: billUrl,
                submitted_by: user.id,
                status: 'pending'
            });

            if (error) throw error;

            toast({ title: 'Success', description: 'Petty cash entry submitted for approval' });

            // Reset form
            setItemName('');
            setDescription('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setBill(null);
            const fileInput = document.getElementById('bill-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            fetchItems();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleHistoricalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setHistoricalFile(file);
            parseHistoricalFile(file);
        }
    };

    const parseHistoricalFile = async (file: File) => {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            setHistoricalPreview(jsonData);
        } catch (error) {
            toast({ title: 'Error parsing file', description: 'Could not read Excel file', variant: 'destructive' });
        }
    };

    const handleHistoricalUpload = async () => {
        if (!historicalPreview.length) return;
        setUploadingHistorical(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const entries = historicalPreview.map(row => ({
                item_name: row['Item Name'] || row['Item'] || 'Unknown',
                description: row['Description'] || '',
                amount: parseFloat(row['Amount'] || 0),
                date: row['Date'] ? new Date(row['Date']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                status: 'approved', // Historical data auto-approved? Or pending? User said "upload historical data... Post which through Add Petty cash". Usually historical is approved.
                submitted_by: user.id,
                approved_by: user.id // Auto-approve historical
            }));

            const { error } = await supabase.from('petty_cash').insert(entries);
            if (error) throw error;

            toast({ title: 'Success', description: `Uploaded ${entries.length} historical entries` });
            setHistoricalFile(null);
            setHistoricalPreview([]);
            fetchItems();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setUploadingHistorical(false);
        }
    };

    if (userRole !== 'lead' && userRole !== 'treasurer' && userRole !== 'accountant') {
        return <div className="p-8 text-center">You do not have permission to view this page.</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold">Petty Cash Management</h1>
                <p className="text-muted-foreground mt-2">Manage petty cash transactions</p>
            </div>

            <Tabs defaultValue="add" className="w-full">
                <TabsList>
                    <TabsTrigger value="add">Add Petty Cash</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    {userRole === 'lead' && <TabsTrigger value="upload">Upload Historical</TabsTrigger>}
                </TabsList>

                <TabsContent value="add" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>New Petty Cash Entry</CardTitle>
                            <CardDescription>Submit a new petty cash expense for approval</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="item-name">Item Name *</Label>
                                        <Input id="item-name" value={itemName} onChange={e => setItemName(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">Amount (₹) *</Label>
                                        <Input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="date">Date *</Label>
                                        <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bill-upload">Bill/Receipt</Label>
                                        <Input id="bill-upload" type="file" onChange={handleBillChange} />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
                                    </div>
                                </div>
                                <Button type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                    Submit for Approval
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Petty Cash History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Bill</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell>{item.item_name}</TableCell>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell className="text-right">₹{item.amount.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded text-xs capitalize ${item.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                        item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {item.bill_url && (
                                                    <a href={item.bill_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                                                        <FileText className="h-4 w-4 mr-1" /> View
                                                    </a>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="upload" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload Historical Data (Apr '25 - Oct '25)</CardTitle>
                            <CardDescription>Upload Excel/CSV file with columns: Item, Description, Amount, Date</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Input type="file" accept=".xlsx,.csv" onChange={handleHistoricalFileChange} />
                                <Button onClick={handleHistoricalUpload} disabled={!historicalFile || uploadingHistorical}>
                                    {uploadingHistorical ? <Loader2 className="animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Upload
                                </Button>
                            </div>
                            {historicalPreview.length > 0 && (
                                <div className="border rounded p-4 bg-muted/50">
                                    <p className="text-sm font-medium mb-2">Preview ({historicalPreview.length} entries)</p>
                                    <div className="max-h-60 overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Item</TableHead>
                                                    <TableHead>Amount</TableHead>
                                                    <TableHead>Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {historicalPreview.slice(0, 5).map((row, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>{row['Item Name'] || row['Item']}</TableCell>
                                                        <TableCell>{row['Amount']}</TableCell>
                                                        <TableCell>{row['Date']}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        {historicalPreview.length > 5 && <p className="text-xs text-muted-foreground mt-2">...and {historicalPreview.length - 5} more</p>}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
