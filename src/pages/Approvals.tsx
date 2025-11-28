import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertCircle, FileText, History, Edit } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

interface Income {
  id: string;
  fiscal_year: string;
  month: number;
  actual_amount: number;
  gst_amount: number;
  notes: string | null;
  status: string;
  created_at: string;
  income_categories: {
    category_name: string;
    subcategory_name: string | null;
  } | null;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function Approvals() {
  const [pendingExpenses, setPendingExpenses] = useState<Expense[]>([]);
  const [pendingIncome, setPendingIncome] = useState<Income[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<Expense[]>([]);

  // Historical Data State
  const [historicalExpenses, setHistoricalExpenses] = useState<Expense[]>([]);
  const [historicalIncome, setHistoricalIncome] = useState<Income[]>([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
  const [selectedCorrectionIds, setSelectedCorrectionIds] = useState<Set<string>>(new Set());
  const [correctionReason, setCorrectionReason] = useState('');
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');
  const { toast } = useToast();

  useEffect(() => {
    loadApprovals();

    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      loadApprovals();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'historical') {
      loadHistoricalData();
    }
  }, [activeTab]);

  const loadApprovals = async () => {
    try {
      // Fetch pending expenses
      const { data: pending, error: pendingError } = await supabase
        .from('expenses')
        .select(`
          *,
          budget_master (
            item_name,
            category,
            committee,
            annual_budget
          ),
          profiles (full_name, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // Fetch pending income
      const { data: pendingIncomeData, error: incomeError } = await supabase
        .from('income_actuals')
        .select(`
          *,
          income_categories (
            category_name,
            subcategory_name
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (incomeError) throw incomeError;

      // Fetch profile details separately for income
      const incomeWithProfiles = await Promise.all(
        (pendingIncomeData || []).map(async (income) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', income.recorded_by)
            .single();

          return {
            ...income,
            profiles: profile || { full_name: 'Unknown', email: '' }
          };
        })
      );

      // Fetch correction requests
      const { data: corrections, error: correctionsError } = await supabase
        .from('expenses')
        .select(`
          *,
          budget_master (
            item_name,
            category,
            committee,
            annual_budget
          ),
          profiles (full_name, email)
        `)
        .eq('status', 'correction_pending')
        .order('created_at', { ascending: false });

      if (correctionsError) throw correctionsError;

      setPendingExpenses(pending || []);
      setPendingIncome(incomeWithProfiles as Income[] || []);
      setCorrectionRequests(corrections || []);

    } catch (error: any) {
      console.error('Error loading approvals:', error);
      toast({
        title: 'Error loading approvals',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    try {
      // Fetch historical expenses (approved or paid)
      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select(`
          *,
          budget_master (item_name, category),
          profiles (full_name)
        `)
        .in('status', ['approved', 'paid'])
        .order('expense_date', { ascending: false })
        .limit(50);

      if (expError) throw expError;

      // Fetch historical income (approved)
      const { data: income, error: incError } = await supabase
        .from('income_actuals')
        .select(`
          *,
          income_categories (category_name)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50);

      if (incError) throw incError;

      // Map profiles for income
      const incomeWithProfiles = await Promise.all(
        (income || []).map(async (inc) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', inc.recorded_by)
            .single();
          return { ...inc, profiles: profile || { full_name: 'Unknown', email: '' } };
        })
      );

      setHistoricalExpenses(expenses || []);
      setHistoricalIncome(incomeWithProfiles as Income[] || []);

    } catch (error: any) {
      toast({
        title: 'Error loading history',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (expenseId: string) => {
    setProcessing(true);
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
        description: 'The expense has been successfully approved.',
      });

      loadApprovals();
      setSelectedExpense(null);
    } catch (error: any) {
      toast({
        title: 'Error approving expense',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (expenseId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'rejected',
        })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Expense rejected',
        description: 'The expense has been rejected.',
      });

      loadApprovals();
      setSelectedExpense(null);
    } catch (error: any) {
      toast({
        title: 'Error rejecting expense',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestCorrection = async (expenseId: string, reason: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'correction_pending',
          correction_reason: reason,
          correction_requested_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Correction requested',
        description: 'The expense has been sent back for correction.',
      });

      setIsCorrectionDialogOpen(false);
      setCorrectionReason('');
      loadApprovals();
      setSelectedExpense(null);
    } catch (error: any) {
      toast({
        title: 'Error requesting correction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveCorrection = async (expenseId: string) => {
    setProcessing(true);
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

      toast({
        title: 'Correction approved',
        description: 'The accountant can now edit the expense.',
      });

      loadApprovals();
    } catch (error: any) {
      toast({
        title: 'Error approving correction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveIncome = async (incomeId: string) => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('income_actuals')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', incomeId);

      if (error) throw error;

      toast({
        title: 'Income approved',
        description: 'The income record has been successfully approved.',
      });

      loadApprovals();
      setSelectedIncome(null);
    } catch (error: any) {
      toast({
        title: 'Error approving income',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectIncome = async (incomeId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('income_actuals')
        .update({
          status: 'rejected',
        })
        .eq('id', incomeId);

      if (error) throw error;

      toast({
        title: 'Income rejected',
        description: 'The income record has been rejected.',
      });

      loadApprovals();
      setSelectedIncome(null);
    } catch (error: any) {
      toast({
        title: 'Error rejecting income',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
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
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Manage pending approvals for expenses and income
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="expenses">
            Expenses ({pendingExpenses.length})
          </TabsTrigger>
          <TabsTrigger value="income">
            Income ({pendingIncome.length})
          </TabsTrigger>
          <TabsTrigger value="corrections">
            Corrections ({correctionRequests.length})
          </TabsTrigger>
          <TabsTrigger value="historical">
            Historical Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Expenses</CardTitle>
              <CardDescription>Review and approve expense claims</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingExpenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending expenses
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{expense.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {expense.profiles.full_name} • {new Date(expense.expense_date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {expense.budget_master?.item_name} ({expense.budget_master?.category})
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(expense.amount + expense.gst_amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            Base: {formatCurrency(expense.amount)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedExpense(expense)}>
                            View
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(expense.id)}>
                            Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Income</CardTitle>
              <CardDescription>Review and approve income records</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingIncome.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending income records
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingIncome.map((income) => (
                    <div
                      key={income.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">
                          {income.income_categories?.category_name}
                          {income.income_categories?.subcategory_name && ` - ${income.income_categories.subcategory_name}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {income.profiles.full_name} • {new Date(income.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {income.notes}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(income.actual_amount + income.gst_amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            Base: {formatCurrency(income.actual_amount)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedIncome(income)}>
                            View
                          </Button>
                          <Button size="sm" onClick={() => handleApproveIncome(income.id)}>
                            Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corrections" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Correction Requests</CardTitle>
              <CardDescription>Review expenses returned for correction</CardDescription>
            </CardHeader>
            <CardContent>
              {correctionRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending correction requests
                </div>
              ) : (
                <div className="space-y-4">
                  {correctionRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{request.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {request.profiles.full_name} • {new Date(request.expense_date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Reason: {request.correction_reason}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(request.amount + request.gst_amount)}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedExpense(request)}>
                            View
                          </Button>
                          <Button size="sm" onClick={() => handleApproveCorrection(request.id)}>
                            Approve Correction
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historical" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Historical Data</CardTitle>
              <CardDescription>View past approved income and expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Expense History
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Claimed By</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historicalExpenses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                              No historical expenses found
                            </TableCell>
                          </TableRow>
                        ) : (
                          historicalExpenses.map((expense) => (
                            <TableRow key={expense.id}>
                              <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                              <TableCell>{expense.description}</TableCell>
                              <TableCell>{expense.budget_master?.category}</TableCell>
                              <TableCell>{expense.profiles.full_name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(expense.amount + expense.gst_amount)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <History className="h-5 w-5" /> Income History
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Recorded By</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historicalIncome.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                              No historical income found
                            </TableCell>
                          </TableRow>
                        ) : (
                          historicalIncome.map((income) => (
                            <TableRow key={income.id}>
                              <TableCell>{new Date(income.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>{income.income_categories?.category_name}</TableCell>
                              <TableCell>{income.profiles.full_name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(income.actual_amount + income.gst_amount)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Petty Cash History
                  </h3>
                  <div className="rounded-md border p-8 text-center text-muted-foreground">
                    Petty cash data is not yet available.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Expense Details Dialog */}
      <Dialog open={!!selectedExpense && !isCorrectionDialogOpen} onOpenChange={(open) => !open && setSelectedExpense(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>Review expense details and attachments</DialogDescription>
          </DialogHeader>

          {selectedExpense && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <div className="font-medium">{selectedExpense.description}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <div className="font-medium">{formatCurrency(selectedExpense.amount + selectedExpense.gst_amount)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <div className="font-medium">{selectedExpense.budget_master?.category}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <div className="font-medium">{new Date(selectedExpense.expense_date).toLocaleDateString()}</div>
                </div>
                {selectedExpense.correction_reason && (
                  <div className="col-span-2 bg-red-50 p-3 rounded-md border border-red-100">
                    <Label className="text-red-600">Correction Reason</Label>
                    <div className="text-red-700">{selectedExpense.correction_reason}</div>
                  </div>
                )}
              </div>

              {selectedExpense.invoice_url && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Invoice/Receipt</Label>
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border">
                    <a
                      href={selectedExpense.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      View Invoice
                    </a>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                {selectedExpense.status === 'pending' && (
                  <>
                    <Button variant="outline" onClick={() => setIsCorrectionDialogOpen(true)}>
                      Request Correction
                    </Button>
                    <Button variant="destructive" onClick={() => handleReject(selectedExpense.id)}>
                      Reject
                    </Button>
                    <Button onClick={() => handleApprove(selectedExpense.id)}>
                      Approve
                    </Button>
                  </>
                )}
                {selectedExpense.status === 'correction_pending' && (
                  <Button onClick={() => handleApproveCorrection(selectedExpense.id)}>
                    Approve Correction Request
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Correction Request Dialog */}
      <Dialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Correction</DialogTitle>
            <DialogDescription>
              Please specify the reason for requesting a correction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter correction reason..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCorrectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedExpense && handleRequestCorrection(selectedExpense.id, correctionReason)}
              disabled={!correctionReason.trim()}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Income Details Dialog */}
      <Dialog open={!!selectedIncome} onOpenChange={(open) => !open && setSelectedIncome(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Income Details</DialogTitle>
            <DialogDescription>Review income record details</DialogDescription>
          </DialogHeader>

          {selectedIncome && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <div className="font-medium">{selectedIncome.income_categories?.category_name}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <div className="font-medium">{formatCurrency(selectedIncome.actual_amount + selectedIncome.gst_amount)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Recorded By</Label>
                  <div className="font-medium">{selectedIncome.profiles.full_name}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <div className="font-medium">{new Date(selectedIncome.created_at).toLocaleDateString()}</div>
                </div>
                {selectedIncome.notes && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Notes</Label>
                    <div className="mt-1">{selectedIncome.notes}</div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="destructive" onClick={() => handleRejectIncome(selectedIncome.id)}>
                  Reject
                </Button>
                <Button onClick={() => handleApproveIncome(selectedIncome.id)}>
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
