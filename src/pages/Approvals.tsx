import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface Expense {
  id: string;
  description: string;
  amount: number;
  gst_amount: number;
  status: string;
  expense_date: string;
  invoice_url: string | null;
  created_at: string;
  correction_reason: string | null;
  budget_master: {
    item_name: string;
    category: string;
    committee: string;
    annual_budget: number;
  } | null;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function Approvals() {
  const [pendingExpenses, setPendingExpenses] = useState<Expense[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      // Load pending approvals
      const { data: pending, error: pendingError } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          gst_amount,
          status,
          expense_date,
          invoice_url,
          created_at,
          correction_reason,
          budget_master!expenses_budget_master_id_fkey (
            item_name,
            category,
            committee,
            annual_budget
          ),
          profiles!expenses_claimed_by_fkey (full_name, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // Load correction requests
      const { data: corrections, error: correctionsError } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          gst_amount,
          status,
          expense_date,
          invoice_url,
          created_at,
          correction_reason,
          budget_master!expenses_budget_master_id_fkey (
            item_name,
            category,
            committee,
            annual_budget
          ),
          profiles!expenses_claimed_by_fkey (full_name, email)
        `)
        .eq('status', 'correction_pending')
        .order('created_at', { ascending: false });

      if (correctionsError) throw correctionsError;

      setPendingExpenses(pending || []);
      setCorrectionRequests(corrections || []);
    } catch (error: any) {
      toast({
        title: 'Error loading approvals',
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

      // Send email notification
      supabase.functions.invoke('send-expense-notification', {
        body: { expenseId, action: 'approved' }
      }).then(() => console.log('Approval email sent')).catch(err => console.error('Email failed:', err));

      toast({
        title: 'Expense approved',
        description: 'The expense has been approved successfully',
      });

      // Reload approvals
      await loadApprovals();
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

      // Send email notification
      supabase.functions.invoke('send-expense-notification', {
        body: { expenseId, action: 'rejected' }
      }).then(() => console.log('Rejection email sent')).catch(err => console.error('Email failed:', err));

      toast({
        title: 'Expense rejected',
        description: 'The expense has been rejected',
        variant: 'destructive',
      });

      // Reload approvals
      await loadApprovals();
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

  const handleApproveCorrection = async (expenseId: string) => {
    setProcessingId(expenseId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'correction_approved',
          approved_by: user.id,
          correction_approved_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;

      // Send notification to accountant
      supabase.functions.invoke('send-expense-notification', {
        body: { expenseId, action: 'correction_approved' }
      }).then(() => console.log('Correction approval email sent')).catch(err => console.error('Email failed:', err));

      toast({
        title: 'Correction approved',
        description: 'The accountant can now edit this expense',
      });

      // Reload approvals
      await loadApprovals();
    } catch (error: any) {
      toast({
        title: 'Error approving correction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectCorrection = async (expenseId: string) => {
    setProcessingId(expenseId);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'approved', // Back to approved
          correction_reason: null,
          correction_requested_at: null,
        })
        .eq('id', expenseId);

      if (error) throw error;

      // Send notification to accountant
      supabase.functions.invoke('send-expense-notification', {
        body: { expenseId, action: 'correction_rejected' }
      }).then(() => console.log('Correction rejection email sent')).catch(err => console.error('Email failed:', err));

      toast({
        title: 'Correction rejected',
        description: 'The expense will remain as-is',
      });

      // Reload approvals
      await loadApprovals();
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
        <h1 className="text-3xl font-bold">Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve expense claims and correction requests
        </p>
      </div>

      {/* Correction Requests Section */}
      {correctionRequests.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Correction Requests</h2>
            <p className="text-sm text-muted-foreground">Accountants requesting to correct approved expenses</p>
          </div>
          <div className="grid gap-4">
            {correctionRequests.map((expense) => (
              <Card key={expense.id} className="border-orange-200 bg-orange-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <CardTitle className="text-lg">{expense.description}</CardTitle>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{expense.budget_master?.item_name || 'N/A'}</span>
                          <span>•</span>
                          <span>{expense.budget_master?.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>By {expense.profiles?.full_name || expense.profiles?.email}</span>
                        </div>
                        {expense.correction_reason && (
                          <div className="mt-2 p-3 bg-white border border-orange-200 rounded">
                            <p className="font-medium text-orange-900">Reason for Correction:</p>
                            <p className="text-sm mt-1">{expense.correction_reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold">{formatCurrency(Number(expense.amount + expense.gst_amount))}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Base: {formatCurrency(expense.amount)}<br />
                        GST: {formatCurrency(expense.gst_amount)}
                      </div>
                      <Badge className="mt-2 bg-orange-500">Correction Request</Badge>
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
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRejectCorrection(expense.id)}
                        disabled={processingId === expense.id}
                      >
                        {processingId === expense.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject Request
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveCorrection(expense.id)}
                        disabled={processingId === expense.id}
                      >
                        {processingId === expense.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve Correction
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Separator className="my-6" />
        </div>
      )}

      {/* Regular Pending Approvals Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Pending Expense Approvals</h2>
          <p className="text-sm text-muted-foreground">New expense claims awaiting approval</p>
        </div>
        {pendingExpenses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No pending approvals</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingExpenses.map((expense) => (
            <Card key={expense.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <CardTitle className="text-lg">{expense.description}</CardTitle>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{expense.budget_master?.item_name || 'N/A'}</span>
                        <span>•</span>
                        <span>{expense.budget_master?.category}</span>
                        <span>•</span>
                        <span>{expense.budget_master?.committee}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>By {expense.profiles?.full_name || expense.profiles?.email}</span>
                      </div>
                    </div>
                  </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold">{formatCurrency(Number(expense.amount + expense.gst_amount))}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Base: {formatCurrency(expense.amount)}<br />
                        GST: {formatCurrency(expense.gst_amount)}
                      </div>
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
      </div>

      <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>Complete information about this expense claim</DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Budget Item</label>
                <p className="mt-1 font-medium">{selectedExpense.budget_master?.item_name || 'N/A'}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedExpense.budget_master?.category} • {selectedExpense.budget_master?.committee}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="mt-1">{selectedExpense.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="mt-1 font-semibold">{formatCurrency(Number(selectedExpense.amount + selectedExpense.gst_amount))}</p>
                  <p className="text-xs text-muted-foreground">Base: {formatCurrency(selectedExpense.amount)} + GST: {formatCurrency(selectedExpense.gst_amount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Budget</label>
                  <p className="mt-1">{formatCurrency(Number(selectedExpense.budget_master?.annual_budget || 0))}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expense Date</label>
                  <p className="mt-1">{new Date(selectedExpense.expense_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                  <p className="mt-1">{new Date(selectedExpense.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Claimed By</label>
                <p className="mt-1">{selectedExpense.profiles?.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedExpense.profiles?.email}</p>
              </div>
              {selectedExpense.invoice_url && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Invoice</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 w-full"
                    onClick={() => window.open(selectedExpense.invoice_url!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Invoice
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
