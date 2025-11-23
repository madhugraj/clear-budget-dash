import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const workbook = XLSX.readFile('user-uploads://Outflow_-_14-11-2025_1-3.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function updateMonthlyBudgets() {
  console.log('Excel Analysis:');
  console.log('='.repeat(70));
  
  const items: Array<{ serial: number, annual: number, monthly: number, item: string }> = [];
  
  // Parse Excel data (skip first 10 header rows)
  for (let i = 10; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    
    const serial = parseInt(row[0]);
    if (isNaN(serial)) continue;
    
    const item = row[1];
    let annual = row[4];  // Column 5: AMOUNT WITH TAX (Annual)
    let monthly = row[5]; // Column 6: MONTHLY AMOUNT WITH TAX
    
    // Clean values
    if (typeof annual === 'string') {
      annual = parseFloat(annual.replace(/[₹,\s]/g, ''));
    }
    if (typeof monthly === 'string') {
      monthly = parseFloat(monthly.replace(/[₹,\s]/g, ''));
    }
    
    if (!isNaN(annual) && !isNaN(monthly)) {
      items.push({ serial, annual, monthly, item });
    }
  }
  
  const excelTotalAnnual = items.reduce((sum, i) => sum + i.annual, 0);
  const excelTotalMonthly = items.reduce((sum, i) => sum + i.monthly, 0);
  
  console.log(`Total items found: ${items.length}`);
  console.log(`Excel Total Annual Budget: ₹${excelTotalAnnual.toLocaleString('en-IN')}`);
  console.log(`Excel Total Monthly Budget: ₹${excelTotalMonthly.toLocaleString('en-IN')}`);
  console.log(`Calculated (Annual/12): ₹${(excelTotalAnnual/12).toLocaleString('en-IN', {maximumFractionDigits: 2})}`);
  console.log('='.repeat(70));
  
  // Get database totals
  const { data: dbData } = await supabase
    .from('budget_master')
    .select('annual_budget, monthly_budget')
    .eq('fiscal_year', 'FY25-26');
  
  const dbTotalAnnual = dbData?.reduce((sum, i) => sum + Number(i.annual_budget), 0) || 0;
  const dbTotalMonthly = dbData?.reduce((sum, i) => sum + Number(i.monthly_budget), 0) || 0;
  
  console.log('\nDatabase Current State:');
  console.log(`DB Total Annual Budget: ₹${dbTotalAnnual.toLocaleString('en-IN')}`);
  console.log(`DB Total Monthly Budget: ₹${dbTotalMonthly.toLocaleString('en-IN')}`);
  console.log('='.repeat(70));
  
  // Check for mismatches
  const mismatches: Array<any> = [];
  for (const item of items) {
    const calculated = item.annual / 12;
    const diff = Math.abs(item.monthly - calculated);
    if (diff > 1) {
      mismatches.push({
        serial: item.serial,
        item: item.item,
        annual: item.annual,
        excelMonthly: item.monthly,
        calculated: calculated,
        difference: diff
      });
    }
  }
  
  if (mismatches.length > 0) {
    console.log(`\n⚠ Found ${mismatches.length} items where Excel monthly ≠ annual/12:`);
    mismatches.forEach(m => {
      console.log(`\nSerial ${m.serial}: ${m.item}`);
      console.log(`  Excel Monthly: ₹${m.excelMonthly.toLocaleString('en-IN')}`);
      console.log(`  Calculated: ₹${m.calculated.toLocaleString('en-IN', {maximumFractionDigits: 2})}`);
      console.log(`  Difference: ₹${m.difference.toLocaleString('en-IN', {maximumFractionDigits: 2})}`);
    });
  } else {
    console.log('\n✓ All Excel monthly values equal annual/12');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('CONCLUSION:');
  if (Math.abs(excelTotalMonthly - dbTotalMonthly) < 10) {
    console.log('✓ Database monthly budget matches Excel total');
    console.log(`  Both show: ₹${dbTotalMonthly.toLocaleString('en-IN')}`);
  } else {
    console.log('⚠ Database monthly budget DIFFERS from Excel:');
    console.log(`  Excel: ₹${excelTotalMonthly.toLocaleString('en-IN')}`);
    console.log(`  Database: ₹${dbTotalMonthly.toLocaleString('en-IN')}`);
    console.log(`  Difference: ₹${Math.abs(excelTotalMonthly - dbTotalMonthly).toLocaleString('en-IN')}`);
  }
}

updateMonthlyBudgets().catch(console.error);
