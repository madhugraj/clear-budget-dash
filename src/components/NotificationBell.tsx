import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface NotificationCounts {
  pendingExpenses: number;
  pendingIncome: number;
  correctionRequests: number;
  pendingPettyCash: number;
  pendingCAM: number;
}

export function NotificationBell() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<NotificationCounts>({
    pendingExpenses: 0,
    pendingIncome: 0,
    correctionRequests: 0,
    pendingPettyCash: 0,
    pendingCAM: 0,
  });
  const [isOpen, setIsOpen] = useState(false);

  const totalCount = counts.pendingExpenses + counts.pendingIncome + counts.correctionRequests + counts.pendingPettyCash + counts.pendingCAM;

  useEffect(() => {
    if (userRole === 'treasurer') {
      loadNotifications();
      
      // Poll every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const loadNotifications = async () => {
    try {
      // Fetch pending expenses count
      const { count: expenseCount } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch pending income count
      const { count: incomeCount } = await supabase
        .from('income_actuals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch correction requests count
      const { count: correctionCount } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'correction_pending');

      // Fetch pending petty cash count
      const { count: pettyCashCount } = await supabase
        .from('petty_cash')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch pending CAM count
      const { count: camCount } = await supabase
        .from('cam_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'submitted');

      setCounts({
        pendingExpenses: expenseCount || 0,
        pendingIncome: incomeCount || 0,
        correctionRequests: correctionCount || 0,
        pendingPettyCash: pettyCashCount || 0,
        pendingCAM: camCount || 0,
      });
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleNavigate = (tab: string) => {
    setIsOpen(false);
    navigate(`/approvals?tab=${tab}`);
  };

  // Only show for treasurer
  if (userRole !== 'treasurer') {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {totalCount > 99 ? '99+' : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="font-semibold">Pending Approvals</div>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {counts.pendingExpenses > 0 && (
                <button
                  onClick={() => handleNavigate('expenses')}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <div className="font-medium">Pending Expenses</div>
                    <div className="text-sm text-muted-foreground">
                      {counts.pendingExpenses} expense{counts.pendingExpenses !== 1 ? 's' : ''} awaiting approval
                    </div>
                  </div>
                  <Badge variant="secondary">{counts.pendingExpenses}</Badge>
                </button>
              )}
              
              {counts.pendingIncome > 0 && (
                <button
                  onClick={() => handleNavigate('income')}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <div className="font-medium">Pending Income</div>
                    <div className="text-sm text-muted-foreground">
                      {counts.pendingIncome} income record{counts.pendingIncome !== 1 ? 's' : ''} awaiting approval
                    </div>
                  </div>
                  <Badge variant="secondary">{counts.pendingIncome}</Badge>
                </button>
              )}
              
              {counts.correctionRequests > 0 && (
                <button
                  onClick={() => handleNavigate('corrections')}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <div className="font-medium">Correction Requests</div>
                    <div className="text-sm text-muted-foreground">
                      {counts.correctionRequests} correction{counts.correctionRequests !== 1 ? 's' : ''} pending review
                    </div>
                  </div>
                  <Badge variant="secondary">{counts.correctionRequests}</Badge>
                </button>
              )}

              {counts.pendingPettyCash > 0 && (
                <button
                  onClick={() => handleNavigate('petty-cash')}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <div className="font-medium">Pending Petty Cash</div>
                    <div className="text-sm text-muted-foreground">
                      {counts.pendingPettyCash} petty cash entr{counts.pendingPettyCash !== 1 ? 'ies' : 'y'} awaiting approval
                    </div>
                  </div>
                  <Badge variant="secondary">{counts.pendingPettyCash}</Badge>
                </button>
              )}

              {counts.pendingCAM > 0 && (
                <button
                  onClick={() => handleNavigate('cam')}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <div className="font-medium">Pending CAM</div>
                    <div className="text-sm text-muted-foreground">
                      {counts.pendingCAM} CAM record{counts.pendingCAM !== 1 ? 's' : ''} awaiting approval
                    </div>
                  </div>
                  <Badge variant="secondary">{counts.pendingCAM}</Badge>
                </button>
              )}
              
              {totalCount === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No pending approvals
                </div>
              )}
            </div>
          </ScrollArea>
          
          {totalCount > 0 && (
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handleNavigate('expenses')}
            >
              View All Approvals
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
