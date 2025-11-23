import * as XLSX from 'xlsx';

// Read the Excel file
const workbook = XLSX.readFile('user-uploads://Outflow_-_14-11-2025_1-3.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('SQL UPDATE statements for monthly_budget:\n');
console.log('-- Update monthly_budget values from Excel column 6 (MONTHLY AMOUNT WITH TAX)\n');

const updates: string[] = [];
let totalMonthly = 0;

// Skip header rows (first 10 rows) and process data
for (let i = 10; i < data.length; i++) {
  const row = data[i];
  if (!row || !row[0]) continue;
  
  const serialNo = parseInt(row[0]);
  if (isNaN(serialNo)) continue;
  
  // Column 6 (index 5) is "MONTHLY AMOUNT WITH TAX"
  let monthlyValue = row[5];
  
  // Clean up the value
  if (typeof monthlyValue === 'string') {
    monthlyValue = monthlyValue.replace(/[₹,\s]/g, '');
    monthlyValue = parseFloat(monthlyValue);
  }
  
  if (!isNaN(monthlyValue) && monthlyValue >= 0) {
    totalMonthly += monthlyValue;
    updates.push(`  UPDATE budget_master SET monthly_budget = ${monthlyValue}, updated_at = NOW() WHERE fiscal_year = 'FY25-26' AND serial_no = ${serialNo};`);
  }
}

console.log('BEGIN;');
console.log(updates.join('\n'));
console.log('COMMIT;');
console.log(`\n-- Total monthly budget: ₹${totalMonthly.toLocaleString('en-IN')}`);
console.log(`-- Number of items updated: ${updates.length}`);
