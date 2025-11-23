import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function generateComparisonReport() {
  console.log('📊 BUDGET COMPARISON REPORT');
  console.log('='.repeat(120));
  console.log('Comparing Excel file data with Database values for FY25-26\n');

  // Read Excel file
  const workbook = XLSX.readFile('user-uploads://Outflow_-_14-11-2025_1-3.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  // Parse Excel data (skip first 10 header rows)
  const excelData = new Map<number, { item: string; annual: number; monthly: number }>();
  let totalExcelAnnual = 0;
  let totalExcelMonthly = 0;

  for (let i = 10; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const serial = parseInt(row[0]);
    if (isNaN(serial)) continue;

    const item = row[1];
    
    // Column 5 (index 4) = Annual budget with tax
    let annual = row[4];
    if (typeof annual === 'string') {
      annual = parseFloat(annual.replace(/[₹,\s]/g, ''));
    }

    // Column 6 (index 5) = Monthly budget with tax
    let monthly = row[5];
    if (typeof monthly === 'string') {
      monthly = parseFloat(monthly.replace(/[₹,\s]/g, ''));
    }

    if (!isNaN(annual) && !isNaN(monthly)) {
      excelData.set(serial, { item, annual, monthly });
      totalExcelAnnual += annual;
      totalExcelMonthly += monthly;
    }
  }

  // Fetch database data
  const { data: dbData, error } = await supabase
    .from('budget_master')
    .select('serial_no, item_name, annual_budget, monthly_budget')
    .eq('fiscal_year', 'FY25-26')
    .order('serial_no');

  if (error) {
    console.error('❌ Error fetching database data:', error);
    return;
  }

  // Calculate database totals
  const totalDbAnnual = dbData?.reduce((sum, item) => sum + Number(item.annual_budget), 0) || 0;
  const totalDbMonthly = dbData?.reduce((sum, item) => sum + Number(item.monthly_budget), 0) || 0;

  console.log('📁 DATA SUMMARY:');
  console.log(`   Excel items: ${excelData.size}`);
  console.log(`   Database items: ${dbData?.length || 0}`);
  console.log(`   Excel Annual Total: ₹${totalExcelAnnual.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`   Excel Monthly Total: ₹${totalExcelMonthly.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`   Database Annual Total: ₹${totalDbAnnual.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`   Database Monthly Total: ₹${totalDbMonthly.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`   Annual Difference: ₹${(totalDbAnnual - totalExcelAnnual).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`   Monthly Difference: ₹${(totalDbMonthly - totalExcelMonthly).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log();

  // Detailed comparison
  console.log('🔍 DETAILED ITEM-BY-ITEM COMPARISON:');
  console.log('='.repeat(120));
  console.log('Serial | Item Name'.padEnd(50) + ' | Excel Annual'.padEnd(20) + ' | DB Annual'.padEnd(20) + ' | Excel Monthly'.padEnd(20) + ' | DB Monthly'.padEnd(20) + ' | Status');
  console.log('-'.repeat(120));

  const discrepancies: any[] = [];
  let matchCount = 0;
  let mismatchCount = 0;

  for (const dbItem of dbData || []) {
    const excelItem = excelData.get(dbItem.serial_no);
    
    if (!excelItem) {
      console.log(`${dbItem.serial_no} | ${dbItem.item_name.substring(0, 45).padEnd(45)} | NOT IN EXCEL | ❌ MISSING`);
      continue;
    }

    const annualMatch = Math.abs(Number(dbItem.annual_budget) - excelItem.annual) < 1;
    const monthlyMatch = Math.abs(Number(dbItem.monthly_budget) - excelItem.monthly) < 1;
    
    if (annualMatch && monthlyMatch) {
      matchCount++;
      console.log(`${dbItem.serial_no.toString().padEnd(6)} | ${dbItem.item_name.substring(0, 45).padEnd(45)} | ${excelItem.annual.toLocaleString('en-IN').padEnd(18)} | ${Number(dbItem.annual_budget).toLocaleString('en-IN').padEnd(18)} | ${excelItem.monthly.toLocaleString('en-IN').padEnd(18)} | ${Number(dbItem.monthly_budget).toLocaleString('en-IN').padEnd(18)} | ✅ MATCH`);
    } else {
      mismatchCount++;
      console.log(`${dbItem.serial_no.toString().padEnd(6)} | ${dbItem.item_name.substring(0, 45).padEnd(45)} | ${excelItem.annual.toLocaleString('en-IN').padEnd(18)} | ${Number(dbItem.annual_budget).toLocaleString('en-IN').padEnd(18)} | ${excelItem.monthly.toLocaleString('en-IN').padEnd(18)} | ${Number(dbItem.monthly_budget).toLocaleString('en-IN').padEnd(18)} | ❌ MISMATCH`);
      
      discrepancies.push({
        serial_no: dbItem.serial_no,
        item_name: dbItem.item_name,
        excel_annual: excelItem.annual,
        db_annual: Number(dbItem.annual_budget),
        excel_monthly: excelItem.monthly,
        db_monthly: Number(dbItem.monthly_budget),
        annual_diff: Number(dbItem.annual_budget) - excelItem.annual,
        monthly_diff: Number(dbItem.monthly_budget) - excelItem.monthly
      });
    }
  }

  console.log('='.repeat(120));
  console.log('\n📋 FINAL SUMMARY:');
  console.log(`   ✅ Matching items: ${matchCount}`);
  console.log(`   ❌ Mismatched items: ${mismatchCount}`);
  console.log(`   Total discrepancy: Annual ₹${(totalDbAnnual - totalExcelAnnual).toLocaleString('en-IN')}, Monthly ₹${(totalDbMonthly - totalExcelMonthly).toLocaleString('en-IN')}`);

  if (discrepancies.length > 0) {
    console.log('\n🔧 SQL UPDATE STATEMENTS TO FIX DISCREPANCIES:');
    console.log('='.repeat(120));
    console.log('BEGIN;');
    for (const disc of discrepancies) {
      console.log(`UPDATE budget_master SET annual_budget = ${disc.excel_annual}, monthly_budget = ${disc.excel_monthly}, updated_at = NOW() WHERE fiscal_year = 'FY25-26' AND serial_no = ${disc.serial_no}; -- ${disc.item_name}`);
    }
    console.log('COMMIT;');
  }
}

generateComparisonReport().catch(console.error);
