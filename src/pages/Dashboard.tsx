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
import { MonthlyCAMChart } from '@/components/MonthlyCAMChart';
import { TowerCAMChart } from '@/components/TowerCAMChart';
import { ItemAnalysisCard } from '@/components/ItemAnalysisCard';
import { BudgetMeter } from '@/components/BudgetMeter';
import { OverBudgetAlert } from '@/components/OverBudgetAlert';
import { RoleBadge } from '@/components/RoleBadge';
import { RefreshCw } from 'lucide-react';
import { PettyCashAnalytics } from '@/components/PettyCashAnalytics';

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
interface MonthlyPettyCashData {
  month: string;
  amount: number;
}
interface PettyCashItemData {
  item_name: string;
  count: number;
  total_amount: number;
}
interface MonthlyCAMData {
  month: string;
  paid_flats: number;
}

interface TowerCAMData {
  tower: string;
  paid_flats: number;
  pending_flats: number;
  total_flats: number;
  payment_rate: string | number;
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
  const [monthlyPettyCashData, setMonthlyPettyCashData] = useState<MonthlyPettyCashData[]>([]);
  const [pettyCashItemData, setPettyCashItemData] = useState<PettyCashItemData[]>([]);
  const [monthlyCAMData, setMonthlyCAMData] = useState<MonthlyCAMData[]>([]);
  const [towerCAMData, setTowerCAMData] = useState<TowerCAMData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartKey, setChartKey] = useState(0);
  const {
    toast
  } = useToast();
  const {
    userRole,
    user
  } = useAuth();

  const loadPettyCashData = async () => {
    try {
      // Get current fiscal year dates (Apr 2024 - Mar 2025 for FY 2024-25)
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();

      // If current month is Jan-Mar, fiscal year started last year
      // If current month is Apr-Dec, fiscal year started this year
      const fiscalYearStart = currentMonth >= 4 ? currentYear : currentYear - 1;
      const fiscalYearEnd = fiscalYearStart + 1;

      const startDate = `${fiscalYearStart}-04-01`;
      const endDate = `${fiscalYearEnd}-03-31`;

      console.log('Loading petty cash for fiscal year:', startDate, 'to', endDate);

      const { data, error } = await supabase
        .from('petty_cash')
        .select('amount, date, item_name')
        .eq('status', 'approved')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (error) throw error;

      console.log('Petty Cash Data loaded:', data);

      // Process monthly data for fiscal year (Apr-Mar)
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
      const monthlyMap: Record<string, number> = {};

      data?.forEach(item => {
        const itemDate = new Date(item.date);
        const month = itemDate.toLocaleString('en-US', { month: 'short' });
        monthlyMap[month] = (monthlyMap[month] || 0) + Number(item.amount);
      });

      const monthlyChartData = months.map(month => ({
        month,
        amount: monthlyMap[month] || 0
      }));
      setMonthlyPettyCashData(monthlyChartData);

      // Process item repetition data
      const itemMap: Record<string, { count: number; total: number }> = {};

      data?.forEach(item => {
        const name = item.item_name;
        if (!itemMap[name]) {
          itemMap[name] = { count: 0, total: 0 };
        }
        itemMap[name].count += 1;
        itemMap[name].total += Number(item.amount);
      });

      const itemChartData = Object.entries(itemMap)
        .map(([name, stats]) => ({
          item_name: name,
          count: stats.count,
          total_amount: stats.total
        }))
        .sort((a, b) => b.count - a.count) // Sort by frequency
        .slice(0, 10); // Top 10

      setPettyCashItemData(itemChartData);

    } catch (error: any) {
      console.error('Error loading petty cash data:', error);
      toast({
        title: 'Error loading petty cash data',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const loadCAMData = async () => {
    try {
      // Get current fiscal year - if month >= 4 (April), use current year, else use previous year
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const fiscalYearStart = currentMonth >= 4 ? now.getFullYear() : now.getFullYear() - 1;

      const { data, error } = await supabase
        .from('cam_tracking')
        .select('tower, month, paid_flats, pending_flats, total_flats, year, status')
        .eq('status', 'approved')
        .eq('year', fiscalYearStart); // Filter by fiscal year

      if (error) throw error;

      console.log('CAM Data loaded:', data);

      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
      const monthlyStats: Record<number, { paid_flats: number }> = {};
      const towerStats: Record<string, { paid_flats: number; pending_flats: number; total_flats: number }> = {};

      // Initialize all months
      months.forEach((_, index) => {
        const monthNum = index < 9 ? index + 4 : index - 8;
        monthlyStats[monthNum] = { paid_flats: 0 };
      });

      data?.forEach(item => {
        // Monthly aggregation
        if (item.month) {
          if (!monthlyStats[item.month]) {
            monthlyStats[item.month] = { paid_flats: 0 };
          }
          monthlyStats[item.month].paid_flats += item.paid_flats;
        }

        // Tower-wise aggregation (sum across all months for each tower)
        if (item.tower) {
          if (!towerStats[item.tower]) {
            towerStats[item.tower] = { paid_flats: 0, pending_flats: 0, total_flats: item.total_flats || 0 };
          }
          towerStats[item.tower].paid_flats += item.paid_flats;
          towerStats[item.tower].pending_flats += item.pending_flats;
        }
      });

      const monthlyChartData = months.map((month, index) => {
        const monthNum = index < 9 ? index + 4 : index - 8;
        return {
          month,
          paid_flats: monthlyStats[monthNum]?.paid_flats || 0
        };
      });

      // Convert tower stats to array for chart
      const towerChartData = Object.entries(towerStats)
        .map(([tower, stats]) => ({
          tower,
          paid_flats: stats.paid_flats,
          pending_flats: stats.pending_flats,
          total_flats: stats.total_flats,
          payment_rate: stats.total_flats > 0 ? (stats.paid_flats / stats.total_flats * 100).toFixed(1) : 0
        }))
        .sort((a, b) => a.tower.localeCompare(b.tower, undefined, { numeric: true }));

      console.log('CAM Monthly Chart Data:', monthlyChartData);
      console.log('CAM Tower Chart Data:', towerChartData);

      setMonthlyCAMData(monthlyChartData);
      setTowerCAMData(towerChartData);

    } catch (error: any) {
      console.error('Error loading CAM data:', error);
      toast({
        title: 'Error loading CAM data',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    loadDashboardData();
    loadIncomeData();
    loadPettyCashData();
    loadCAMData();
  }, []);
  const refreshCharts = () => {
    setChartKey(prev => prev + 1);
    setLoading(true);
    loadDashboardData();
    loadIncomeData();
    loadPettyCashData();
    loadCAMData();
  };
  const loadDashboardData = async () => {
    try {
      // Get current fiscal year budget from budget_master
      const {
        data: budgetData,
        error: budgetError
      } = await supabase.from('budget_master').select('annual_budget').eq('fiscal_year', 'FY25-26');
      if (budgetError) throw budgetError;
      const totalBudget = budgetData?.reduce((sum, item) => sum + Number(item.annual_budget), 0) || 0;

      // Get approved expenses for current year
      const currentYear = new Date().getFullYear();
      const {
        data: expensesData,
        error: expensesError
      } = await supabase.from('expenses').select('amount, gst_amount, status').eq('status', 'approved').gte('expense_date', `${currentYear}-01-01`).lte('expense_date', `${currentYear}-12-31`);
      if (expensesError) throw expensesError;
      const totalExpenses = expensesData?.reduce((sum, exp) => sum + Number(exp.amount) + Number(exp.gst_amount || 0), 0) || 0;

      // Get pending approvals
      const {
        data: pendingData,
        error: pendingError
      } = await supabase.from('expenses').select('id').eq('status', 'pending');
      if (pendingError) throw pendingError;
      setStats({
        totalBudget,
        totalExpenses,
        balance: totalBudget - totalExpenses,
        pendingApprovals: pendingData?.length || 0
      });

      // Get monthly spending data
      const {
        data: monthlyExpenses,
        error: monthlyError
      } = await supabase.from('expenses').select('amount, gst_amount, expense_date').eq('status', 'approved').gte('expense_date', '2025-04-01').lte('expense_date', '2025-10-31').order('expense_date');
      if (monthlyError) throw monthlyError;

      // Get monthly budget data
      const {
        data: budgetMaster,
        error: budgetMasterError
      } = await supabase.from('budget_master').select('monthly_budget').eq('fiscal_year', 'FY25-26');
      if (budgetMasterError) throw budgetMasterError;
      const totalMonthlyBudget = budgetMaster?.reduce((sum, item) => sum + Number(item.monthly_budget), 0) || 0;

      // Process monthly data
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
      const monthlyMap: Record<string, number> = {};
      monthlyExpenses?.forEach(exp => {
        const month = new Date(exp.expense_date).toLocaleString('en-US', {
          month: 'short'
        });
        monthlyMap[month] = (monthlyMap[month] || 0) + Number(exp.amount) + Number(exp.gst_amount || 0);
      });
      const monthlyChartData = months.map(month => ({
        month,
        amount: monthlyMap[month] || 0,
        budget: totalMonthlyBudget
      }));
      setMonthlyData(monthlyChartData);

      // Get item-wise spending data
      const {
        data: itemExpenses,
        error: itemError
      } = await supabase.from('expenses').select(`
          amount,
          gst_amount,
          budget_master!expenses_budget_master_id_fkey (
            item_name,
            annual_budget,
            category,
            committee
          )
        `).eq('status', 'approved').gte('expense_date', '2025-04-01').lte('expense_date', '2025-10-31');
      if (itemError) throw itemError;

      // Aggregate by item
      const itemMap: Record<string, {
        amount: number;
        budget: number;
        category: string;
        committee: string;
      }> = {};
      const categoriesSet = new Set<string>();
      const committeesSet = new Set<string>();
      itemExpenses?.forEach((exp: any) => {
        const itemName = exp.budget_master?.item_name;
        const budget = exp.budget_master?.annual_budget || 0;
        const category = exp.budget_master?.category || '';
        const committee = exp.budget_master?.committee || '';
        if (itemName) {
          if (!itemMap[itemName]) {
            itemMap[itemName] = {
              amount: 0,
              budget: Number(budget),
              category,
              committee
            };
          }
          itemMap[itemName].amount += Number(exp.amount) + Number(exp.gst_amount || 0);
          if (category) categoriesSet.add(category);
          if (committee) committeesSet.add(committee);
        }
      });

      // Convert to array and sort by amount
      const allItemChartData = Object.entries(itemMap).map(([item_name, data]) => ({
        item_name: item_name.length > 25 ? item_name.substring(0, 25) + '...' : item_name,
        full_item_name: item_name,
        amount: data.amount,
        budget: data.budget,
        utilization: data.budget > 0 ? data.amount / data.budget * 100 : 0,
        category: data.category,
        committee: data.committee
      })).sort((a, b) => b.amount - a.amount);
      setAllItemData(allItemChartData);
      setItemData(allItemChartData.slice(0, 5));
      setAllCategories(Array.from(categoriesSet).sort());
      setAllCommittees(Array.from(committeesSet).sort());
    } catch (error: any) {
      toast({
        title: 'Error loading dashboard',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
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
      const {
        data: categories,
        error: categoriesError
      } = await supabase.from('income_categories').select('id, category_name, parent_category_id, subcategory_name').eq('is_active', true).order('display_order');
      if (categoriesError) throw categoriesError;

      // Get parent categories only
      const parentCategories = categories?.filter(c => !c.parent_category_id) || [];

      // Create a map of all categories for easy lookup
      const categoryMap = new Map(categories?.map(c => [c.id, c]) || []);

      // Get income budget data
      const {
        data: budgetData,
        error: budgetError
      } = await supabase.from('income_budget').select('category_id, budgeted_amount').eq('fiscal_year', 'FY25-26');
      if (budgetError) throw budgetError;

      // Get actual income data - first check what data exists
      const {
        data: allActualData,
        error: allActualError
      } = await supabase.from('income_actuals').select('category_id, actual_amount, gst_amount, month, fiscal_year, status');

      if (allActualError) {
        console.error('Error fetching income actuals:', allActualError);
        throw allActualError;
      }

      console.log('=== INCOME DATA DEBUG ===');
      console.log('ALL Income Data (before filtering):', allActualData);
      console.log('Total records:', allActualData?.length || 0);
      console.log('Fiscal years found:', [...new Set(allActualData?.map(d => d.fiscal_year))]);
      console.log('Statuses found:', [...new Set(allActualData?.map(d => d.status))]);

      // Get actual income data (approved only)
      const actualData = (allActualData || []).filter(d => d.status === 'approved');

      console.log('Approved Income Data:', actualData);
      console.log('Approved records count:', actualData.length);
      console.log('=== END INCOME DATA DEBUG ===');

      if (!actualData || actualData.length === 0) {
        console.warn('⚠️ No approved income data found! Check if records have status="approved"');
      }

      // Process monthly income data by the month field (which month the income is FOR)
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
      const monthlyActuals: Record<number, number> = {};
      actualData?.forEach(actual => {
        // Use the month field which represents which month this income is for
        // month 4 = April (index 0), month 5 = May (index 1), etc.
        const monthIndex = actual.month - 4; // Apr = 4, convert to 0-indexed (Apr = 0)
        const adjustedIndex = monthIndex < 0 ? monthIndex + 12 : monthIndex; // Handle Jan-Mar (next year)

        if (adjustedIndex >= 0 && adjustedIndex < 12) {
          const totalIncome = Number(actual.actual_amount) + Number(actual.gst_amount || 0);
          monthlyActuals[adjustedIndex] = (monthlyActuals[adjustedIndex] || 0) + totalIncome;
        }
      });

      console.log('Monthly actuals aggregated:', monthlyActuals);

      const totalAnnualBudget = budgetData?.reduce((sum, item) => sum + Number(item.budgeted_amount), 0) || 0;
      const monthlyBudget = totalAnnualBudget / 12;
      const monthlyIncomeChartData = months.map((month, index) => ({
        month,
        actual: monthlyActuals[index] || 0,
        budget: monthlyBudget
      }));

      console.log('Final monthly income chart data:', monthlyIncomeChartData);
      setMonthlyIncomeData(monthlyIncomeChartData);

      // Process category-wise income data (aggregate by parent category)
      const parentCategoryData: Record<string, {
        budget: number;
        actual: number;
        children: string[];
      }> = {};

      // Initialize parent categories
      parentCategories.forEach(parent => {
        parentCategoryData[parent.id] = {
          budget: 0,
          actual: 0,
          children: []
        };
      });

      // Aggregate budgets - handle both parent and child categories
      budgetData?.forEach(budgetItem => {
        const category = categoryMap.get(budgetItem.category_id);
        if (!category) return;
        const parentId = category.parent_category_id || category.id;
        if (parentCategoryData[parentId]) {
          parentCategoryData[parentId].budget += Number(budgetItem.budgeted_amount);
          if (category.parent_category_id) {
            parentCategoryData[parentId].children.push(category.id);
          }
        }
      });

      // Aggregate actuals - handle both parent and child categories
      actualData?.forEach(actualItem => {
        const category = categoryMap.get(actualItem.category_id);
        if (!category) return;
        const parentId = category.parent_category_id || category.id;
        if (parentCategoryData[parentId]) {
          const totalIncome = Number(actualItem.actual_amount) + Number(actualItem.gst_amount || 0);
          parentCategoryData[parentId].actual += totalIncome;
        }
      });

      // Convert to chart data format
      const categoryIncomeChartData = parentCategories.map(parent => {
        const data = parentCategoryData[parent.id];
        // Special display name for "Others" category
        let displayName = parent.category_name;
        if (parent.category_name === 'Others') {
          displayName = 'Move In-Out (Misc)';
        }
        // Truncate long names
        displayName = displayName.length > 45 ? displayName.substring(0, 45) + '...' : displayName;

        return {
          category: displayName,
          actual: data.actual,
          budget: data.budget,
          utilization: data.budget > 0 ? data.actual / data.budget * 100 : 0
        };
      }).filter(item => item.budget > 0 || item.actual > 0) // Only show categories with data
        .sort((a, b) => b.actual - a.actual);
      setCategoryIncomeData(categoryIncomeChartData);
    } catch (error: any) {
      console.error('Error loading income data:', error);
      toast({
        title: 'Error loading income data',
        description: error.message,
        variant: 'destructive'
      });
    }
  };
  if (loading) {
    return <div className="space-y-8 animate-fade-in">
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
    </div>;
  }
  return <div className="space-y-6 md:space-y-10 animate-fade-in max-w-[1600px] mx-auto">
    {/* Hero Header Section */}
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 p-8 md:p-12 border border-primary/10">
      <div className="relative z-10">
        <h1 className="text-3xl font-bold tracking-tight mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-indigo-950 text-center md:text-6xl">
          Prestige Bella Vista
        </h1>
        <p className="text-xl md:text-2xl mb-6 text-center font-normal text-secondary-foreground">
          Expense Management System
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm">
          {userRole && <div className="flex items-center gap-2">
            <RoleBadge role={userRole} size="sm" />
            <span className="text-muted-foreground">
              {userRole === 'treasurer' && 'Full system access'}
              {userRole === 'accountant' && 'Can add expenses'}
              {userRole === 'lead' && 'Can manage petty cash'}
              {userRole === 'general' && 'View-only access'}
            </span>
          </div>}
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
      <BudgetMeter budget={stats?.totalBudget || 0} spent={stats?.totalExpenses || 0} />
    </div>

    {/* Over Budget Alert */}
    <div className="animate-[fade-in_0.6s_ease-out_0.3s_both]">
      <OverBudgetAlert items={allItemData.filter(item => {
        const proratedBudget = item.budget * 7 / 12; // 7 months elapsed (Apr-Oct)
        return item.amount > proratedBudget;
      }).map(item => ({
        item_name: item.full_item_name,
        budget: item.budget * 7 / 12,
        // Show prorated budget
        actual: item.amount,
        overAmount: item.amount - item.budget * 7 / 12,
        utilization: item.budget * 7 / 12 > 0 ? item.amount / (item.budget * 7 / 12) * 100 : 0,
        category: item.category,
        committee: item.committee
      }))} />
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

      <Card className={`border-none shadow-none bg-gradient-to-br from-card to-warning/5 hover:shadow-md transition-all ${userRole === 'treasurer' && stats?.pendingApprovals && stats.pendingApprovals > 0 ? 'cursor-pointer ring-2 ring-warning/30 animate-pulse hover:ring-warning/50' : ''}`} onClick={() => {
        if (userRole === 'treasurer' && stats?.pendingApprovals && stats.pendingApprovals > 0) {
          window.location.href = '/approvals';
        }
      }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs md:text-sm font-normal text-muted-foreground">
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-lg md:text-xl font-semibold break-words ${stats?.pendingApprovals && stats.pendingApprovals > 0 ? 'text-warning' : ''}`}>
            {stats?.pendingApprovals || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {userRole === 'treasurer' && stats?.pendingApprovals && stats.pendingApprovals > 0 ? 'Click to review' : 'Awaiting review'}
          </p>
        </CardContent>
      </Card>
    </div>

    {/* Income & Expense Tabs */}
    <div className="space-y-4 animate-[fade-in_0.6s_ease-out_0.5s_both]">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-foreground">Financial Analysis</h2>
        <Button onClick={refreshCharts} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Charts
        </Button>
      </div>

      <Tabs defaultValue="expense" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-4 mb-6">
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="cam">CAM</TabsTrigger>
          <TabsTrigger value="petty-cash">Petty Cash</TabsTrigger>
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
                  <ItemWiseExpenseChart key={`item-${chartKey}`} data={itemData} allCategories={allCategories} allCommittees={allCommittees} onCategoryChange={handleCategoryFilter} onCommitteeChange={handleCommitteeFilter} />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Item-wise Budget Analysis */}
          <div className="w-full">
            <ItemAnalysisCard items={allItemData.map(item => ({
              item_name: item.item_name,
              full_item_name: item.full_item_name,
              budget: item.budget,
              actual: item.amount,
              utilization: item.utilization,
              category: item.category,
              committee: item.committee,
              monthsElapsed: 7,
              // Apr - Oct 2025
              monthsRemaining: 5 // Nov - Mar 2026
            }))} />
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
                  <CategoryWiseIncomeChart key={`category-income-${chartKey}`} data={categoryIncomeData} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cam" className="space-y-6 mt-6">
          <div className="w-full overflow-hidden">
            <Card className="border-none shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-card via-card to-purple-50">
              <CardContent className="p-6">
                <MonthlyCAMChart data={monthlyCAMData} />
              </CardContent>
            </Card>
          </div>

          <div className="w-full overflow-hidden">
            <TowerCAMChart data={towerCAMData} />
          </div>
        </TabsContent>

        <TabsContent value="petty-cash" className="space-y-6 mt-6">
          <PettyCashAnalytics
            monthlyData={monthlyPettyCashData}
            itemData={pettyCashItemData}
          />
        </TabsContent>
      </Tabs>
    </div>
  </div>;
}