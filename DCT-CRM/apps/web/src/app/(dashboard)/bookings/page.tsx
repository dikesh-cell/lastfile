"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Download, ExternalLink, Eye, Loader2, RefreshCw } from "lucide-react";
import { bookingApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BOOKING_STAGE_OPTIONS } from "@dct-crm/shared";
import { type BookingRecord } from "@/components/crm/lead-bookings";
import { PdfDocumentPreview, type PdfPreviewDocument } from "@/components/crm/pdf-document-preview";
import { useToast } from "@/hooks/use-toast";

type BookingRow = BookingRecord & { lead: NonNullable<BookingRecord["lead"]> };

const currency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export default function BookingDetailsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoading: authLoading, isAdmin, isSuperAdmin, profile } = useAuth();
  const allowed = isAdmin || isSuperAdmin || /^crm(?:\s|$)/i.test(profile?.name?.trim() || "");

  const [rows, setRows] = React.useState<BookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = React.useState<PdfPreviewDocument | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookingApi.listAll();
      setRows((response.data.data || []) as BookingRow[]);
    } catch (cause) {
      console.error("Failed to load bookings:", cause);
      setError("Bookings could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (authLoading) return;
    if (!allowed) {
      router.replace("/home");
      return;
    }
    void load();
  }, [authLoading, allowed, load, router]);

  const closePdfPreview = () => {
    setPdfPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const previewPdf = async (row: BookingRow) => {
    try {
      setPreviewingId(row.id);
      const response = await bookingApi.downloadPdf(row.lead.id, row.id);
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return {
          number: row.bookingNumber,
          url,
          eyebrow: "Booking preview",
          description: "Download and print use the saved booking PDF.",
        };
      });
    } catch {
      toast({ title: "Could not preview PDF", variant: "destructive" });
    } finally {
      setPreviewingId(null);
    }
  };

  const downloadPdf = async (row: BookingRow) => {
    try {
      setDownloadingId(row.id);
      const response = await bookingApi.downloadPdf(row.lead.id, row.id);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${row.bookingNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast({ title: "Could not download PDF", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter((row) =>
        [row.bookingNumber, row.quotation.customerName, row.lead.leadNumber, row.project.name, row.unit.number]
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
    : rows;

  if (authLoading || !allowed) return null;

  return (
    <>
    <Card className="overflow-hidden border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-sky-50/60 px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1479a8] text-white">
            <BookOpenCheck className="h-5 w-5" />
          </span>
          Booking Details
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search booking, customer, unit…"
            className="h-9 w-64"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />Loading bookings…
          </div>
        ) : error ? (
          <p role="alert" className="p-6 text-center text-sm text-rose-700">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-500">No bookings found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-sky-50 text-[#075d91] hover:bg-sky-50 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:text-[#075d91]">
                  <TableHead>Booking</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Project / Unit</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Booking Amount</TableHead>
                  <TableHead>Booking Status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer hover:bg-sky-50/50" onClick={() => router.push(`/bookings/${row.id}`)}>
                    <TableCell>
                      <Link href={`/bookings/${row.id}`} onClick={(event) => event.stopPropagation()} className="font-mono text-sm font-medium text-[#1479a8] hover:text-[#075d91] hover:underline">
                        {row.bookingNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-[#075d91]">{row.quotation.customerName}</p>
                      <p className="text-xs text-slate-500">{row.lead.leadNumber}</p>
                    </TableCell>
                    <TableCell>{row.project.name} · {row.unit.number}</TableCell>
                    <TableCell>{row.quotation.paymentPlanName}</TableCell>
                    <TableCell className="text-right">{currency(row.quotation.totalPrice)}</TableCell>
                    <TableCell className="text-right">{currency(row.bookingAmount)}</TableCell>
                    <TableCell>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${row.bookingStage === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-[#dce9f3] text-[#3573a5]"}`}>
                        {BOOKING_STAGE_OPTIONS.find((option) => option.value === (row.bookingStage || "NEW_BOOKING"))?.label}
                      </span>
                      {row.cancellationStatus === "PENDING" && <p className="mt-0.5 text-[10px] text-amber-700">Cancellation pending</p>}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${row.status === "CANCELLED" ? "bg-red-100 text-red-700" : row.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {row.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(row.createdAt).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        {(isAdmin || isSuperAdmin) && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/leads/${row.lead.id}`}><ExternalLink className="mr-1.5 h-4 w-4" />Lead</Link>
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          className="bg-[#0b2545] text-white hover:bg-[#08182d]"
                          onClick={() => void previewPdf(row)}
                          disabled={previewingId === row.id}
                        >
                          {previewingId === row.id
                            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            : <Eye className="mr-1.5 h-4 w-4" />}
                          Preview
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void downloadPdf(row)}
                          disabled={downloadingId === row.id}
                        >
                          {downloadingId === row.id
                            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            : <Download className="mr-1.5 h-4 w-4" />}
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
    <PdfDocumentPreview preview={pdfPreview} onClose={closePdfPreview} />
    </>
  );
}
