import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Expense {
  id: string;
  description: string;
  amount: number;
  gst_amount: number;
  tds_percentage: number;
  tds_amount: number;
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
  const [processing, setProcessing] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [selectedCorrectionIds, setSelectedCorrectionIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      const { data: pending, error: pendingError } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          gst_amount,
          tds_percentage,
          tds_amount,
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

      const { data: corrections, error: correctionsError } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          gst_amount,
          tds_percentage,
          tds_amount,
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

    supabase.functions.invoke('send-expense-notification', {
      body: { expenseId, action: 'approved' }
    }).catch(err => console.error('Email failed:', err));
  };

  const handleBulkApprove = async (expenseIds: string[]) => {
    setProcessing(true);
    try {
      for (const expenseId of expenseIds) {
        await handleApprove(expenseId);
      }

      toast({
        title: 'Expenses approved',
        description: `${expenseIds.length} expense(s) approved successfully`,
      });

      setSelectedPendingIds(new Set());
      await loadApprovals();
    } catch (error: any) {
      toast({
        title: 'Error approving expenses',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (expenseId: string) => {
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

    supabase.functions.invoke('send-expense-notification', {
      body: { expenseId, action: 'rejected' }
    }).catch(err => console.error('Email failed:', err));
  };

  const handleBulkReject = async (expenseIds: string[]) => {
    setProcessing(true);
    try {
      for (const expenseId of expenseIds) {
        await handleReject(expenseId);
      }

      toast({
        title: 'Expenses rejected',
        description: `${expenseIds.length} expense(s) rejected`,
        variant: 'destructive',
      });

      setSelectedPendingIds(new Set());
      await loadApprovals();
    } catch (error: any) {
      toast({
        title: 'Error rejecting expenses',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveCorrection = async (expenseId: string) => {
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

    supabase.functions.invoke('send-expense-notification', {
      body: { expenseId, action: 'correction_approved' }
    }).catch(err => console.error('Email failed:', err));
  };

  const handleBulkApproveCorrections = async (expenseIds: string[]) => {
    setProcessing(true);
    try {
      for (const expenseId of expenseIds) {
        await handleApproveCorrection(expenseId);
      }

      toast({
        title: 'Corrections approved',
        description: `${expenseIds.length} correction(s) approved successfully`,
      });

      setSelectedCorrectionIds(new Set());
      await loadApprovals();
    } catch (error: any) {
      toast({
        title: 'Error approving corrections',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectCorrection = async (expenseId: string) => {
    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'approved',
        correction_reason: null,
        correction_requested_at: null,
      })
      .eq('id', expenseId);

    if (error) throw error;

    supabase.functions.invoke('send-expense-notification', {
      body: { expenseId, action: 'correction_rejected' }
    }).catch(err => console.error('Email failed:', err));
  };

  const handleBulkRejectCorrections = async (expenseIds: string[]) => {
    setProcessing(true);
    try {
      for (const expenseId of expenseIds) {
        await handleRejectCorrection(expenseId);
      }

      toast({
        title: 'Corrections rejected',
        description: `${expenseIds.length} correction(s) rejected`,
        variant: 'destructive',
      });

      setSelectedCorrectionIds(new Set());
      await loadApprovals();
    } catch (error: any) {
      toast({
        title: 'Error rejecting corrections',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const togglePendingSelection = (id: string) => {
    const newSet = new Set(selectedPendingIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPendingIds(newSet);
  };

  const toggleCorrectionSelection = (id: string) => {
    const newSet = new Set(selectedCorrectionIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCorrectionIds(newSet);
  };

  const selectAllPending = () => {
    setSelectedPendingIds(new Set(pendingExpenses.map(e => e.id)));
  };

  const deselectAllPending = () => {
    setSelectedPendingIds(new Set());
  };

  const selectAllCorrections = () => {
    setSelectedCorrectionIds(new Set(correctionRequests.map(e => e.id)));
  };

  const deselectAllCorrections = () => {
    setSelectedCorrectionIds(new Set());
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

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pending">
            Pending ({pendingExpenses.length})
          </TabsTrigger>
          <TabsTrigger value="corrections">
            Corrections ({correctionRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Expense Approvals</CardTitle>
              <CardDescription>New expense claims awaiting approval</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingExpenses.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No pending approvals
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllPending}
                        disabled={processing}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deselectAllPending}
                        disabled={processing || selectedPendingIds.size === 0}
                      >
                        Deselect All
                      </Button>
                    </div>
                    {selectedPendingIds.size > 0 && (
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBulkReject(Array.from(selectedPendingIds))}
                          disabled={processing}
                        >
                          {processing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Reject ({selectedPendingIds.size})
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleBulkApprove(Array.from(selectedPendingIds))}
                          disabled={processing}
                        >
                          {processing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Approve ({selectedPendingIds.size})
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Claimed By</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Net Payment</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingExpenses.map((expense) => {
                          const grossAmount = Number(expense.amount) + Number(expense.gst_amount);
                          const netPayment = grossAmount - Number(expense.tds_amount || 0);
                          
                          return (
                            <TableRow key={expense.id} className={cn(selectedPendingIds.has(expense.id) && "bg-muted/50")}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedPendingIds.has(expense.id)}
                                  onCheckedChange={() => togglePendingSelection(expense.id)}
                                  disabled={processing}
                                />
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {new Date(expense.expense_date).toLocaleDateString('en-IN')}
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {expense.budget_master?.item_name || 'N/A'}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">
                                {expense.description}
                              </TableCell>
                              <TableCell className="text-sm">
                                {expense.profiles?.full_name || expense.profiles?.email}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                <div className="font-medium">{formatCurrency(grossAmount)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Base: {formatCurrency(expense.amount)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-bold text-sm">
                                {formatCurrency(netPayment)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {expense.invoice_url && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(expense.invoice_url!, '_blank')}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedExpense(expense)}
                                  >
                                    View
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corrections" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Correction Requests</CardTitle>
              <CardDescription>Accountants requesting to correct approved expenses</CardDescription>
            </CardHeader>
            <CardContent>
              {correctionRequests.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No correction requests
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllCorrections}
                        disabled={processing}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deselectAllCorrections}
                        disabled={processing || selectedCorrectionIds.size === 0}
                      >
                        Deselect All
                      </Button>
                    </div>
                    {selectedCorrectionIds.size > 0 && (
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBulkRejectCorrections(Array.from(selectedCorrectionIds))}
                          disabled={processing}
                        >
                          {processing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Reject ({selectedCorrectionIds.size})
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleBulkApproveCorrections(Array.from(selectedCorrectionIds))}
                          disabled={processing}
                        >
                          {processing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Approve ({selectedCorrectionIds.size})
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {correctionRequests.map((expense) => {
                          const grossAmount = Number(expense.amount) + Number(expense.gst_amount);
                          
                          return (
                            <TableRow key={expense.id} className={cn(selectedCorrectionIds.has(expense.id) && "bg-orange-50/50")}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedCorrectionIds.has(expense.id)}
                                  onCheckedChange={() => toggleCorrectionSelection(expense.id)}
                                  disabled={processing}
                                />
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {new Date(expense.expense_date).toLocaleDateString('en-IN')}
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {expense.budget_master?.item_name || 'N/A'}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">
                                {expense.description}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">
                                {expense.correction_reason || 'N/A'}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                <div className="font-medium">{formatCurrency(grossAmount)}</div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {expense.invoice_url && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(expense.invoice_url!, '_blank')}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedExpense(expense)}
                                  >
                                    View
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>Complete information about this expense claim</DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedExpense.description}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(selectedExpense.expense_date).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Budget Item</p>
                  <p className="font-medium">{selectedExpense.budget_master?.item_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium">{selectedExpense.budget_master?.category || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Base Amount</p>
                  <p className="font-medium">{formatCurrency(selectedExpense.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GST Amount</p>
                  <p className="font-medium">{formatCurrency(selectedExpense.gst_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">TDS ({selectedExpense.tds_percentage}%)</p>
                  <p className="font-medium">{formatCurrency(selectedExpense.tds_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Payment</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(selectedExpense.amount) + Number(selectedExpense.gst_amount) - Number(selectedExpense.tds_amount || 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Claimed By</p>
                  <p className="font-medium">{selectedExpense.profiles?.full_name || selectedExpense.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge>{selectedExpense.status}</Badge>
                </div>
              </div>
              {selectedExpense.correction_reason && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="font-medium text-orange-900 mb-2">Correction Reason:</p>
                  <p className="text-sm">{selectedExpense.correction_reason}</p>
                </div>
              )}
              {selectedExpense.invoice_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedExpense.invoice_url!, '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Invoice
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
