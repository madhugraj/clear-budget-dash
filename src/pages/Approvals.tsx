import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Expense {
  id: string;
  description: string;
  amount: number;
  status: string;
  expense_date: string;
  invoice_url: string | null;
  budget_items: {
    category: string;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function Approvals() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPendingExpenses();
  }, []);

  const loadPendingExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          status,
          expense_date,
          invoice_url,
          budget_items (category),
          profiles!expenses_claimed_by_fkey (full_name, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading expenses',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (expenseId: string) => {
    setProcessingId(expenseId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_by: user.id,
        })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Expense approved',
        description: 'The expense has been approved successfully',
      });

      // Reload expenses
      await loadPendingExpenses();
    } catch (error: any) {
      toast({
        title: 'Error approving expense',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (expenseId: string) => {
    setProcessingId(expenseId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'rejected',
          approved_by: user.id,
        })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Expense rejected',
        description: 'The expense has been rejected',
        variant: 'destructive',
      });

      // Reload expenses
      await loadPendingExpenses();
    } catch (error: any) {
      toast({
        title: 'Error rejecting expense',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Pending Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve or reject expense claims
        </p>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No pending approvals</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {expenses.map((expense) => (
            <Card key={expense.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{expense.description}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{expense.budget_items?.category}</span>
                      <span>•</span>
                      <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>By {expense.profiles?.full_name || expense.profiles?.email}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{formatCurrency(Number(expense.amount))}</div>
                    <Badge variant="secondary" className="mt-1">Pending</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {expense.invoice_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(expense.invoice_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Invoice
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedExpense(expense)}
                  >
                    View Details
                  </Button>
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReject(expense.id)}
                      disabled={processingId === expense.id}
                    >
                      {processingId === expense.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(expense.id)}
                      disabled={processingId === expense.id}
                    >
                      {processingId === expense.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>Complete information about this expense claim</DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="mt-1">{selectedExpense.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="mt-1 font-semibold">{formatCurrency(Number(selectedExpense.amount))}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date</label>
                  <p className="mt-1">{new Date(selectedExpense.expense_date).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <p className="mt-1">{selectedExpense.budget_items?.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Claimed By</label>
                <p className="mt-1">{selectedExpense.profiles?.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedExpense.profiles?.email}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
