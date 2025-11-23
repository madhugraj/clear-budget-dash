import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText } from 'lucide-react';

interface BudgetItem {
  id: string;
  category: string;
  allocated_amount: number;
  fiscal_year: number;
}

export default function Expenses() {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [selectedBudgetItem, setSelectedBudgetItem] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadBudgetItems();
  }, []);

  const loadBudgetItems = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('fiscal_year', currentYear)
        .order('category');

      if (error) throw error;
      setBudgetItems(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading budget items',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInvoice(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let invoiceUrl = null;

      // Upload invoice if provided
      if (invoice) {
        const fileExt = invoice.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('invoices')
          .upload(fileName, invoice);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('invoices')
          .getPublicUrl(fileName);

        invoiceUrl = publicUrl;
      }

      // Insert expense
      const { error } = await supabase
        .from('expenses')
        .insert({
          budget_item_id: selectedBudgetItem,
          amount: parseFloat(amount),
          description,
          expense_date: expenseDate,
          invoice_url: invoiceUrl,
          claimed_by: user.id,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Expense claim submitted for approval',
      });

      // Reset form
      setSelectedBudgetItem('');
      setAmount('');
      setDescription('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setInvoice(null);
      const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      toast({
        title: 'Error submitting expense',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Add Expense</h1>
        <p className="text-muted-foreground mt-2">
          Submit a new expense claim for approval
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
          <CardDescription>
            Fill in the expense information and upload supporting documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="budget-category">Budget Category</Label>
              <Select value={selectedBudgetItem} onValueChange={setSelectedBudgetItem} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {budgetItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.category} - ₹{item.allocated_amount.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-date">Expense Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the expense in detail..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-upload">Invoice/Bill (Optional)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="invoice-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleInvoiceChange}
                  className="cursor-pointer"
                />
                {invoice && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{invoice.name}</span>
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Expense
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
