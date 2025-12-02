import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MonthlyPettyCashData {
    month: string;
    amount: number;
}

interface PettyCashItemData {
    item_name: string;
    count: number;
    total_amount: number;
}

interface PettyCashAnalyticsProps {
    monthlyData: MonthlyPettyCashData[];
    itemData: PettyCashItemData[];
}

export function PettyCashAnalytics({ monthlyData, itemData }: PettyCashAnalyticsProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <div className="w-full overflow-hidden">
                <Card className="border-none shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-card via-card to-primary/5">
                    <CardHeader className="pb-4 px-6">
                        <CardTitle className="text-lg font-semibold">Monthly Petty Cash Spending</CardTitle>
                        <CardDescription className="text-sm">Month-on-month comparison</CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pb-4">
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="month"
                                    className="text-xs"
                                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                />
                                <YAxis
                                    tickFormatter={formatCurrency}
                                    className="text-xs"
                                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                />
                                <Tooltip
                                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        borderColor: 'hsl(var(--border))',
                                        borderRadius: 'var(--radius)',
                                    }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Bar
                                    dataKey="amount"
                                    fill="hsl(var(--primary))"
                                    name="Amount"
                                    radius={[4, 4, 0, 0]}
                                    isAnimationActive={true}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="w-full overflow-hidden">
                <Card className="border-none shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-card via-card to-accent/5 h-full">
                    <CardHeader className="pb-4 px-6">
                        <CardTitle className="text-lg font-semibold">Item Repetition Analysis</CardTitle>
                        <CardDescription className="text-sm">Top recurring items by frequency</CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                        <div className="max-h-[350px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item Name</TableHead>
                                        <TableHead className="text-right">Frequency</TableHead>
                                        <TableHead className="text-right">Total Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {itemData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                                No data available
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        itemData.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                                <TableCell className="text-right">{item.count}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.total_amount)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
