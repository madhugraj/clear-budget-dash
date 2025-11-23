import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Upload, 
  Receipt, 
  History, 
  LogOut,
  Menu,
  CheckCircle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['treasurer', 'accountant', 'general'] },
  { name: 'Upload Budget', href: '/budget-upload', icon: Upload, roles: ['treasurer'] },
  { name: 'Add Expense', href: '/expenses', icon: Receipt, roles: ['accountant', 'treasurer'] },
  { name: 'Approvals', href: '/approvals', icon: CheckCircle, roles: ['treasurer'] },
  { name: 'Historical Data', href: '/historical', icon: History, roles: ['treasurer', 'accountant'] },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, userRole } = useAuth();
  const location = useLocation();
  
  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item => 
    userRole && item.roles.includes(userRole)
  );

  const NavLinks = () => (
    <>
      {filteredNavigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold text-primary">Expense Manager</h2>
                  {userRole && (
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {userRole === 'treasurer' ? 'Admin' : userRole}
                    </p>
                  )}
                </div>
                <nav className="flex-1 p-4 space-y-1">
                  <NavLinks />
                </nav>
                <div className="p-4 border-t">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={signOut}
                  >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-semibold">Expense Manager</h1>
        </div>
      </header>

      {/* Desktop Layout */}
      <div className="lg:flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-card">
          <div className="flex flex-col h-full">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-primary">Expense Manager</h2>
              {userRole && (
                <p className="text-sm text-muted-foreground mt-1 capitalize">
                  {userRole === 'treasurer' ? 'Admin' : userRole}
                </p>
              )}
            </div>
            <nav className="flex-1 p-4 space-y-1">
              <NavLinks />
            </nav>
            <div className="p-4 border-t">
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={signOut}
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:pl-64 flex-1">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
