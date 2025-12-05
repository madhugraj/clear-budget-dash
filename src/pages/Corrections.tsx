import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Loader2, History, Edit, CheckCircle, Calendar, AlertCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface Expense {
  id: string;
  description: string;
  amount: number;
  gst_amount: number;
  tds_percentage: number;
  tds_amount: number;
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
    id: string;
    category_name: string;
    subcategory_name: string | null;
  } | null;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface PettyCash {
  id: string;
  item_name: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  created_at: string;
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
  const [editTdsPercentage, setEditTdsPercentage] = useState<number>(0);
  const [editTdsAmount, setEditTdsAmount] = useState<number>(0);
  const [editDescription, setEditDescription] = useState<string>('');
  const [editExpenseDate, setEditExpenseDate] = useState<string>('');
  const [editBudgetItem, setEditBudgetItem] = useState<string>('');
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Historical Data tab states
  const [historicalExpenses, setHistoricalExpenses] = useState<Expense[]>([]);
  const [historicalIncome, setHistoricalIncome] = useState<Income[]>([]);
  const [historicalPettyCash, setHistoricalPettyCash] = useState<PettyCash[]>([]);
  const [historicalCAM, setHistoricalCAM] = useState<any[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [selectedHistorical, setSelectedHistorical] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<string>('2025-04-01');
  const [dateTo, setDateTo] = useState<string>('2025-10-31');
  const [dailyUsage, setDailyUsage] = useState<number>(0);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [historicalType, setHistoricalType] = useState<'expenses' | 'income' | 'petty_cash' | 'cam'>('expenses');

  // Income Edit States
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
  const [editIncomeMode, setEditIncomeMode] = useState(false);
  const [editIncomeAmount, setEditIncomeAmount] = useState<string>('');
  const [editIncomeGstPercentage, setEditIncomeGstPercentage] = useState<number>(18);
  const [editIncomeGstAmount, setEditIncomeGstAmount] = useState<number>(0);
  const [editIncomeNotes, setEditIncomeNotes] = useState<string>('');
  const [editIncomeCategory, setEditIncomeCategory] = useState<string>('');
  const [editIncomeMonth, setEditIncomeMonth] = useState<number>(4);
  const [editIncomeFiscalYear, setEditIncomeFiscalYear] = useState<string>('FY25-26');
  const [editIncomeDate, setEditIncomeDate] = useState<string>('');
  const [incomeCategories, setIncomeCategories] = useState<any[]>([]);

  // Petty Cash Edit States
  const [selectedPettyCash, setSelectedPettyCash] = useState<PettyCash | null>(null);
  const [editPettyCashMode, setEditPettyCashMode] = useState(false);
  const [editPettyCashItemName, setEditPettyCashItemName] = useState<string>('');
  const [editPettyCashDescription, setEditPettyCashDescription] = useState<string>('');
  const [editPettyCashAmount, setEditPettyCashAmount] = useState<string>('');
  const [editPettyCashDate, setEditPettyCashDate] = useState<string>('');

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    id: string;
    type: 'expense' | 'income' | 'petty_cash' | 'cam';
    description: string;
  }>({ isOpen: false, id: '', type: 'expense', description: '' });
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const { userRole } = useAuth();

  const DAILY_LIMIT = 200;

  const MONTHS = [
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
  ];

  useEffect(() => {
    loadCorrections();
    loadBudgetItems();
    loadIncomeCategories();
    loadDailyUsage();
  }, [filterStatus]);

  useEffect(() => {
    if (userRole === 'accountant' || userRole === 'treasurer') {
      if (historicalType === 'expenses') {
        loadHistoricalExpenses();
      } else if (historicalType === 'income') {
        loadHistoricalIncome();
      } else if (historicalType === 'petty_cash') {
        loadHistoricalPettyCash();
      } else if (historicalType === 'cam') {
        loadHistoricalCAM();
      }
    }
  }, [dateFrom, dateTo, userRole, historicalType]);

  const loadDailyUsage = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .gte('correction_requested_at', `${today}T00:00:00`)
        .lte('correction_requested_at', `${today}T23:59:59`);

      if (error) throw error;
      setDailyUsage(count || 0);
    } catch (error: any) {
      console.error('Error loading daily usage:', error);
    }
  };

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

  const loadIncomeCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .eq('is_active', true)
        .order('category_name');

      if (error) throw error;
      setIncomeCategories(data || []);
    } catch (error: any) {
      console.error('Error loading income categories:', error);
    }
  };

  const loadHistoricalExpenses = async () => {
    if (userRole !== 'accountant' && userRole !== 'treasurer') return;

    setHistoricalLoading(true);
    try {
      const { data, error } = await supabase
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
        `)
        .eq('status', 'approved')
        .gte('expense_date', dateFrom)
        .lte('expense_date', dateTo)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setHistoricalExpenses(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading historical expenses',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setHistoricalLoading(false);
    }
  };

  const loadHistoricalIncome = async () => {
    if (userRole !== 'accountant' && userRole !== 'treasurer') return;

    setHistoricalLoading(true);
    try {
      // Extract months from date range for filtering by accounting month
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      const fromMonth = fromDate.getMonth() + 1; // 1-12
      const toMonth = toDate.getMonth() + 1; // 1-12

      // First fetch income data without the profile join
      let query = supabase
        .from('income_actuals')
        .select(`
          id,
          fiscal_year,
          month,
          actual_amount,
          gst_amount,
          notes,
          status,
          created_at,
          recorded_by,
          income_categories!income_actuals_category_id_fkey (
            id,
            category_name,
            subcategory_name
          )
        `)
        .eq('status', 'approved');

      // Filter by month range (accounting months)
      if (fromMonth <= toMonth) {
        // Same direction range (e.g., April to October: 4-10)
        query = query.gte('month', fromMonth).lte('month', toMonth);
      } else {
        // Wrapping range (e.g., October to March: 10-12 OR 1-3)
        query = query.or(`month.gte.${fromMonth},month.lte.${toMonth}`);
      }

      const { data: incomeData, error } = await query.order('month', { ascending: false });

      if (error) throw error;

      // Then fetch profiles manually
      const recordedByIds = Array.from(new Set((incomeData || []).map(i => i.recorded_by).filter(Boolean)));

      let profilesMap: Record<string, { full_name: string, email: string }> = {};

      if (recordedByIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', recordedByIds);

        if (!profilesError && profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = { full_name: profile.full_name || '', email: profile.email || '' };
            return acc;
          }, {} as Record<string, { full_name: string, email: string }>);
        }
      }

      // Combine the data
      const incomeWithProfiles = (incomeData || []).map(income => ({
        ...income,
        profiles: profilesMap[income.recorded_by] || { full_name: 'Unknown', email: '' }
      }));

      setHistoricalIncome(incomeWithProfiles as unknown as Income[]);
    } catch (error: any) {
      toast({
        title: 'Error loading historical income',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setHistoricalLoading(false);
    }
  };

  const loadHistoricalPettyCash = async () => {
    if (userRole !== 'accountant' && userRole !== 'treasurer') return;

    setHistoricalLoading(true);
    try {
      const { data, error } = await supabase
        .from('petty_cash')
        .select('*, profiles!petty_cash_submitted_by_fkey (full_name, email)')
        .eq('status', 'approved')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false });

      if (error) throw error;
      setHistoricalPettyCash((data || []) as unknown as PettyCash[]);
    } catch (error: any) {
      toast({
        title: 'Error loading historical petty cash',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setHistoricalLoading(false);
    }
  };

  const loadHistoricalCAM = async () => {
    if (userRole !== 'accountant' && userRole !== 'treasurer') return;

    setHistoricalLoading(true);
    try {
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('status', 'approved')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setHistoricalCAM(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading historical CAM',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setHistoricalLoading(false);
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
          tds_percentage,
          tds_amount,
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

    // Check if user can edit (accountant with correction_approved status OR treasurer)
    if ((expense.status === 'correction_approved' && userRole === 'accountant') || userRole === 'treasurer') {
      setEditMode(true);
      setEditAmount(expense.amount.toString());
      setEditGstAmount(expense.gst_amount);
      setEditTdsPercentage(expense.tds_percentage || 0);
      setEditTdsAmount(expense.tds_amount || 0);
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

  // Treasurer direct edit for historical data
  const handleTreasurerEdit = async (expense: Expense) => {
    setSelectedExpense(expense);
    await loadAuditLogs(expense.id);
    setEditMode(true);
    setEditAmount(expense.amount.toString());
    setEditGstAmount(expense.gst_amount);
    setEditTdsPercentage(expense.tds_percentage || 0);
    setEditTdsAmount(expense.tds_amount || 0);
    setEditDescription(expense.description);
    setEditExpenseDate(expense.expense_date);
    setEditBudgetItem(expense.budget_master?.id || '');

    // Calculate GST percentage
    if (expense.amount > 0 && expense.gst_amount > 0) {
      const gstPct = (expense.gst_amount / expense.amount) * 100;
      setEditGstPercentage(Math.round(gstPct));
    } else {
      setEditGstPercentage(18);
    }
  };

  const handleTreasurerEditIncome = (income: Income) => {
    setSelectedIncome(income);
    setEditIncomeMode(true);
    setEditIncomeAmount(income.actual_amount.toString());
    setEditIncomeGstAmount(income.gst_amount);
    setEditIncomeNotes(income.notes || '');
    setEditIncomeCategory(income.income_categories?.id || '');
    setEditIncomeMonth(income.month);
    setEditIncomeFiscalYear(income.fiscal_year);
    setEditIncomeDate(income.created_at.split('T')[0]);

    // Calculate GST percentage
    if (income.actual_amount > 0 && income.gst_amount > 0) {
      const gstPct = (income.gst_amount / income.actual_amount) * 100;
      // Find closest standard GST rate
      const rates = [0, 5, 12, 18, 28];
      const closest = rates.reduce((prev, curr) =>
        Math.abs(curr - gstPct) < Math.abs(prev - gstPct) ? curr : prev
      );
      setEditIncomeGstPercentage(closest);
    } else {
      setEditIncomeGstPercentage(18);
    }
  };

  const handleTreasurerEditPettyCash = (pettyCash: PettyCash) => {
    setSelectedPettyCash(pettyCash);
    setEditPettyCashMode(true);
    setEditPettyCashItemName(pettyCash.item_name);
    setEditPettyCashDescription(pettyCash.description || '');
    setEditPettyCashAmount(pettyCash.amount.toString());
    setEditPettyCashDate(pettyCash.date);
  };

  const handleSaveCorrection = async () => {
    if (!selectedExpense) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Treasurer direct edit - just update the values, keep status as approved
      if (userRole === 'treasurer') {
        const { error } = await supabase
          .from('expenses')
          .update({
            amount: parseFloat(editAmount),
            gst_amount: editGstAmount,
            tds_percentage: editTdsPercentage,
            tds_amount: editTdsAmount,
            description: editDescription,
            expense_date: editExpenseDate,
            budget_master_id: editBudgetItem,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedExpense.id);

        if (error) throw error;

        toast({
          title: 'Expense updated',
          description: 'The expense has been updated successfully',
        });
      } else {
        // Accountant correction flow
        const { error } = await supabase
          .from('expenses')
          .update({
            amount: parseFloat(editAmount),
            gst_amount: editGstAmount,
            tds_percentage: editTdsPercentage,
            tds_amount: editTdsAmount,
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
      }

      setSelectedExpense(null);
      setEditMode(false);
      await loadCorrections();
      await loadHistoricalExpenses();
    } catch (error: any) {
      toast({
        title: 'Error saving',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIncomeCorrection = async () => {
    if (!selectedIncome) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate FY and Month from date
      const date = new Date(editIncomeDate);
      const month = date.getMonth() + 1; // 1-12
      const year = date.getFullYear();
      const fyStart = month >= 4 ? year : year - 1;
      const fyEnd = fyStart + 1;
      const fiscalYear = `FY${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;

      const { error } = await supabase
        .from('income_actuals')
        .update({
          actual_amount: parseFloat(editIncomeAmount),
          gst_amount: editIncomeGstAmount,
          notes: editIncomeNotes,
          category_id: editIncomeCategory,
          month: month,
          fiscal_year: fiscalYear,
          created_at: `${editIncomeDate}T12:00:00`, // Set to noon to avoid timezone issues
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedIncome.id);

      if (error) throw error;

      toast({
        title: 'Income updated',
        description: 'The income record has been updated successfully',
      });

      setSelectedIncome(null);
      setEditIncomeMode(false);
      await loadHistoricalIncome();
    } catch (error: any) {
      toast({
        title: 'Error saving income',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePettyCashCorrection = async () => {
    if (!selectedPettyCash) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('petty_cash')
        .update({
          item_name: editPettyCashItemName,
          description: editPettyCashDescription,
          amount: parseFloat(editPettyCashAmount),
          date: editPettyCashDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPettyCash.id);

      if (error) throw error;

      toast({
        title: 'Petty cash updated',
        description: 'The petty cash record has been updated successfully',
      });

      setSelectedPettyCash(null);
      setEditPettyCashMode(false);
      await loadHistoricalPettyCash();
    } catch (error: any) {
      toast({
        title: 'Error saving petty cash',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const navigate = useNavigate();

  const handleDeleteClick = (id: string, type: 'expense' | 'income' | 'petty_cash' | 'cam', description: string) => {
    setDeleteConfirmation({
      isOpen: true,
      id,
      type,
      description
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.id) return;

    setDeleting(true);
    try {
      const table = deleteConfirmation.type === 'expense'
        ? 'expenses'
        : deleteConfirmation.type === 'income'
          ? 'income_actuals'
          : deleteConfirmation.type === 'petty_cash'
            ? 'petty_cash'
            : 'cam_tracking';

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', deleteConfirmation.id);

      if (error) throw error;

      toast({
        title: 'Record deleted',
        description: `The ${deleteConfirmation.type} record has been deleted successfully.`,
      });

      setDeleteConfirmation({ ...deleteConfirmation, isOpen: false });

      if (deleteConfirmation.type === 'expense') {
        await loadHistoricalExpenses();
      } else if (deleteConfirmation.type === 'income') {
        await loadHistoricalIncome();
      } else if (deleteConfirmation.type === 'petty_cash') {
        await loadHistoricalPettyCash();
      } else {
        await loadHistoricalCAM();
      }
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Auto-calculate GST for Income when amount or percentage changes
  useEffect(() => {
    if (editIncomeAmount && parseFloat(editIncomeAmount) > 0) {
      const baseAmount = parseFloat(editIncomeAmount);
      const gst = (baseAmount * editIncomeGstPercentage) / 100;
      setEditIncomeGstAmount(Math.round(gst * 100) / 100);
    } else {
      setEditIncomeGstAmount(0);
    }
  }, [editIncomeAmount, editIncomeGstPercentage]);

  // Auto-calculate GST when amount or percentage changes
  useEffect(() => {
    if (editAmount && parseFloat(editAmount) > 0) {
      const baseAmount = parseFloat(editAmount);
      const gst = (baseAmount * editGstPercentage) / 100;
      setEditGstAmount(Math.round(gst * 100) / 100);
    }
  }, [editAmount, editGstPercentage]);

  // Auto-calculate TDS when amount or percentage changes
  useEffect(() => {
    if (editAmount && parseFloat(editAmount) > 0) {
      const baseAmount = parseFloat(editAmount);
      const tds = (baseAmount * editTdsPercentage) / 100;
      setEditTdsAmount(Math.round(tds * 100) / 100);
    }
  }, [editAmount, editTdsPercentage]);

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

  const handleSelectHistorical = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedHistorical);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedHistorical(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedHistorical.size === historicalExpenses.length) {
      setSelectedHistorical(new Set());
    } else {
      setSelectedHistorical(new Set(historicalExpenses.map(e => e.id)));
    }
  };

  const handleBulkRequest = () => {
    const remaining = DAILY_LIMIT - dailyUsage;
    if (selectedHistorical.size > remaining) {
      toast({
        title: 'Daily limit exceeded',
        description: `You can only request ${remaining} more corrections today. You've selected ${selectedHistorical.size}.`,
        variant: 'destructive',
      });
      return;
    }
    setShowBulkDialog(true);
  };

  const handleConfirmBulkRequest = async () => {
    setBulkSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates = Array.from(selectedHistorical).map(id => ({
        id,
        status: 'correction_pending',
        correction_reason: bulkReason,
        correction_requested_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('expenses')
          .update({
            status: update.status,
            correction_reason: update.correction_reason,
            correction_requested_at: update.correction_requested_at,
          })
          .eq('id', update.id);

        if (error) throw error;

        // Send notification
        supabase.functions.invoke('send-expense-notification', {
          body: { expenseId: update.id, action: 'correction_requested' }
        }).catch(err => console.error('Email failed:', err));
      }

      toast({
        title: 'Correction requests submitted',
        description: `${selectedHistorical.size} expenses sent for approval`,
      });

      setSelectedHistorical(new Set());
      setBulkReason('');
      setShowBulkDialog(false);
      await loadHistoricalExpenses();
      await loadDailyUsage();
    } catch (error: any) {
      toast({
        title: 'Error submitting requests',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setBulkSubmitting(false);
    }
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
        <h1 className="text-3xl font-bold">Corrections</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage expense corrections, including historical data updates
        </p>
      </div>

      <Tabs defaultValue="workflow" className="w-full">
        <TabsList>
          <TabsTrigger value="workflow">Correction Workflow</TabsTrigger>
          {(userRole === 'accountant' || userRole === 'treasurer') && (
            <TabsTrigger value="historical">Historical Data</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="workflow" className="space-y-6 mt-6">

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
                        <div className="text-xl font-bold">{formatCurrency(Number(expense.amount + expense.gst_amount - (expense.tds_amount || 0)))}</div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div>Base: {formatCurrency(expense.amount)}</div>
                          <div>GST: {formatCurrency(expense.gst_amount)}</div>
                          {expense.tds_amount > 0 && (
                            <>
                              <div>TDS: -{formatCurrency(expense.tds_amount)}</div>
                              <div className="font-medium">Net: {formatCurrency(expense.amount + expense.gst_amount - expense.tds_amount)}</div>
                            </>
                          )}
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
        </TabsContent>

        {(userRole === 'accountant' || userRole === 'treasurer') && (
          <TabsContent value="historical" className="space-y-6 mt-6">
            {userRole === 'accountant' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Daily Correction Limit</span>
                    <Badge variant={dailyUsage >= DAILY_LIMIT ? "destructive" : "secondary"}>
                      {dailyUsage} / {DAILY_LIMIT} used today
                    </Badge>
                  </CardTitle>
                  <Progress value={(dailyUsage / DAILY_LIMIT) * 100} className="mt-2" />
                </CardHeader>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data-type">Data Type</Label>
                    <Select value={historicalType} onValueChange={(val: any) => setHistoricalType(val)}>
                      <SelectTrigger id="data-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expenses">Expenses</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="petty_cash">Petty Cash</SelectItem>
                        <SelectItem value="cam">CAM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date-from">From Date</Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date-to">To Date</Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Showing all approved {historicalType} from the selected date range
                </p>
              </CardContent>
            </Card>

            {historicalLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      Historical {historicalType === 'expenses' ? 'Expenses' : historicalType === 'income' ? 'Income' : historicalType === 'petty_cash' ? 'Petty Cash' : 'CAM'} ({historicalType === 'expenses' ? historicalExpenses.length : historicalType === 'income' ? historicalIncome.length : historicalType === 'petty_cash' ? historicalPettyCash.length : historicalCAM.length})
                    </CardTitle>
                    {historicalType === 'expenses' && userRole === 'accountant' && selectedHistorical.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {selectedHistorical.size} selected
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedHistorical(new Set())}
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleBulkRequest}
                          disabled={dailyUsage >= DAILY_LIMIT}
                        >
                          Request Correction
                        </Button>
                      </div>
                    )}
                    {userRole === 'treasurer' && (
                      <p className="text-sm text-muted-foreground">
                        Click Edit to directly modify any historical record
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {historicalType === 'expenses' ? (
                    historicalExpenses.length === 0 ? (
                      <div className="py-12 text-center">
                        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No historical expenses found for the selected filters</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {userRole === 'accountant' && (
                              <TableHead className="w-12">
                                <Checkbox
                                  checked={selectedHistorical.size === historicalExpenses.length}
                                  onCheckedChange={handleSelectAll}
                                />
                              </TableHead>
                            )}
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Budget Item</TableHead>
                            <TableHead className="text-right">Base</TableHead>
                            <TableHead className="text-right">GST</TableHead>
                            <TableHead className="text-right">TDS</TableHead>
                            <TableHead className="text-right">Net</TableHead>
                            {userRole === 'treasurer' && (
                              <TableHead className="text-center">Actions</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historicalExpenses.map((expense) => (
                            <TableRow key={expense.id}>
                              {userRole === 'accountant' && (
                                <TableCell>
                                  <Checkbox
                                    checked={selectedHistorical.has(expense.id)}
                                    onCheckedChange={(checked) =>
                                      handleSelectHistorical(expense.id, checked as boolean)
                                    }
                                  />
                                </TableCell>
                              )}
                              <TableCell className="text-sm">
                                {new Date(expense.expense_date).toLocaleDateString('en-IN')}
                              </TableCell>
                              <TableCell className="text-sm">{expense.description}</TableCell>
                              <TableCell className="text-sm">
                                {expense.budget_master?.item_name || 'N/A'}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(expense.amount)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {expense.gst_amount === 0 ? (
                                  <Badge variant="destructive" className="text-xs">₹0</Badge>
                                ) : (
                                  formatCurrency(expense.gst_amount)
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {expense.tds_amount === 0 ? (
                                  <Badge variant="destructive" className="text-xs">₹0</Badge>
                                ) : (
                                  formatCurrency(expense.tds_amount || 0)
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(expense.amount + expense.gst_amount - (expense.tds_amount || 0))}
                              </TableCell>
                              {userRole === 'treasurer' && (
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTreasurerEdit(expense)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteClick(expense.id, 'expense', expense.description)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  ) : historicalType === 'income' ? (
                    // Income Table
                    historicalIncome.length === 0 ? (
                      <div className="py-12 text-center">
                        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No historical income found for the selected filters</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Subcategory</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Base</TableHead>
                            <TableHead className="text-right">GST</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            {userRole === 'treasurer' && (
                              <TableHead className="text-center">Actions</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historicalIncome.map((income) => (
                            <TableRow key={income.id}>
                              <TableCell className="text-sm font-medium">
                                {MONTHS.find(m => m.value === income.month)?.label || income.month} {income.fiscal_year}
                              </TableCell>
                              <TableCell className="text-sm">
                                {income.income_categories?.category_name || 'N/A'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {income.income_categories?.subcategory_name || '-'}
                              </TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">
                                {income.notes || '-'}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(income.actual_amount)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {income.gst_amount === 0 ? (
                                  <Badge variant="destructive" className="text-xs">₹0</Badge>
                                ) : (
                                  formatCurrency(income.gst_amount)
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(income.actual_amount + income.gst_amount)}
                              </TableCell>
                              {userRole === 'treasurer' && (
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTreasurerEditIncome(income)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteClick(income.id, 'income', income.income_categories?.category_name || 'Income')}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  ) : historicalType === 'petty_cash' ? (
                    // Petty Cash Table
                    historicalPettyCash.length === 0 ? (
                      <div className="py-12 text-center">
                        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No historical petty cash found for the selected filters</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            {userRole === 'treasurer' && (
                              <TableHead className="text-center">Actions</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historicalPettyCash.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-sm">
                                {new Date(item.date).toLocaleDateString('en-IN')}
                              </TableCell>
                              <TableCell className="text-sm font-medium">{item.item_name}</TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">
                                {item.description || '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.profiles?.full_name || 'N/A'}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(item.amount)}
                              </TableCell>
                              {userRole === 'treasurer' && (
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTreasurerEditPettyCash(item)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteClick(item.id, 'petty_cash', item.item_name)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  ) : (
                    // CAM Table
                    historicalCAM.length === 0 ? (
                      <div className="py-12 text-center">
                        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No historical CAM data found</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tower</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Paid Flats</TableHead>
                            <TableHead className="text-right">Pending Flats</TableHead>
                            <TableHead className="text-right">Total Flats</TableHead>
                            <TableHead>Status</TableHead>
                            {userRole === 'treasurer' && (
                              <TableHead className="text-center">Actions</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historicalCAM.map((cam) => (
                            <TableRow key={cam.id}>
                              <TableCell className="font-medium">{cam.tower}</TableCell>
                              <TableCell>
                                {cam.month ? `${MONTHS.find(m => m.value === cam.month)?.label} ${cam.year}` : `Q${cam.quarter} ${cam.year}`}
                              </TableCell>
                              <TableCell className="text-right">{cam.paid_flats}</TableCell>
                              <TableCell className="text-right">{cam.pending_flats}</TableCell>
                              <TableCell className="text-right">{cam.total_flats}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{cam.status}</Badge>
                              </TableCell>
                              {userRole === 'treasurer' && (
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // Navigate to CAM Tracking page with this record
                                      navigate('/cam-tracking');
                                      toast({
                                        title: 'CAM Editing',
                                        description: 'Please edit CAM data in the CAM Tracking page',
                                      });
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteClick(cam.id, 'cam', `Tower ${cam.tower}`)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )
        }
      </Tabs >

      {/* Bulk Request Dialog */}
      < Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog} >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Bulk Corrections</DialogTitle>
            <DialogDescription>
              You're requesting corrections for {selectedHistorical.size} expense(s).
              This will use {selectedHistorical.size} of your daily limit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Correction Reason *</Label>
              <Textarea
                id="bulk-reason"
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Enter reason for these corrections (e.g., 'GST split required for April-October bulk upload')"
                rows={3}
                required
              />
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                After treasurer approval, these expenses will appear in the "Correction Workflow" tab
                where you can edit the GST/TDS values.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBulkRequest}
              disabled={!bulkReason.trim() || bulkSubmitting}
            >
              {bulkSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Requests'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog >

      {/* Expense Edit/View Dialog */}
      < Dialog open={!!selectedExpense} onOpenChange={() => { setSelectedExpense(null); setEditMode(false); }}>
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
                        <p className="text-xs text-muted-foreground space-y-0.5">
                          <div>Base: {formatCurrency(selectedExpense.amount)}</div>
                          <div>GST: {formatCurrency(selectedExpense.gst_amount)}</div>
                          {selectedExpense.tds_amount > 0 && (
                            <>
                              <div>TDS: -{formatCurrency(selectedExpense.tds_amount)}</div>
                              <div className="font-medium mt-1">Net: {formatCurrency(selectedExpense.amount + selectedExpense.gst_amount - selectedExpense.tds_amount)}</div>
                            </>
                          )}
                        </p>
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
      </Dialog >

      {/* Income Edit Dialog */}
      < Dialog open={!!selectedIncome} onOpenChange={() => { setSelectedIncome(null); setEditIncomeMode(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Income</DialogTitle>
            <DialogDescription>
              Make changes to this income record.
            </DialogDescription>
          </DialogHeader>

          {selectedIncome && (
            <form onSubmit={(e) => { e.preventDefault(); handleSaveIncomeCorrection(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-income-month">Month *</Label>
                  <Select value={editIncomeMonth.toString()} onValueChange={(val) => setEditIncomeMonth(parseInt(val))}>
                    <SelectTrigger id="edit-income-month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-income-fiscal-year">Fiscal Year</Label>
                  <Input
                    id="edit-income-fiscal-year"
                    value={editIncomeFiscalYear}
                    onChange={(e) => setEditIncomeFiscalYear(e.target.value)}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-income-category">Category *</Label>
                <Select value={editIncomeCategory} onValueChange={setEditIncomeCategory} required>
                  <SelectTrigger id="edit-income-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.category_name} {cat.subcategory_name ? `- ${cat.subcategory_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-income-amount">Base Amount *</Label>
                  <Input
                    id="edit-income-amount"
                    type="number"
                    step="0.01"
                    value={editIncomeAmount}
                    onChange={(e) => setEditIncomeAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-income-gst-pct">GST %</Label>
                  <Select
                    value={editIncomeGstPercentage.toString()}
                    onValueChange={(val) => setEditIncomeGstPercentage(parseFloat(val))}
                  >
                    <SelectTrigger id="edit-income-gst-pct">
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
                <Label>Amounts (Auto-calculated)</Label>
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted p-3 rounded-md">
                  <div>
                    <span className="text-muted-foreground">GST Amount:</span>
                    <p className="font-medium">{formatCurrency(editIncomeGstAmount)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Net Amount:</span>
                    <p className="font-bold text-primary">
                      {formatCurrency((parseFloat(editIncomeAmount) || 0) + editIncomeGstAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-income-notes">Notes</Label>
                <Textarea
                  id="edit-income-notes"
                  value={editIncomeNotes}
                  onChange={(e) => setEditIncomeNotes(e.target.value)}
                  rows={3}
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
                      Save Changes
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setSelectedIncome(null); setEditIncomeMode(false); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog >

      {/* Petty Cash Edit Dialog */}
      < Dialog open={editPettyCashMode} onOpenChange={() => { setSelectedPettyCash(null); setEditPettyCashMode(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Petty Cash</DialogTitle>
            <DialogDescription>
              Make changes to this petty cash record.
            </DialogDescription>
          </DialogHeader>

          {selectedPettyCash && (
            <form onSubmit={(e) => { e.preventDefault(); handleSavePettyCashCorrection(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-petty-item">Item Name *</Label>
                <Input
                  id="edit-petty-item"
                  value={editPettyCashItemName}
                  onChange={(e) => setEditPettyCashItemName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-petty-desc">Description</Label>
                <Textarea
                  id="edit-petty-desc"
                  value={editPettyCashDescription}
                  onChange={(e) => setEditPettyCashDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-petty-amount">Amount *</Label>
                  <Input
                    id="edit-petty-amount"
                    type="number"
                    step="0.01"
                    value={editPettyCashAmount}
                    onChange={(e) => setEditPettyCashAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-petty-date">Date *</Label>
                  <Input
                    id="edit-petty-date"
                    type="date"
                    value={editPettyCashDate}
                    onChange={(e) => setEditPettyCashDate(e.target.value)}
                    required
                  />
                </div>
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
                      Save Changes
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setSelectedPettyCash(null); setEditPettyCashMode(false); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog >

      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(open) => setDeleteConfirmation({ ...deleteConfirmation, isOpen: open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteConfirmation.type} record:
              <span className="font-medium block mt-1">"{deleteConfirmation.description}"</span>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
