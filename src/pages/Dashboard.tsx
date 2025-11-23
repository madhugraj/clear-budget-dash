import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Wallet, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MonthlyExpenseChart } from '@/components/MonthlyExpenseChart';
import { ItemWiseExpenseChart } from '@/components/ItemWiseExpenseChart';
import { ItemAnalysisCard } from '@/components/ItemAnalysisCard';

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
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budget
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalBudget || 0)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalExpenses || 0)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balance
            </CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.balance || 0)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approvals
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingApprovals || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Visualizations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <MonthlyExpenseChart data={monthlyData} />
        <ItemWiseExpenseChart 
          data={itemData} 
          allCategories={allCategories}
          allCommittees={allCommittees}
          onCategoryChange={handleCategoryFilter}
          onCommitteeChange={handleCommitteeFilter}
        />
      </div>

      {/* Item-wise Budget Analysis */}
      <ItemAnalysisCard 
        items={allItemData.map(item => ({
          item_name: item.item_name,
          full_item_name: item.full_item_name,
          budget: item.budget,
          actual: item.amount,
          utilization: item.utilization,
          category: item.category,
          committee: item.committee,
        }))} 
      />
    </div>
  );
}
