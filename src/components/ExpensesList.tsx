import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Edit, Loader2 } from 'lucide-react';
import { ExpenseRequestCorrectionDialog } from './ExpenseRequestCorrectionDialog';

interface Expense {
  id: string;
  description: string;
  amount: number;
  gst_amount: number;
  status: string;
  expense_date: string;
  created_at: string;
  budget_master: {
    item_name: string;
    category: string;
  } | null;
}

export function ExpensesList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const { toast } = useToast();
  const { userRole } = useAuth();

  useEffect(() => {
    loadExpenses();
  }, [filterStatus]);

  const loadExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          gst_amount,
          status,
          expense_date,
          created_at,
          budget_master!expenses_budget_master_id_fkey (
            item_name,
            category
          )
        `)
        .eq('claimed_by', user.id);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

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

  const handleRequestCorrection = (expense: Expense) => {
    setSelectedExpense(expense);
    setCorrectionDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      correction_pending: { variant: 'secondary', label: 'Correction Pending' },
      correction_approved: { variant: 'default', label: 'Can Edit' },
    };

    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Your Expenses</h2>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No expenses found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {expenses.map((expense) => (
            <Card key={expense.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg">{expense.description}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {expense.budget_master?.item_name || 'N/A'} • {new Date(expense.expense_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold">{formatCurrency(expense.amount + expense.gst_amount)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Base: {formatCurrency(expense.amount)}
                    </div>
                    {getStatusBadge(expense.status)}
                  </div>
                </div>
              </CardHeader>
              {expense.status === 'approved' && userRole === 'accountant' && (
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRequestCorrection(expense)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Request Correction
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {selectedExpense && (
        <ExpenseRequestCorrectionDialog
          expenseId={selectedExpense.id}
          expenseDescription={selectedExpense.description}
          open={correctionDialogOpen}
          onOpenChange={setCorrectionDialogOpen}
          onSuccess={loadExpenses}
        />
      )}
    </div>
  );
}
