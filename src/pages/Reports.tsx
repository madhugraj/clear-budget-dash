import { ExportExpenses } from '@/components/ExportExpenses';
import { ExportIncome } from '@/components/ExportIncome';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Reports() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Reports & Export</h1>
        <p className="text-muted-foreground mt-2">
          Export and analyze financial data across different categories
        </p>
      </div>

      <Tabs defaultValue="expense" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
          <TabsTrigger value="petty-cash">Petty Cash</TabsTrigger>
        </TabsList>

        <TabsContent value="expense" className="mt-6">
          <ExportExpenses />
        </TabsContent>

        <TabsContent value="income" className="mt-6">
          <ExportIncome />
        </TabsContent>

        <TabsContent value="gst" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>GST Reports</CardTitle>
              <CardDescription>View and export GST-related data and filings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                GST reporting functionality will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="petty-cash" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Petty Cash Reports</CardTitle>
              <CardDescription>View and export petty cash transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Petty Cash reporting functionality will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
