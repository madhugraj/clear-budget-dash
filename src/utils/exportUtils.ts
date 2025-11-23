import * as XLSX from 'xlsx';

interface ExportExpense {
  date: string;
  description: string;
  category: string;
  committee: string;
  item_name: string;
  amount: number;
  status: string;
  claimed_by: string;
  approved_by?: string;
}

export const exportToExcel = (data: ExportExpense[], filename: string = 'expenses') => {
  // Prepare data for Excel
  const exportData = data.map(expense => ({
    'Date': expense.date,
    'Description': expense.description,
    'Category': expense.category,
    'Committee': expense.committee,
    'Budget Item': expense.item_name,
    'Amount (₹)': expense.amount,
    'Status': expense.status,
    'Claimed By': expense.claimed_by,
    'Approved By': expense.approved_by || 'N/A',
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  const columnWidths = [
    { wch: 12 }, // Date
    { wch: 30 }, // Description
    { wch: 15 }, // Category
    { wch: 15 }, // Committee
    { wch: 25 }, // Budget Item
    { wch: 15 }, // Amount
    { wch: 12 }, // Status
    { wch: 20 }, // Claimed By
    { wch: 20 }, // Approved By
  ];
  worksheet['!cols'] = columnWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${timestamp}.xlsx`;

  // Save file
  XLSX.writeFile(workbook, fullFilename);
};

export const exportToCSV = (data: ExportExpense[], filename: string = 'expenses') => {
  // Prepare data for CSV
  const exportData = data.map(expense => ({
    'Date': expense.date,
    'Description': expense.description,
    'Category': expense.category,
    'Committee': expense.committee,
    'Budget Item': expense.item_name,
    'Amount (₹)': expense.amount,
    'Status': expense.status,
    'Claimed By': expense.claimed_by,
    'Approved By': expense.approved_by || 'N/A',
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${timestamp}.csv`;

  // Save as CSV
  XLSX.writeFile(workbook, fullFilename, { bookType: 'csv' });
};
