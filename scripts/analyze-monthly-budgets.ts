import * as XLSX from 'xlsx';

// Read the Excel file
const workbook = XLSX.readFile('user-uploads://Outflow_-_14-11-2025_1-3.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Analyzing Excel monthly budget data...\n');

let totalExcelMonthly = 0;
let totalExcelAnnual = 0;
let mismatchCount = 0;

// Skip header rows (first 10 rows) and process data
for (let i = 10; i < data.length; i++) {
  const row = data[i];
  if (!row || !row[0]) continue;
  
  const serialNo = parseInt(row[0]);
  if (isNaN(serialNo)) continue;
  
  const itemName = row[1];
  
  // Column 5 (index 4) is "AMOUNT WITH TAX" (ANNUAL)
  let annualValue = row[4];
  if (typeof annualValue === 'string') {
    annualValue = annualValue.replace(/[₹,\s]/g, '');
    annualValue = parseFloat(annualValue);
  }
  
  // Column 6 (index 5) is "MONTHLY AMOUNT WITH TAX"
  let monthlyValue = row[5];
  if (typeof monthlyValue === 'string') {
    monthlyValue = monthlyValue.replace(/[₹,\s]/g, '');
    monthlyValue = parseFloat(monthlyValue);
  }
  
  if (!isNaN(annualValue) && !isNaN(monthlyValue)) {
    totalExcelAnnual += annualValue;
    totalExcelMonthly += monthlyValue;
    
    const calculatedMonthly = annualValue / 12;
    const diff = Math.abs(monthlyValue - calculatedMonthly);
    
    // Check if monthly is NOT equal to annual/12 (allowing for small rounding differences)
    if (diff > 1) {
      mismatchCount++;
      console.log(`Serial ${serialNo}: ${itemName}`);
      console.log(`  Annual: ₹${annualValue.toLocaleString('en-IN')}`);
      console.log(`  Excel Monthly: ₹${monthlyValue.toLocaleString('en-IN')}`);
      console.log(`  Calculated (Annual/12): ₹${calculatedMonthly.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
      console.log(`  Difference: ₹${diff.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n`);
    }
  }
}

console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Total Annual Budget (Excel): ₹${totalExcelAnnual.toLocaleString('en-IN')}`);
console.log(`Total Monthly Budget (Excel): ₹${totalExcelMonthly.toLocaleString('en-IN')}`);
console.log(`Calculated Monthly (Annual/12): ₹${(totalExcelAnnual/12).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
console.log(`\nItems with mismatched monthly values: ${mismatchCount}`);

if (mismatchCount === 0) {
  console.log('\n✓ All monthly values in Excel equal Annual/12');
  console.log('  The database is using the correct calculation.');
} else {
  console.log('\n⚠ Found mismatches! The database needs to be updated with Excel column 6 values.');
}
