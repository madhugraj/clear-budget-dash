import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface TowerCAMChartProps {
    data: Array<{
        tower: string;
        paid_flats: number;
        pending_flats: number;
        total_flats: number;
        payment_rate: string | number;
    }>;
}

export function TowerCAMChart({ data }: TowerCAMChartProps) {
    // Color based on payment rate - using theme-compatible colors
    const getColor = (rate: string | number) => {
        const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;
        if (numRate >= 90) return 'hsl(var(--primary))'; // Primary - excellent
        if (numRate >= 75) return 'hsl(var(--primary) / 0.7)'; // Primary light - good
        if (numRate >= 50) return 'hsl(var(--chart-4))'; // Chart color - moderate
        return 'hsl(var(--destructive))'; // Destructive - poor
    };

    return (
        <Card className="border-none shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Tower-wise CAM Collection
                </CardTitle>
                <CardDescription>Payment status across all towers</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="tower"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            tick={{ fontSize: 12 }}
                        />
                        <YAxis
                            label={{ value: 'Number of Flats', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-popover p-4 border border-border rounded-lg shadow-lg">
                                            <p className="font-bold text-lg mb-2">Tower {data.tower}</p>
                                            <p className="text-primary">Paid: {data.paid_flats} flats</p>
                                            <p className="text-amber-600">Pending: {data.pending_flats} flats</p>
                                            <p className="text-muted-foreground">Total: {data.total_flats} flats</p>
                                            <p className="font-semibold mt-2">Payment Rate: {data.payment_rate}%</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend />
                        <Bar dataKey="paid_flats" name="Paid Flats" stackId="a">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getColor(entry.payment_rate)} />
                            ))}
                        </Bar>
                        <Bar dataKey="pending_flats" name="Pending Flats" stackId="a" fill="#f87171" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
