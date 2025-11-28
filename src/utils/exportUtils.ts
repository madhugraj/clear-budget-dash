import * as XLSX from 'xlsx';

// Removed specific interface to allow generic usage

export const exportToExcel = (data: any[], filename: string = 'export') => {
  // Prepare data for Excel - use data as is, assuming it's already formatted
  const exportData = data;

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  // Auto-width for columns
  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    const columnWidths = keys.map(key => ({
      wch: Math.max(key.length, 15) // Minimum width 15
    }));
    worksheet['!cols'] = columnWidths;
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${timestamp}.xlsx`;

  // Save file
  XLSX.writeFile(workbook, fullFilename);
};

export const exportToCSV = (data: any[], filename: string = 'export') => {
  // Prepare data for CSV - use data as is
  const exportData = data;

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
