import { ExportExpenses } from '@/components/ExportExpenses';

export default function Reports() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Reports & Export</h1>
        <p className="text-muted-foreground mt-2">
          Export expense data for analysis and reporting
        </p>
      </div>

      <ExportExpenses />
    </div>
  );
}
