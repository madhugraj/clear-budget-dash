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

// The 16 items that were updated previously
const updatedItems = [48, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79];

interface ExcelData {
  serial_no: number;
  item_name: string;
  annual_budget: number;
  monthly_budget: number;
}

async function investigateDiscrepancy() {
  console.log('='.repeat(80));
  console.log('BUDGET DISCREPANCY INVESTIGATION');
  console.log('='.repeat(80));
  
  // Extract data from Excel
  const excelData: Map<number, ExcelData> = new Map();
  let totalExcelAnnual = 0;
  let totalExcelMonthly = 0;
  
  for (let i = 10; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    
    const serialNo = parseInt(row[0]);
    if (isNaN(serialNo)) continue;
    
    const itemName = row[1]?.toString() || '';
    
    // Column 5 (index 4) = FOR 12 MONTHS AMOUNT WITH TAX (Annual)
    let annualValue = row[4];
    if (typeof annualValue === 'string') {
      annualValue = parseFloat(annualValue.replace(/[₹,\s]/g, ''));
    }
    
    // Column 6 (index 5) = MONTHLY AMOUNT WITH TAX
    let monthlyValue = row[5];
    if (typeof monthlyValue === 'string') {
      monthlyValue = parseFloat(monthlyValue.replace(/[₹,\s]/g, ''));
    }
    
    if (!isNaN(annualValue) && !isNaN(monthlyValue)) {
      excelData.set(serialNo, {
        serial_no: serialNo,
        item_name: itemName,
        annual_budget: annualValue,
        monthly_budget: monthlyValue
      });
      totalExcelAnnual += annualValue;
      totalExcelMonthly += monthlyValue;
    }
  }
  
  console.log('\n📊 EXCEL TOTALS:');
  console.log(`   Total Annual Budget: ₹${totalExcelAnnual.toLocaleString('en-IN')}`);
  console.log(`   Total Monthly Budget: ₹${totalExcelMonthly.toLocaleString('en-IN')}`);
  
  // Fetch database data for the 16 items
  const { data: dbData, error } = await supabase
    .from('budget_master')
    .select('serial_no, item_name, annual_budget, monthly_budget')
    .eq('fiscal_year', 'FY25-26')
    .in('serial_no', updatedItems)
    .order('serial_no');
  
  if (error) {
    console.error('Error fetching database data:', error);
    return;
  }
  
  // Fetch total database values
  const { data: totalData, error: totalError } = await supabase
    .from('budget_master')
    .select('annual_budget, monthly_budget')
    .eq('fiscal_year', 'FY25-26');
  
  if (!totalError && totalData) {
    const totalDbAnnual = totalData.reduce((sum, item) => sum + Number(item.annual_budget), 0);
    const totalDbMonthly = totalData.reduce((sum, item) => sum + Number(item.monthly_budget), 0);
    
    console.log('\n💾 DATABASE TOTALS:');
    console.log(`   Total Annual Budget: ₹${totalDbAnnual.toLocaleString('en-IN')}`);
    console.log(`   Total Monthly Budget: ₹${totalDbMonthly.toLocaleString('en-IN')}`);
    console.log('\n❌ DISCREPANCY:');
    console.log(`   Annual difference: ₹${(totalDbAnnual - totalExcelAnnual).toLocaleString('en-IN')}`);
    console.log(`   Monthly difference: ₹${(totalDbMonthly - totalExcelMonthly).toLocaleString('en-IN')}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON OF 16 UPDATED ITEMS (Excel vs Database)');
  console.log('='.repeat(80));
  
  const corrections: Array<{serial_no: number, excel_annual: number, excel_monthly: number, db_annual: number, db_monthly: number}> = [];
  let totalAnnualDiscrepancy = 0;
  let totalMonthlyDiscrepancy = 0;
  
  for (const dbItem of dbData || []) {
    const excelItem = excelData.get(dbItem.serial_no);
    if (!excelItem) {
      console.log(`\n⚠️  Serial ${dbItem.serial_no}: NOT FOUND IN EXCEL`);
      continue;
    }
    
    const annualMatch = Math.abs(Number(dbItem.annual_budget) - excelItem.annual_budget) < 1;
    const monthlyMatch = Math.abs(Number(dbItem.monthly_budget) - excelItem.monthly_budget) < 1;
    
    if (!annualMatch || !monthlyMatch) {
      const annualDiff = Number(dbItem.annual_budget) - excelItem.annual_budget;
      const monthlyDiff = Number(dbItem.monthly_budget) - excelItem.monthly_budget;
      
      totalAnnualDiscrepancy += annualDiff;
      totalMonthlyDiscrepancy += monthlyDiff;
      
      console.log(`\n❌ Serial ${dbItem.serial_no}: ${excelItem.item_name}`);
      console.log(`   Excel Annual:  ₹${excelItem.annual_budget.toLocaleString('en-IN')}`);
      console.log(`   DB Annual:     ₹${Number(dbItem.annual_budget).toLocaleString('en-IN')} (diff: ₹${annualDiff.toLocaleString('en-IN')})`);
      console.log(`   Excel Monthly: ₹${excelItem.monthly_budget.toLocaleString('en-IN')}`);
      console.log(`   DB Monthly:    ₹${Number(dbItem.monthly_budget).toLocaleString('en-IN')} (diff: ₹${monthlyDiff.toLocaleString('en-IN')})`);
      
      corrections.push({
        serial_no: dbItem.serial_no,
        excel_annual: excelItem.annual_budget,
        excel_monthly: excelItem.monthly_budget,
        db_annual: Number(dbItem.annual_budget),
        db_monthly: Number(dbItem.monthly_budget)
      });
    } else {
      console.log(`\n✅ Serial ${dbItem.serial_no}: ${excelItem.item_name} - VALUES MATCH`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Items needing correction: ${corrections.length} of 16`);
  console.log(`Total Annual Discrepancy from these items: ₹${totalAnnualDiscrepancy.toLocaleString('en-IN')}`);
  console.log(`Total Monthly Discrepancy from these items: ₹${totalMonthlyDiscrepancy.toLocaleString('en-IN')}`);
  
  if (corrections.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('SQL CORRECTION STATEMENTS');
    console.log('='.repeat(80));
    console.log('\nBEGIN;');
    for (const item of corrections) {
      console.log(`UPDATE budget_master SET annual_budget = ${item.excel_annual}, monthly_budget = ${item.excel_monthly}, updated_at = NOW() WHERE fiscal_year = 'FY25-26' AND serial_no = ${item.serial_no};`);
    }
    console.log('COMMIT;');
  }
}

investigateDiscrepancy().catch(console.error);
