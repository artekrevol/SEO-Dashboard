import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportToCSV, exportToXLSX, type ExportColumn } from "@/lib/export-utils";

interface ExportButtonProps<T extends Record<string, any>> {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  sheetName?: string;
  disabled?: boolean;
}

export function ExportButton<T extends Record<string, any>>({
  data,
  columns,
  filename,
  sheetName = "Data",
  disabled = false,
}: ExportButtonProps<T>) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "csv" | "xlsx") => {
    if (data.length === 0) return;
    
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const timestamp = new Date().toISOString().split('T')[0];
      const fullFilename = `${filename}_${timestamp}`;
      
      if (format === "csv") {
        exportToCSV(data, columns, fullFilename);
      } else {
        exportToXLSX(data, columns, fullFilename, sheetName);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="default"
          disabled={disabled || data.length === 0 || isExporting}
          data-testid="button-export"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="ml-2">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => handleExport("csv")}
          data-testid="button-export-csv"
        >
          <FileText className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport("xlsx")}
          data-testid="button-export-xlsx"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
