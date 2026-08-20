"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, FolderOpen } from "lucide-react";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchKey: keyof T;
  searchPlaceholder?: string;
  onAddNew: () => void;
  addNewLabel?: string;
  title: string;
  description?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search records...",
  onAddNew,
  addNewLabel = "Add New",
  title,
  description,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = data.filter((item) => {
    const value = item[searchKey];
    if (value === undefined || value === null) return false;
    return String(value).toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>
        <Button onClick={onAddNew} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" />
          {addNewLabel}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <Search className="h-4 w-4 text-slate-400 ml-2" />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0 text-sm"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm("")}
            className="text-xs text-slate-500"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm min-h-[300px]">
          <div className="p-4 rounded-full bg-gold-100 mb-4">
            <FolderOpen className="h-10 w-10 text-gold-600" />
          </div>
          <h3 className="text-lg font-semibold text-navy-900">
            {searchTerm ? "No matching records found" : "No data available yet"}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
            {searchTerm
              ? `No results match your search "${searchTerm}". Try a different keyword.`
              : `Get started by creating your first entry in ${title.toLowerCase()}.`}
          </p>
          <Button onClick={onAddNew} variant="gold" className="gap-2">
            <Plus className="h-4 w-4" />
            {addNewLabel}
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-navy-900 border-none hover:bg-navy-900">
              {columns.map((col, idx) => (
                <TableHead key={idx} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((row, rowIdx) => (
              <TableRow key={rowIdx}>
                {columns.map((col, colIdx) => (
                  <TableCell key={colIdx} className={col.className}>
                    {col.cell
                      ? col.cell(row)
                      : col.accessorKey
                      ? String(row[col.accessorKey] ?? "")
                      : null}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
