import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | boolean | null);
  format?: (value: any) => string | number;
}

export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  if (data.length === 0) return;

  const headers = columns.map(col => col.header);
  const rows = data.map(row => 
    columns.map(col => {
      let value: any;
      if (typeof col.accessor === 'function') {
        value = col.accessor(row);
      } else {
        value = row[col.accessor];
      }
      if (col.format) {
        value = col.format(value);
      }
      if (value === null || value === undefined) {
        return '';
      }
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    })
  );

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToXLSX<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName: string = 'Data'
): void {
  if (data.length === 0) return;

  const headers = columns.map(col => col.header);
  const rows = data.map(row => 
    columns.map(col => {
      let value: any;
      if (typeof col.accessor === 'function') {
        value = col.accessor(row);
      } else {
        value = row[col.accessor];
      }
      if (col.format) {
        value = col.format(value);
      }
      if (value === null || value === undefined) {
        return '';
      }
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return value;
    })
  );

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  const colWidths = headers.map((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map(row => String(row[i]).length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
