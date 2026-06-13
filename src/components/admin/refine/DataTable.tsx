import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  RowSelectionState,
  flexRender,
  Column,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, X, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, CheckSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function sortableHeader<TData>(label: string) {
  const HeaderCell = ({ column }: { column: Column<TData, unknown> }) => {
    if (!column.getCanSort()) {
      return <span>{label}</span>;
    }
    const sorted = column.getIsSorted();
    return (
      <button
        type="button"
        onClick={() => column.toggleSorting(sorted === "asc")}
        className={cn(
          "inline-flex items-center gap-1 -ml-1 px-1 py-1 rounded hover:bg-muted/60 transition-colors select-none uppercase tracking-wider text-xs font-semibold",
          sorted ? "text-foreground" : "text-muted-foreground"
        )}
        aria-label={`Sortieren nach ${label}`}
      >
        <span>{label}</span>
        {sorted === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : sorted === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    );
  };
  HeaderCell.displayName = `SortableHeader(${label})`;
  return HeaderCell;
}

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
  // Selection support
  enableSelection?: boolean;
  selectedRowIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  getRowId?: (row: TData) => string;
  defaultSorting?: SortingState;
  /** Optional renderer to display each row as a card on mobile (< lg). */
  mobileCardRender?: (row: TData) => React.ReactNode;
  /** Optional per-row className (applied to TableRow on desktop). */
  rowClassName?: (row: TData) => string | undefined;
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
  enableSelection = false,
  selectedRowIds = [],
  onSelectionChange,
  getRowId,
  defaultSorting = [],
  mobileCardRender,
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const isMobile = useIsMobile();
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [mobileSelectionMode, setMobileSelectionMode] = useState(false);

  // Sync external selection with internal state
  useEffect(() => {
    if (enableSelection && getRowId) {
      const newSelection: RowSelectionState = {};
      selectedRowIds.forEach((id) => {
        const rowIndex = data.findIndex((row) => getRowId(row) === id);
        if (rowIndex !== -1) {
          newSelection[rowIndex] = true;
        }
      });
      setRowSelection(newSelection);
    }
  }, [selectedRowIds, data, enableSelection, getRowId]);

  // Handle selection changes
  const handleRowSelectionChange = (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
    const newSelection = typeof updater === "function" ? updater(rowSelection) : updater;
    setRowSelection(newSelection);

    if (onSelectionChange && getRowId) {
      const selectedIds = Object.keys(newSelection)
        .filter((key) => newSelection[key])
        .map((key) => {
          const row = data[parseInt(key)];
          return row ? getRowId(row) : null;
        })
        .filter(Boolean) as string[];
      onSelectionChange(selectedIds);
    }
  };

  // Create selection column
  const selectionColumn: ColumnDef<TData, TValue> = {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Alle auswählen"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Zeile auswählen"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };

  // Prepend selection column if enabled
  const allColumns = useMemo(() => {
    if (enableSelection) {
      return [selectionColumn, ...columns];
    }
    return columns;
  }, [columns, enableSelection]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: enableSelection ? handleRowSelectionChange : undefined,
    enableRowSelection: enableSelection,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection: enableSelection ? rowSelection : {},
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
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {isMobile && mobileSelectionMode && enableSelection ? (
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-sm">
                {Object.keys(rowSelection).filter(k => rowSelection[k]).length} ausgewählt
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={() => {
                  const allSelected: RowSelectionState = {};
                  table.getRowModel().rows.forEach((r) => {
                    allSelected[r.index] = true;
                  });
                  handleRowSelectionChange(allSelected);
                }}
              >
                Alle
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 gap-1"
              onClick={() => {
                setMobileSelectionMode(false);
                handleRowSelectionChange({});
              }}
            >
              <X className="h-3.5 w-3.5" />
              Abbrechen
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 h-10 bg-white dark:bg-gray-900 border-border/60 rounded-lg focus-visible:ring-primary/20"
              />
            </div>
            {isMobile && enableSelection && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileSelectionMode(true)}
                className="h-10 w-10 border-border/60 shrink-0"
                title="Auswählen"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            )}
            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-10 w-10 border-border/60 shrink-0"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter Pills */}
      {filterPills.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
          {filterPills.map((pill) => (
            <button
              key={pill.id}
              onClick={() => onFilterChange?.(pill.id, pill.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border whitespace-nowrap shrink-0",
                pill.active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white dark:bg-gray-800 text-muted-foreground border-border/60 hover:border-primary/50 hover:text-foreground"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}

      {/* Mobile card list (when renderer provided) */}
      {isMobile && mobileCardRender ? (
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Laden...
            </div>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              mobileSelectionMode && enableSelection ? (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border p-3 transition-all cursor-pointer",
                    row.getIsSelected()
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-white dark:bg-gray-900"
                  )}
                  onClick={() => row.toggleSelected(!row.getIsSelected())}
                >
                  <div className="pt-1 shrink-0">
                    <Checkbox
                      checked={row.getIsSelected()}
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                      aria-label="Zeile auswählen"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {mobileCardRender(row.original)}
                  </div>
                </div>
              ) : (
                <div key={row.id}>{mobileCardRender(row.original)}</div>
              )
            ))
          ) : (
            <div className="rounded-xl border border-border/60 bg-white dark:bg-gray-900 py-12 text-center text-muted-foreground">
              Keine Ergebnisse gefunden.
            </div>
          )}
        </div>
      ) : (
      /* Table */
      <div className="rounded-xl border border-border/60 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/30 dark:bg-gray-800/50 border-b border-border/60">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3">
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
                <TableCell colSpan={allColumns.length} className="h-24 text-center">
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
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "hover:bg-muted/30 dark:hover:bg-gray-800/30 transition-colors border-b border-border/40 last:border-b-0",
                    onRowClick && "cursor-pointer",
                    row.getIsSelected() && "bg-primary/5",
                    rowClassName?.(row.original)
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={allColumns.length} className="h-24 text-center text-muted-foreground">
                  Keine Ergebnisse gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Zeige {table.getState().pagination.pageIndex * pageSize + 1} bis{" "}
          {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, data.length)} von{" "}
          {data.length} Einträgen
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 border-border/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 border-border/60"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
