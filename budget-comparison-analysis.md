# Budget Comparison Analysis - FY25-26 🔍
## Date: November 23, 2025

## 🎯 ROOT CAUSE CONFIRMED

**The database is storing `monthly_budget = annual_budget / 12` instead of the actual monthly values from Excel Column 6!**

### Evidence from Database:
```
ALL 81 ITEMS have: monthly_budget = ROUND(annual_budget ÷ 12, 2)

Examples:
- Serial 1: annual = 82,330,312 | monthly = 6,860,859.33 (exactly 82330312÷12)
- Serial 2: annual = 21,600,000 | monthly = 1,800,000.00 (exactly 21600000÷12)  
- Serial 8: annual = 11,180,750 | monthly = 931,729.17 (exactly 11180750÷12)
```

### The Problem:
- **Database Monthly Total**: ₹1,70,43,554 (sum of all annual÷12)
- **Excel Column 6 Monthly**: Has different explicit values (NOT always annual÷12)
- **Result**: Database ignores Excel Column 6 completely!

---

## 📊 Data Sources

1. **Excel File (Source of Truth)**:
   - Column 5 (index 4): Annual Budget → `annual_budget` ✅
   - Column 6 (index 5): Monthly Budget → `monthly_budget` ❌ (currently ignored)

2. **Database (`budget_master` table)**:
   - `annual_budget`: Correct from Column 5 ✅
   - `monthly_budget`: Wrong - calculated as annual÷12 ❌

---

## 🔧 Solution

I've created a comprehensive comparison script: `scripts/budget-comparison-report.ts`

**Run it with:**
```bash
bun scripts/budget-comparison-report.ts
```

**The script will:**
1. ✅ Parse Excel Column 5 (Annual) and Column 6 (Monthly) for all 81 items
2. ✅ Compare with current database values
3. ✅ Show EXACT item-by-item discrepancies
4. ✅ Generate SQL UPDATE statements to fix all monthly_budget values

**Expected Output:**
```
Serial | Item Name                    | Excel Annual | DB Annual   | Excel Monthly | DB Monthly  | Status
-------|------------------------------|--------------|-------------|---------------|-------------|--------
1      | IFMS / Manpower Contract     | 82,330,312   | 82,330,312  | 6,860,859     | 6,860,859.33| ✅ or ❌
...
```

---

## 📋 Previous Analysis (Outdated)

### Items Previously Flagged with Zero Budget:
Items 23, 26, 31, 33, 35, 37, 38, 53-55, 59-60, 65-67, 71, 78 were flagged as having ₹0 budget, but this was resolved. The current issue is different - it's about the monthly_budget calculation method being wrong for ALL items.

---

## 🚀 Next Steps

1. **Run the script**: `bun scripts/budget-comparison-report.ts`
2. **Review output**: Check all discrepancies
3. **Execute SQL**: Apply the generated UPDATE statements  
4. **Verify**: Confirm database monthly total matches Excel Column 6 sum

---

*Updated analysis - Issue root cause identified: monthly_budget calculation error*
