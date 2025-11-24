import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, History, Edit, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Expense {
  id: string;
  description: string;
  amount: number;
  gst_amount: number;
  status: string;
  expense_date: string;
  correction_reason: string | null;
  correction_requested_at: string | null;
  correction_approved_at: string | null;
  correction_completed_at: string | null;
  is_correction: boolean;
  budget_master: {
    id: string;
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

interface AuditLog {
  id: string;
  action: string;
  created_at: string;
  old_values: any;
  new_values: any;
  correction_type: string | null;
  performed_by: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function Corrections() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [editMode, setEditMode] = useState(false);
  
  // Edit form states
  const [editAmount, setEditAmount] = useState<string>('');
  const [editGstPercentage, setEditGstPercentage] = useState<number>(18);
  const [editGstAmount, setEditGstAmount] = useState<number>(0);
  const [editDescription, setEditDescription] = useState<string>('');
  const [editExpenseDate, setEditExpenseDate] = useState<string>('');
  const [editBudgetItem, setEditBudgetItem] = useState<string>('');
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();
  const { userRole } = useAuth();

  useEffect(() => {
    loadCorrections();
    loadBudgetItems();
  }, [filterStatus]);

  const loadBudgetItems = async () => {
    try {
      const { data, error } = await supabase
        .from('budget_master')
        .select('*')
        .eq('fiscal_year', 'FY25-26')
        .order('category, item_name');

      if (error) throw error;
      setBudgetItems(data || []);
    } catch (error: any) {
      console.error('Error loading budget items:', error);
    }
  };

  const loadCorrections = async () => {
    try {
      let query = supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          gst_amount,
          status,
          expense_date,
          correction_reason,
          correction_requested_at,
          correction_approved_at,
          correction_completed_at,
          is_correction,
          budget_master!expenses_budget_master_id_fkey (
            id,
            item_name,
            category,
            committee,
            annual_budget
          ),
          profiles!expenses_claimed_by_fkey (full_name, email)
        `);

      // Filter based on status
      if (filterStatus === 'pending') {
        query = query.eq('status', 'correction_pending');
      } else if (filterStatus === 'approved') {
        query = query.eq('status', 'correction_approved');
      } else if (filterStatus === 'completed') {
        query = query.eq('is_correction', true).eq('status', 'approved');
      } else if (filterStatus === 'all') {
        query = query.or('status.eq.correction_pending,status.eq.correction_approved,is_correction.eq.true');
      }

      const { data, error } = await query.order('correction_requested_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading corrections',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (expenseId: string) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, created_at, old_values, new_values, correction_type, performed_by')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profile data for each log entry
      const logsWithProfiles = await Promise.all(
        (data || []).map(async (log) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', log.performed_by)
            .single();
          
          return {
            ...log,
            profiles: profile || { full_name: 'Unknown', email: '' }
          };
        })
      );

      setAuditLogs(logsWithProfiles);
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
    }
  };

  const handleViewDetails = async (expense: Expense) => {
    setSelectedExpense(expense);
    await loadAuditLogs(expense.id);
    
    // Check if user can edit (accountant with correction_approved status)
    if (expense.status === 'correction_approved' && userRole === 'accountant') {
      setEditMode(true);
      setEditAmount(expense.amount.toString());
      setEditGstAmount(expense.gst_amount);
      setEditDescription(expense.description);
      setEditExpenseDate(expense.expense_date);
      setEditBudgetItem(expense.budget_master?.id || '');
      
      // Calculate GST percentage
      if (expense.amount > 0 && expense.gst_amount > 0) {
        const gstPct = (expense.gst_amount / expense.amount) * 100;
        setEditGstPercentage(Math.round(gstPct));
      }
    } else {
      setEditMode(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!selectedExpense) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('expenses')
        .update({
          amount: parseFloat(editAmount),
          gst_amount: editGstAmount,
          description: editDescription,
          expense_date: editExpenseDate,
          budget_master_id: editBudgetItem,
          status: 'approved', // Change back to approved after editing
          correction_completed_at: new Date().toISOString(),
          is_correction: true,
        })
        .eq('id', selectedExpense.id);

      if (error) throw error;

      // Send notification to treasurer
      supabase.functions.invoke('send-expense-notification', {
        body: { expenseId: selectedExpense.id, action: 'correction_completed' }
      }).then(() => console.log('Correction completion email sent')).catch(err => console.error('Email failed:', err));

      toast({
        title: 'Correction saved',
        description: 'The expense has been updated successfully',
      });

      setSelectedExpense(null);
      setEditMode(false);
      await loadCorrections();
    } catch (error: any) {
      toast({
        title: 'Error saving correction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Auto-calculate GST when amount or percentage changes
  useEffect(() => {
    if (editAmount && parseFloat(editAmount) > 0) {
      const baseAmount = parseFloat(editAmount);
      const gst = (baseAmount * editGstPercentage) / 100;
      setEditGstAmount(Math.round(gst * 100) / 100);
    }
  }, [editAmount, editGstPercentage]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (expense: Expense) => {
    if (expense.status === 'correction_pending') {
      return <Badge variant="secondary">Pending Approval</Badge>;
    } else if (expense.status === 'correction_approved') {
      return <Badge className="bg-orange-500">Awaiting Edit</Badge>;
    } else if (expense.is_correction) {
      return <Badge className="bg-blue-500">Completed</Badge>;
    }
    return <Badge>Unknown</Badge>;
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      'submitted': 'Submitted',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'correction_requested': 'Correction Requested',
      'correction_approved': 'Correction Approved',
      'correction_rejected': 'Correction Rejected',
      'correction_completed': 'Correction Completed',
      'correction_changes_applied': 'Changes Applied',
    };
    return labels[action] || action;
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
        <h1 className="text-3xl font-bold">Historical Corrections</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage all expense corrections and their audit trail
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Corrections</SelectItem>
            <SelectItem value="pending">Pending Approval</SelectItem>
            <SelectItem value="approved">Awaiting Edit</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {expenses.length} correction{expenses.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No corrections found for the selected filter</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {expenses.map((expense) => (
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
                      </div>
                      {expense.correction_reason && (
                        <div className="flex items-start gap-2 mt-2">
                          <span className="font-medium">Reason:</span>
                          <span className="italic">{expense.correction_reason}</span>
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
                    {getStatusBadge(expense)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(expense)}
                >
                  {expense.status === 'correction_approved' && userRole === 'accountant' ? (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Expense
                    </>
                  ) : (
                    <>
                      <History className="h-4 w-4 mr-2" />
                      View Audit Trail
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedExpense} onOpenChange={() => { setSelectedExpense(null); setEditMode(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit Expense' : 'Correction Details'}</DialogTitle>
            <DialogDescription>
              {editMode ? 'Make the necessary corrections to this expense' : 'Complete audit trail and correction history'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedExpense && (
            <div className="space-y-6">
              {editMode ? (
                // Edit Form
                <form onSubmit={(e) => { e.preventDefault(); handleSaveCorrection(); }} className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-orange-900">Correction Reason:</p>
                    <p className="text-sm text-orange-700 mt-1">{selectedExpense.correction_reason}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-budget-item">Budget Item *</Label>
                    <Select value={editBudgetItem} onValueChange={setEditBudgetItem} required>
                      <SelectTrigger id="edit-budget-item">
                        <SelectValue placeholder="Select budget item" />
                      </SelectTrigger>
                      <SelectContent>
                        {budgetItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.item_name} ({item.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-amount">Base Amount *</Label>
                      <Input
                        id="edit-amount"
                        type="number"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-gst-pct">GST %</Label>
                      <Select 
                        value={editGstPercentage.toString()} 
                        onValueChange={(val) => setEditGstPercentage(parseInt(val))}
                      >
                        <SelectTrigger id="edit-gst-pct">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="28">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>GST Amount (Auto-calculated)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editGstAmount}
                      onChange={(e) => setEditGstAmount(parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Total: {formatCurrency(parseFloat(editAmount || '0') + editGstAmount)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Expense Date *</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editExpenseDate}
                      onChange={(e) => setEditExpenseDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description *</Label>
                    <Textarea
                      id="edit-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Save Correction
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setSelectedExpense(null); setEditMode(false); }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                // View Mode - Audit Trail
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Budget Item</label>
                      <p className="mt-1 font-medium">{selectedExpense.budget_master?.item_name || 'N/A'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Amount</label>
                        <p className="mt-1 font-semibold">{formatCurrency(Number(selectedExpense.amount + selectedExpense.gst_amount))}</p>
                        <p className="text-xs text-muted-foreground">Base: {formatCurrency(selectedExpense.amount)} + GST: {formatCurrency(selectedExpense.gst_amount)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <div className="mt-1">{getStatusBadge(selectedExpense)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Audit Trail
                    </h3>
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="border-l-2 border-primary pl-4 pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{getActionLabel(log.action)}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(log.created_at).toLocaleString()} by {log.profiles?.full_name}
                              </p>
                              {log.old_values && log.new_values && (
                                <div className="mt-2 text-xs space-y-1">
                                  {log.correction_type && (
                                    <Badge variant="outline" className="mr-2">{log.correction_type}</Badge>
                                  )}
                                  {Object.keys(log.new_values).map((key) => {
                                    if (log.old_values[key] !== log.new_values[key]) {
                                      return (
                                        <div key={key} className="flex gap-2">
                                          <span className="font-medium">{key}:</span>
                                          <span className="text-red-600 line-through">{JSON.stringify(log.old_values[key])}</span>
                                          <span>→</span>
                                          <span className="text-green-600">{JSON.stringify(log.new_values[key])}</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
