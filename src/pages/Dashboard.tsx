import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MonthlyExpenseChart } from '@/components/MonthlyExpenseChart';
import { ItemWiseExpenseChart } from '@/components/ItemWiseExpenseChart';
import { MonthlyIncomeChart } from '@/components/MonthlyIncomeChart';
import { CategoryWiseIncomeChart } from '@/components/CategoryWiseIncomeChart';
import { ItemAnalysisCard } from '@/components/ItemAnalysisCard';
import { BudgetMeter } from '@/components/BudgetMeter';
import { OverBudgetAlert } from '@/components/OverBudgetAlert';
import { RoleBadge } from '@/components/RoleBadge';
import { RefreshCw } from 'lucide-react';

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

interface MonthlyIncomeData {
  month: string;
  actual: number;
  budget: number;
}

interface CategoryIncomeData {
  category: string;
  actual: number;
  budget: number;
  utilization: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [itemData, setItemData] = useState<ItemData[]>([]);
  const [allItemData, setAllItemData] = useState<ItemData[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allCommittees, setAllCommittees] = useState<string[]>([]);
  const [monthlyIncomeData, setMonthlyIncomeData] = useState<MonthlyIncomeData[]>([]);
  const [categoryIncomeData, setCategoryIncomeData] = useState<CategoryIncomeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartKey, setChartKey] = useState(0);
  const { toast } = useToast();
  const { userRole, user } = useAuth();

  useEffect(() => {
    loadDashboardData();
    loadIncomeData();
  }, []);

  const refreshCharts = () => {
    setChartKey(prev => prev + 1);
    setLoading(true);
    loadDashboardData();
    loadIncomeData();
  };

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
      setItemData(allItemChartData.slice(0, 5));
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
    setItemData(filtered.slice(0, 5));
  };

  const handleCommitteeFilter = (committee: string) => {
    let filtered = allItemData;
    if (committee !== 'all') {
      filtered = filtered.filter(item => item.committee === committee);
    }
    setItemData(filtered.slice(0, 5));
  };

  const loadIncomeData = async () => {
    try {
      // Get income categories
      const { data: categories, error: categoriesError } = await supabase
        .from('income_categories')
        .select('id, category_name, parent_category_id')
        .eq('is_active', true)
        .order('display_order');

      if (categoriesError) throw categoriesError;

      // Get parent categories only
      const parentCategories = categories?.filter(c => !c.parent_category_id) || [];

      // Get income budget data
      const { data: budgetData, error: budgetError } = await supabase
        .from('income_budget')
        .select('category_id, budgeted_amount')
        .eq('fiscal_year', 'FY25-26');

      if (budgetError) throw budgetError;

      // Get actual income data
      const { data: actualData, error: actualError } = await supabase
        .from('income_actuals')
        .select('category_id, actual_amount, month')
        .eq('fiscal_year', 'FY25-26');

      if (actualError) throw actualError;

      // Process monthly income data
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
      const monthlyActuals: Record<number, number> = {};
      
      actualData?.forEach(actual => {
        const monthIndex = actual.month - 4; // Apr = 4, convert to 0-indexed
        if (monthIndex >= 0 && monthIndex < 7) {
          monthlyActuals[monthIndex] = (monthlyActuals[monthIndex] || 0) + Number(actual.actual_amount);
        }
      });

      const totalMonthlyBudget = budgetData?.reduce((sum, item) => sum + Number(item.budgeted_amount), 0) || 0;
      const monthlyBudget = totalMonthlyBudget / 12;

      const monthlyIncomeChartData = months.map((month, index) => ({
        month,
        actual: monthlyActuals[index] || 0,
        budget: monthlyBudget,
      }));

      setMonthlyIncomeData(monthlyIncomeChartData);

      // Process category-wise income data
      const categoryMap: Record<string, { budget: number; actual: number }> = {};
      
      parentCategories.forEach(category => {
        const budget = budgetData?.find(b => b.category_id === category.id);
        const actuals = actualData?.filter(a => a.category_id === category.id);
        const totalActual = actuals?.reduce((sum, a) => sum + Number(a.actual_amount), 0) || 0;
        
        categoryMap[category.category_name] = {
          budget: Number(budget?.budgeted_amount || 0),
          actual: totalActual,
        };
      });

      const categoryIncomeChartData = Object.entries(categoryMap)
        .map(([category, data]) => ({
          category: category.length > 25 ? category.substring(0, 25) + '...' : category,
          actual: data.actual,
          budget: data.budget,
          utilization: data.budget > 0 ? (data.actual / data.budget) * 100 : 0,
        }))
        .sort((a, b) => b.actual - a.actual);

      setCategoryIncomeData(categoryIncomeChartData);
    } catch (error: any) {
      toast({
        title: 'Error loading income data',
        description: error.message,
        variant: 'destructive',
      });
    }
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
    <div className="space-y-6 md:space-y-10 animate-fade-in max-w-[1600px] mx-auto">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 p-8 md:p-12 border border-primary/10">
        <div className="relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Prestige Bella Vista
          </h1>
          <p className="text-xl md:text-2xl font-light text-foreground/80 mb-6">
            Expense Management System
          </p>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm">
            {userRole && (
              <div className="flex items-center gap-2">
                <RoleBadge role={userRole} size="sm" />
                <span className="text-muted-foreground">
                  {userRole === 'treasurer' && 'Full system access'}
                  {userRole === 'accountant' && 'Can add expenses'}
                  {userRole === 'general' && 'View-only access'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 backdrop-blur-sm rounded-full border border-border">
              <span className="text-muted-foreground">Fiscal Year</span>
              <span className="font-semibold text-foreground">2025-26</span>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-0"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl -z-0"></div>
      </div>

      {/* Budget Meter - Hero Section */}
      <div className="animate-[fade-in_0.6s_ease-out_0.2s_both]">
        <BudgetMeter 
          budget={stats?.totalBudget || 0} 
          spent={stats?.totalExpenses || 0}
        />
      </div>

      {/* Over Budget Alert */}
      <div className="animate-[fade-in_0.6s_ease-out_0.3s_both]">
        <OverBudgetAlert 
          items={allItemData
            .filter(item => {
              const proratedBudget = (item.budget * 7) / 12; // 7 months elapsed (Apr-Oct)
              return item.amount > proratedBudget;
            })
            .map(item => ({
              item_name: item.full_item_name,
              budget: (item.budget * 7) / 12, // Show prorated budget
              actual: item.amount,
              overAmount: item.amount - ((item.budget * 7) / 12),
              utilization: ((item.budget * 7) / 12) > 0 
                ? (item.amount / ((item.budget * 7) / 12)) * 100 
                : 0,
              category: item.category,
              committee: item.committee,
            }))
          }
        />
      </div>

      {/* Minimal Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-[fade-in_0.6s_ease-out_0.4s_both]">
        <Card className="border-none shadow-none bg-gradient-to-br from-card to-primary/5 hover:shadow-md transition-all">
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

        <Card className="border-none shadow-none bg-gradient-to-br from-card to-accent/5 hover:shadow-md transition-all">
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

        <Card className="border-none shadow-none bg-gradient-to-br from-card to-success/5 hover:shadow-md transition-all">
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
          className={`border-none shadow-none bg-gradient-to-br from-card to-warning/5 hover:shadow-md transition-all ${
            userRole === 'treasurer' && stats?.pendingApprovals && stats.pendingApprovals > 0
              ? 'cursor-pointer ring-2 ring-warning/30 animate-pulse hover:ring-warning/50'
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

      {/* Income & Expense Tabs */}
      <div className="space-y-4 animate-[fade-in_0.6s_ease-out_0.5s_both]">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-foreground">Financial Analysis</h2>
          <Button 
            onClick={refreshCharts} 
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Charts
          </Button>
        </div>
        
        <Tabs defaultValue="expense" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>
          
          <TabsContent value="expense" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="w-full overflow-hidden">
                <Card className="border-none shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-card via-card to-primary/5">
                  <CardContent className="p-0">
                    <MonthlyExpenseChart key={`monthly-${chartKey}`} data={monthlyData} />
                  </CardContent>
                </Card>
              </div>
              <div className="w-full overflow-hidden">
                <Card className="border-none shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-card via-card to-accent/5">
                  <CardContent className="p-0">
                    <ItemWiseExpenseChart 
                      key={`item-${chartKey}`}
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
          </TabsContent>
          
          <TabsContent value="income" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="w-full overflow-hidden">
                <Card className="border-none shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-card via-card to-chart-2/5">
                  <CardContent className="p-0">
                    <MonthlyIncomeChart key={`monthly-income-${chartKey}`} data={monthlyIncomeData} />
                  </CardContent>
                </Card>
              </div>
              <div className="w-full overflow-hidden">
                <Card className="border-none shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-card via-card to-chart-3/5">
                  <CardContent className="p-0">
                    <CategoryWiseIncomeChart 
                      key={`category-income-${chartKey}`}
                      data={categoryIncomeData}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
