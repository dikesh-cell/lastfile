"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/crm/data-table";
import { Search, Building2, Layers3 } from "lucide-react";
import { projectApi, unitApi } from "@/lib/api";
import { subscribeToUnitInventoryUpdates } from "@/lib/unit-inventory-events";
import { useToast } from "@/hooks/use-toast";

interface Unit {
  id: string;
  number: string;
  type: string | null;
  floor: number | null;
  area: number | null;
  price: number | null;
  status: string;
  project: { id: string; name: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

const formatCurrency = (amount: number | null) =>
  amount == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(amount);

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  HOLD: "bg-amber-100 text-amber-800",
  RESERVED: "bg-blue-100 text-blue-800",
  BOOKED: "bg-violet-100 text-violet-800",
  SOLD: "bg-slate-100 text-slate-800",
  BLOCKED: "bg-red-100 text-red-800",
};

const STATUS_OPTIONS = ["AVAILABLE", "HOLD", "RESERVED", "BOOKED", "SOLD", "BLOCKED"];

const filterLabelClass = "mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#1479a8]";
const filterControlClass = "h-9 w-full rounded-md border border-sky-200 bg-white px-3 text-[12px] text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

const columns: ColumnDef<Unit>[] = [
  {
    accessorKey: "number",
    header: "Unit",
    cell: ({ row }) => (
      <Link href={`/units/${row.original.id}`} className="font-semibold text-[#075d91] hover:underline">
        {row.original.number}
      </Link>
    ),
  },
  {
    id: "project",
    header: "Project",
    cell: ({ row }) => {
      const project = row.original.project;
      return project ? (
        <Link href={`/projects/${project.id}`} className="text-[#1479a8] hover:underline">
          {project.name}
        </Link>
      ) : "—";
    },
  },
  { accessorKey: "type", header: "Type", cell: ({ row }) => row.original.type || "—" },
  { accessorKey: "floor", header: "Floor", cell: ({ row }) => row.original.floor ?? "—" },
  {
    accessorKey: "area",
    header: "Area",
    cell: ({ row }) => row.original.area == null ? "—" : `${row.original.area} sq ft`,
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => formatCurrency(row.original.price),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge className={statusColors[row.original.status] || "bg-gray-100 text-gray-800"}>
        {row.original.status.replace(/_/g, " ")}
      </Badge>
    ),
  },
];

export default function UnitsPage() {
  const { toast } = useToast();
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [pagination, setPagination] = React.useState<Pagination>({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [projectOptions, setProjectOptions] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    projectApi
      .listAll()
      .then((all) => setProjectOptions(all.map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(() => setProjectOptions([]));
  }, []);

  const loadUnits = React.useCallback(async (page: number, query: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await unitApi.list({ page, limit: pagination.limit, search: query || undefined, projectId: projectFilter || undefined, status: statusFilter || undefined });
      setUnits(response.data.data || []);
      setPagination(response.data.pagination || { page, limit: pagination.limit, total: 0 });
    } catch (requestError: any) {
      const message = requestError?.response?.data?.error || "Unable to load units.";
      setError(message);
      toast({ title: "Unable to load units", description: message, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, toast, projectFilter, statusFilter]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void loadUnits(1, search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [loadUnits, search]);

  React.useEffect(
    () => subscribeToUnitInventoryUpdates(() => void loadUnits(pagination.page, search.trim())),
    [loadUnits, pagination.page, search],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-1 py-1">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 text-blue-600 shadow-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#075d91]">Units</h1>
          <p className="text-[12px] text-[#1479a8]">Browse inventory across your projects.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-sky-100 bg-[#f5fbff] p-3 shadow-sm sm:grid-cols-3 md:items-end">
        <div className="min-w-0">
          <label className={filterLabelClass}><Search className="h-3.5 w-3.5" />Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#278db8]" />
            <input
              type="text"
              aria-label="Search units"
              placeholder="Search unit number or type..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${filterControlClass} pl-8`}
            />
          </div>
        </div>
        <div className="min-w-0">
          <label className={filterLabelClass}><Building2 className="h-3.5 w-3.5" />Project</label>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={filterControlClass}>
            <option value="">All Projects</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className={filterLabelClass}><Layers3 className="h-3.5 w-3.5" />Status</label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={filterControlClass}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
      </div>

      <Card className="rounded-xl border-sky-100 shadow-sm">
        <CardContent className="space-y-4 p-4">
          {error ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => void loadUnits(pagination.page, search.trim())}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="[&_th]:bg-sky-50 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:text-[#1479a8] [&_tbody_td]:text-[#075d91]">
              <DataTable
                columns={columns}
                data={units}
                isLoading={loading}
                pageSize={pagination.limit}
                currentPage={pagination.page}
                totalItems={pagination.total}
                serverPagination
                onPageChange={(page) => void loadUnits(page, search.trim())}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
