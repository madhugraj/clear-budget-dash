import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MonthlyExpenseChart } from '@/components/MonthlyExpenseChart';
import { ItemWiseExpenseChart } from '@/components/ItemWiseExpenseChart';
import { ItemAnalysisCard } from '@/components/ItemAnalysisCard';
import { BudgetMeter } from '@/components/BudgetMeter';
import { OverBudgetAlert } from '@/components/OverBudgetAlert';
import { RoleBadge } from '@/components/RoleBadge';

interface DashboardStats {
  totalBudget: number;
  totalExpenses: number;
  balance: number;
  pendingApprovals: number;
}

interface MonthlyData {
  month: string;
  amount: number;
  budget: number;
}

interface ItemData {
  item_name: string;
  full_item_name: string;
  amount: number;
  budget: number;
  utilization: number;
  category: string;
  committee: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [itemData, setItemData] = useState<ItemData[]>([]);
  const [allItemData, setAllItemData] = useState<ItemData[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allCommittees, setAllCommittees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { userRole, user } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get current fiscal year budget from budget_master
      const { data: budgetData, error: budgetError } = await supabase
        .from('budget_master')
        .select('annual_budget')
        .eq('fiscal_year', 'FY25-26');

      if (budgetError) throw budgetError;

      const totalBudget = budgetData?.reduce((sum, item) => sum + Number(item.annual_budget), 0) || 0;

      // Get approved expenses for current year
      const currentYear = new Date().getFullYear();
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, status')
        .eq('status', 'approved')
        .gte('expense_date', `${currentYear}-01-01`)
        .lte('expense_date', `${currentYear}-12-31`);

      if (expensesError) throw expensesError;

      const totalExpenses = expensesData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

      // Get pending approvals
      const { data: pendingData, error: pendingError } = await supabase
        .from('expenses')
        .select('id')
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      setStats({
        totalBudget,
        totalExpenses,
        balance: totalBudget - totalExpenses,
        pendingApprovals: pendingData?.length || 0,
      });

      // Get monthly spending data
      const { data: monthlyExpenses, error: monthlyError } = await supabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('status', 'approved')
        .gte('expense_date', '2025-04-01')
        .lte('expense_date', '2025-10-31')
        .order('expense_date');

      if (monthlyError) throw monthlyError;

      // Get monthly budget data
      const { data: budgetMaster, error: budgetMasterError } = await supabase
        .from('budget_master')
        .select('monthly_budget')
        .eq('fiscal_year', 'FY25-26');

      if (budgetMasterError) throw budgetMasterError;

      const totalMonthlyBudget = budgetMaster?.reduce((sum, item) => sum + Number(item.monthly_budget), 0) || 0;

      // Process monthly data
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
      const monthlyMap: Record<string, number> = {};
      
      monthlyExpenses?.forEach(exp => {
        const month = new Date(exp.expense_date).toLocaleString('en-US', { month: 'short' });
        monthlyMap[month] = (monthlyMap[month] || 0) + Number(exp.amount);
      });

      const monthlyChartData = months.map(month => ({
        month,
        amount: monthlyMap[month] || 0,
        budget: totalMonthlyBudget,
      }));

      setMonthlyData(monthlyChartData);

      // Get item-wise spending data
      const { data: itemExpenses, error: itemError } = await supabase
        .from('expenses')
        .select(`
          amount,
          budget_master!expenses_budget_master_id_fkey (
            item_name,
            annual_budget,
            category,
            committee
          )
        `)
        .eq('status', 'approved')
        .gte('expense_date', '2025-04-01')
        .lte('expense_date', '2025-10-31');

      if (itemError) throw itemError;

      // Aggregate by item
      const itemMap: Record<string, { amount: number; budget: number; category: string; committee: string }> = {};
      const categoriesSet = new Set<string>();
      const committeesSet = new Set<string>();
      
      itemExpenses?.forEach((exp: any) => {
        const itemName = exp.budget_master?.item_name;
        const budget = exp.budget_master?.annual_budget || 0;
        const category = exp.budget_master?.category || '';
        const committee = exp.budget_master?.committee || '';
        
        if (itemName) {
          if (!itemMap[itemName]) {
            itemMap[itemName] = { amount: 0, budget: Number(budget), category, committee };
          }
          itemMap[itemName].amount += Number(exp.amount);
          if (category) categoriesSet.add(category);
          if (committee) committeesSet.add(committee);
        }
      });

      // Convert to array and sort by amount
      const allItemChartData = Object.entries(itemMap)
        .map(([item_name, data]) => ({
          item_name: item_name.length > 25 ? item_name.substring(0, 25) + '...' : item_name,
          full_item_name: item_name,
          amount: data.amount,
          budget: data.budget,
          utilization: data.budget > 0 ? (data.amount / data.budget) * 100 : 0,
          category: data.category,
          committee: data.committee,
        }))
        .sort((a, b) => b.amount - a.amount);

      setAllItemData(allItemChartData);
      setItemData(allItemChartData.slice(0, 10));
      setAllCategories(Array.from(categoriesSet).sort());
      setAllCommittees(Array.from(committeesSet).sort());
    } catch (error: any) {
      toast({
        title: 'Error loading dashboard',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCategoryFilter = (category: string) => {
    let filtered = allItemData;
    if (category !== 'all') {
      filtered = filtered.filter(item => item.category === category);
    }
    setItemData(filtered.slice(0, 10));
  };

  const handleCommitteeFilter = (committee: string) => {
    let filtered = allItemData;
    if (committee !== 'all') {
      filtered = filtered.filter(item => item.committee === committee);
    }
    setItemData(filtered.slice(0, 10));
  };


  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-tight">Dashboard</h1>
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-[400px]" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in max-w-[1600px] mx-auto px-4 md:px-6">
      {/* Minimal Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-light tracking-tight">Dashboard</h1>
          {userRole && (
            <div className="flex items-center gap-2">
              <RoleBadge role={userRole} size="sm" />
              <span className="text-xs text-muted-foreground">
                {userRole === 'treasurer' && 'Full system access'}
                {userRole === 'accountant' && 'Can add expenses'}
                {userRole === 'general' && 'View-only access'}
              </span>
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Fiscal Year 2025-26
        </div>
      </div>

      {/* Budget Meter - Hero Section */}
      <BudgetMeter 
        budget={stats?.totalBudget || 0} 
        spent={stats?.totalExpenses || 0}
      />

      {/* Over Budget Alert */}
      <OverBudgetAlert 
        items={allItemData
          .filter(item => item.amount > item.budget)
          .map(item => ({
            item_name: item.full_item_name,
            budget: item.budget,
            actual: item.amount,
            overAmount: item.amount - item.budget,
            utilization: item.utilization,
            category: item.category,
            committee: item.committee,
          }))
        }
      />

      {/* Minimal Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-normal text-muted-foreground">
              Total Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-xl font-semibold break-words">{formatCurrency(stats?.totalBudget || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Annual allocation</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-normal text-muted-foreground">
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-xl font-semibold break-words">{formatCurrency(stats?.totalExpenses || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Approved expenses</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-normal text-muted-foreground">
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-xl font-semibold break-words">{formatCurrency(stats?.balance || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Available funds</p>
          </CardContent>
        </Card>

        <Card 
          className={`border-none shadow-none ${
            userRole === 'treasurer' && stats?.pendingApprovals && stats.pendingApprovals > 0
              ? 'cursor-pointer hover:shadow-md transition-all ring-2 ring-warning/50 animate-pulse'
              : ''
          }`}
          onClick={() => {
            if (userRole === 'treasurer' && stats?.pendingApprovals && stats.pendingApprovals > 0) {
              window.location.href = '/approvals';
            }
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-normal text-muted-foreground">
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg md:text-xl font-semibold break-words ${
              stats?.pendingApprovals && stats.pendingApprovals > 0 ? 'text-warning' : ''
            }`}>
              {stats?.pendingApprovals || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {userRole === 'treasurer' && stats?.pendingApprovals && stats.pendingApprovals > 0 
                ? 'Click to review' 
                : 'Awaiting review'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expense Visualizations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="w-full overflow-hidden">
          <Card className="border-none shadow-none">
            <CardContent className="p-0">
              <MonthlyExpenseChart data={monthlyData} />
            </CardContent>
          </Card>
        </div>
        <div className="w-full overflow-hidden">
          <Card className="border-none shadow-none">
            <CardContent className="p-0">
              <ItemWiseExpenseChart 
                data={itemData} 
                allCategories={allCategories}
                allCommittees={allCommittees}
                onCategoryChange={handleCategoryFilter}
                onCommitteeChange={handleCommitteeFilter}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Item-wise Budget Analysis */}
      <div className="w-full">
        <ItemAnalysisCard 
          items={allItemData.map(item => ({
            item_name: item.item_name,
            full_item_name: item.full_item_name,
            budget: item.budget,
            actual: item.amount,
            utilization: item.utilization,
            category: item.category,
            committee: item.committee,
            monthsElapsed: 7, // Apr - Oct 2025
            monthsRemaining: 5, // Nov - Mar 2026
          }))} 
        />
      </div>
    </div>
  );
}
