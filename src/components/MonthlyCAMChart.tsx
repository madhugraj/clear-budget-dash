import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface MonthlyCAMData {
    month: string;
    projected: number;
    actual: number;
}

interface MonthlyCAMChartProps {
    data: MonthlyCAMData[];
}

export function MonthlyCAMChart({ data }: MonthlyCAMChartProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div className="h-[300px] w-full">
            <div className="mb-4">
                <h3 className="text-lg font-medium">Monthly CAM Collection</h3>
                <p className="text-sm text-muted-foreground">Projected vs Actual Collection</p>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis
                        dataKey="month"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `₹${value / 1000}k`}
                    />
                    <Tooltip
                        formatter={(value: number) => [formatCurrency(value), '']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar
                        dataKey="projected"
                        name="Projected"
                        fill="#e2e8f0"
                        radius={[4, 4, 0, 0]}
                    />
                    <Bar
                        dataKey="actual"
                        name="Actual"
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
