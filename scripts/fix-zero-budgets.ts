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

// Items with zero budget that need fixing
const zeroItems = [23, 26, 31, 33, 35, 37, 38, 53, 54, 55, 59, 60, 65, 66, 67, 71];

async function fixBudgets() {
  console.log('Extracting budget data from Excel...');
  
  const updates: Array<{ serial_no: number, annual_budget: number }> = [];
  
  // Skip header rows and process data
  for (let i = 10; i < data.length; i++) {
    const row = data[i];
    const serialNo = parseInt(row[0]);
    
    if (zeroItems.includes(serialNo)) {
      // Column 4 (index 4) is "AMOUNT WITH TAX" (annual budget)
      let budgetValue = row[4];
      
      // Clean up the value - remove currency symbols and commas
      if (typeof budgetValue === 'string') {
        budgetValue = budgetValue.replace(/[₹,\s]/g, '');
        budgetValue = parseFloat(budgetValue);
      }
      
      if (!isNaN(budgetValue) && budgetValue > 0) {
        updates.push({
          serial_no: serialNo,
          annual_budget: budgetValue
        });
        console.log(`Serial ${serialNo}: ₹${budgetValue.toLocaleString('en-IN')}`);
      }
    }
  }
  
  console.log(`\nFound ${updates.length} items to update`);
  
  // Update database
  for (const update of updates) {
    const { error } = await supabase
      .from('budget_master')
      .update({ 
        annual_budget: update.annual_budget,
        monthly_budget: update.annual_budget / 12,
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
  
  console.log('\nAll updates complete!');
}

fixBudgets().catch(console.error);
