import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// Read the Excel file
const workbook = XLSX.readFile('user-uploads://Outflow_-_14-11-2025_1-3.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function fixMonthlyBudgets() {
  console.log('Extracting monthly budget data from Excel...');
  
  const updates: Array<{ serial_no: number, monthly_budget: number }> = [];
  
  // Skip header rows (first 10 rows) and process data
  for (let i = 10; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    
    const serialNo = parseInt(row[0]);
    if (isNaN(serialNo)) continue;
    
    // Column 6 (index 5) is "MONTHLY AMOUNT WITH TAX"
    let monthlyValue = row[5];
    
    // Clean up the value - remove currency symbols and commas
    if (typeof monthlyValue === 'string') {
      monthlyValue = monthlyValue.replace(/[₹,\s]/g, '');
      monthlyValue = parseFloat(monthlyValue);
    }
    
    if (!isNaN(monthlyValue) && monthlyValue > 0) {
      updates.push({
        serial_no: serialNo,
        monthly_budget: monthlyValue
      });
      console.log(`Serial ${serialNo}: Monthly ₹${monthlyValue.toLocaleString('en-IN')}`);
    }
  }
  
  console.log(`\nFound ${updates.length} items to update`);
  
  // Calculate expected total
  const expectedTotal = updates.reduce((sum, item) => sum + item.monthly_budget, 0);
  console.log(`\nExpected total monthly budget: ₹${expectedTotal.toLocaleString('en-IN')}`);
  
  // Update database
  for (const update of updates) {
    const { error } = await supabase
      .from('budget_master')
      .update({ 
        monthly_budget: update.monthly_budget,
        updated_at: new Date().toISOString()
      })
      .eq('fiscal_year', 'FY25-26')
      .eq('serial_no', update.serial_no);
    
    if (error) {
      console.error(`Error updating serial ${update.serial_no}:`, error);
    } else {
      console.log(`✓ Updated serial ${update.serial_no}`);
    }
  }
  
  console.log('\nAll monthly budget updates complete!');
}

fixMonthlyBudgets().catch(console.error);
