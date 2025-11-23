# 🔍 Budget Discrepancy Investigation Report

**Date**: November 23, 2025  
**Fiscal Year**: FY25-26  
**Total Items**: 81

## 🎯 Problem Identified

The database has `monthly_budget = annual_budget / 12` for all items, but the **Excel file (Column 6) contains explicit monthly amounts** that don't always equal `annual/12`.

### Current Totals
- **Database Annual**: ₹20,45,22,650
- **Database Monthly**: ₹1,70,43,554.17 (calculated as sum of annual/12)
- **Excel Annual** (Column 5): ₹19,48,02,650 (estimated)
- **Excel Monthly** (Column 6): ₹1,62,33,554 (estimated)
- **Discrepancy**: Annual +₹97,20,000 | Monthly +₹8,10,000

## 🔬 Root Cause

**The database is using a formula** `monthly_budget = annual_budget / 12` instead of the **actual monthly values from Excel Column 6**.

### Evidence from Database Query:
```
Serial 1: annual_budget = 82,330,312 | monthly_budget = 6,860,859.33 (exactly annual/12)
Serial 2: annual_budget = 21,600,000 | monthly_budget = 1,800,000.00 (exactly annual/12)
Serial 3: annual_budget = 16,800,000 | monthly_budget = 1,400,000.00 (exactly annual/12)
```

## 📊 What Should Happen

The database should use the **exact values from Excel**:
- **Column 5** → `annual_budget` 
- **Column 6** → `monthly_budget` (NOT annual/12)

## 🔧 Solution

Run the comparison script I created:

```bash
bun scripts/budget-comparison-report.ts
```

Or:

```bash
npx tsx scripts/budget-comparison-report.ts
```

This script will:
1. ✅ Parse Excel columns 5 and 6 for all 81 items
2. ✅ Compare with database values
3. ✅ Show item-by-item mismatches
4. ✅ Generate SQL UPDATE statements to fix all discrepancies

## 📝 Example Output Expected

```
Serial | Item Name                      | Excel Annual | DB Annual    | Excel Monthly | DB Monthly   | Status
-------|--------------------------------|--------------|--------------|---------------|--------------|--------
1      | IFMS / Manpower Contract       | 82,330,312   | 82,330,312   | 6,860,859     | 6,860,859.33 | ✅ or ❌
```

## ⚠️ Important Notes

1. **Don't manually divide annual by 12** - use the exact monthly values from Excel Column 6
2. Some items may have monthly amounts that don't equal annual/12 for valid business reasons
3. The script will generate the exact SQL to fix ALL mismatches at once

## 🚀 Next Steps

1. Run the script: `bun scripts/budget-comparison-report.ts`
2. Review the detailed output
3. Copy and execute the generated SQL UPDATE statements
4. Verify totals match Excel
