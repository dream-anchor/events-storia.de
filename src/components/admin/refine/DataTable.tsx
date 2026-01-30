import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, X, RefreshCw } from "lucide-react";

interface FilterPill {
  id: string;
  label: string;
  value: string;
  active: boolean;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchColumn?: string;
  filterPills?: FilterPill[];
  onFilterChange?: (filterId: string, value: string) => void;
  onRefresh?: () => void;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  pageSize?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Suchen...",
  searchColumn,
  filterPills = [],
  onFilterChange,
  onRefresh,
  onRowClick,
  isLoading,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const activeFilters = useMemo(() => 
    filterPills.filter(f => f.active), 
    [filterPills]
  );

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        {onRefresh && (
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Filter Pills */}
      {filterPills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterPills.map((pill) => (
            <button
              key={pill.id}
              onClick={() => onFilterChange?.(pill.id, pill.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all",
                pill.active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {pill.label}
              {pill.active && (
                <X className="h-3 w-3 ml-1 hover:bg-primary-foreground/20 rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <span>Aktive Filter:</span>
          {activeFilters.map((filter) => (
            <Badge key={filter.id} variant="secondary" className="gap-1">
              {filter.label}
              <button
                onClick={() => onFilterChange?.(filter.id, '')}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-secondary/50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Laden...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "hover:bg-secondary/50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Keine Ergebnisse gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-base text-muted-foreground">
          Zeige {table.getState().pagination.pageIndex * pageSize + 1} bis{" "}
          {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, data.length)} von{" "}
          {data.length} Einträgen
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-medium">
            Seite {table.getState().pagination.pageIndex + 1} von {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
