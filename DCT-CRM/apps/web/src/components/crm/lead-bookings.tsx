"use client";

import * as React from "react";
import Image from "next/image";
import { AlertCircle, CalendarDays, Download, Eye, FileText, Loader2, MapPin, Printer, RefreshCw, UserRound } from "lucide-react";
import { bookingApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PdfDocumentPreview, type PdfPreviewDocument } from "@/components/crm/pdf-document-preview";
import { useToast } from "@/hooks/use-toast";

type JsonFields = Record<string, string | number | boolean | null | undefined>;

export interface BookingRecord {
  lead?: { id: string; leadNumber: string; firstName?: string | null; lastName: string; owner?: { id: string; firstName?: string | null; lastName?: string | null } | null };
  id: string;
  bookingNumber: string;
  status: string;
  bookingStage?: string;
  cancellationStatus?: string | null;
  cancellationReason?: string | null;
  cancellationReviewNote?: string | null;
  bookingAmount: number;
  createdAt: string;
  plotDetails: JsonFields;
  firstApplicant: JsonFields;
  secondApplicant?: JsonFields | null;
  profession: JsonFields;
  referredBy?: string | null;
  project: { name: string; address?: string | null; city?: string | null };
  unit: { number: string; type?: string | null; area?: number | null; status: string };
  quotation: {
    quotationNumber: string;
    customerName: string;
    projectName: string;
    unitNumber: string;
    area: number;
    basePrice: number;
    plcAmount: number;
    discountAmount: number;
    totalPrice: number;
    paymentPlanName: string;
    paymentPlan: { installments?: { milestone: string; percentage: number; dueMonths?: number; dueDays?: number }[] };
    terms?: string | null;
  };
  createdBy?: { firstName: string; lastName: string } | null;
  owner?: { id?: string; firstName?: string | null; lastName?: string | null } | null;
}

const currency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const display = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const displayDate = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));

function additionalApplicants(profession: BookingRecord["profession"]): JsonFields[] {
  const value = (profession as { additionalApplicants?: unknown }).additionalApplicants;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is JsonFields => !!item && typeof item === "object" && !Array.isArray(item));
}

const bookingStatusLabel = (status: string) => ({
  RESERVED: "Reserved",
  BOOKED: "Booked",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
}[status] || status);

const personName = (person?: { firstName?: string | null; lastName?: string | null } | null) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(" ") || "—";

function DetailField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800">{display(value)}</p>
    </div>
  );
}

function ApplicantDetails({ title, applicant }: { title: string; applicant: JsonFields }) {
  const fullName = [applicant.salutation, applicant.name].filter(Boolean).join(" ");
  const addressFields = [
    ["Corresponding address", applicant.correspondingAddress],
    ["Permanent address", applicant.permanentAddress],
  ] as const;
  const personalFields = [
    ["Date of birth", applicant.dateOfBirth],
    ["Relation", [applicant.relationType, applicant.relationshipName].filter(Boolean).join(" ")],
    ["Nationality", applicant.nationality],
    ["Aadhaar number", applicant.aadhaarNumber],
    ["PAN number", applicant.panNumber],
    ["Email", applicant.email],
    ["Mobile number", applicant.mobileNumber],
    ["Alternate number", applicant.alternateNumber],
    ["Marital status", applicant.maritalStatus],
    ["State", applicant.state],
    ["District", applicant.district],
  ] as const;

  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="truncate text-sm text-slate-500">{fullName || "Applicant"}</p>
        </div>
        {typeof applicant.photoUrl === "string" && applicant.photoUrl.startsWith("data:image/") && (
          <Image
            src={applicant.photoUrl}
            alt={`${fullName || title} photo`}
            width={88}
            height={100}
            unoptimized
            className="h-24 w-20 rounded-md border object-cover"
          />
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {personalFields.map(([label, value]) => <DetailField key={label} label={label} value={value} />)}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {addressFields.map(([label, value]) => <DetailField key={label} label={label} value={value} />)}
      </div>
    </section>
  );
}

export function LeadBookings({ leadId }: { leadId: string }) {
  const { toast } = useToast();
  const [bookings, setBookings] = React.useState<BookingRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = React.useState<BookingRecord | null>(null);
  const [pdfAction, setPdfAction] = React.useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = React.useState<PdfPreviewDocument | null>(null);

  const loadBookings = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookingApi.listForLead(leadId);
      setBookings((response.data.data || []) as BookingRecord[]);
    } catch (cause) {
      console.error("Failed to load lead bookings:", cause);
      const message = (cause as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(message || "Bookings could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  React.useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const closePdfPreview = () => {
    setPdfPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const fetchBookingPdf = async (booking: BookingRecord) => {
    const response = await bookingApi.downloadPdf(leadId, booking.id);
    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  };

  const previewPdf = async (booking: BookingRecord) => {
    try {
      setPdfAction(`${booking.id}:preview`);
      const url = await fetchBookingPdf(booking);
      setPdfPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return {
          number: booking.bookingNumber,
          url,
          eyebrow: "Booking preview",
          description: "Download and print use the saved booking PDF.",
        };
      });
    } catch (cause) {
      console.error("Failed to preview booking PDF:", cause);
      toast({
        title: "Could not preview PDF",
        description: "The booking PDF could not be generated. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPdfAction(null);
    }
  };

  const downloadPdf = async (booking: BookingRecord) => {
    try {
      setPdfAction(`${booking.id}:download`);
      const url = await fetchBookingPdf(booking);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${booking.bookingNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      console.error("Failed to download booking PDF:", cause);
      toast({
        title: "Could not download PDF",
        description: "The booking PDF could not be generated. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPdfAction(null);
    }
  };

  const printPdf = async (booking: BookingRecord) => {
    try {
      setPdfAction(`${booking.id}:print`);
      const url = await fetchBookingPdf(booking);
      const frame = document.createElement("iframe");
      frame.setAttribute("title", `${booking.bookingNumber} print`);
      frame.style.cssText = "position:fixed;width:0;height:0;border:0;";
      frame.src = url;
      document.body.appendChild(frame);
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        window.setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 1500);
      };
    } catch (cause) {
      console.error("Failed to print booking PDF:", cause);
      toast({
        title: "Could not print PDF",
        description: "The booking PDF could not be generated. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPdfAction(null);
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/40 px-5 py-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-700 text-white"><FileText className="h-5 w-5" /></span>
              Booking Details
              <Badge variant="secondary">{bookings.length}</Badge>
            </CardTitle>
            <p className="ml-11 mt-1 text-xs text-muted-foreground">Saved bookings, applicant records, and downloadable PDF documents.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadBookings()} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-5">
          {loading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />Loading booking records…
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-600" />
              <p role="alert" className="text-sm text-rose-800">{error}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void loadBookings()}>Retry</Button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-white text-indigo-600"><FileText className="h-6 w-6" /></span>
              <h3 className="mt-3 font-semibold text-slate-900">No bookings yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Once a booking is saved from a quotation, its applicant details and PDF download will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {bookings.map((booking) => (
                <article key={booking.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-3 border-b bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Booking number</p>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">{booking.bookingNumber}</h3>
                      <p className="mt-1 text-xs text-slate-600">Quotation {booking.quotation.quotationNumber}</p>
                    </div>
                    <Badge variant="secondary">{bookingStatusLabel(booking.status)}</Badge>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <div className="flex items-start gap-2 rounded-md border bg-white p-3">
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                      <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-slate-500">Applicant</p><p className="truncate text-sm font-semibold">{display(booking.firstApplicant.name)}</p></div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md border bg-white p-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                      <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-slate-500">Project / plot</p><p className="truncate text-sm font-semibold">{booking.project.name} · {booking.unit.number}</p></div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md border bg-white p-3">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                      <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Booking date</p><p className="text-sm font-semibold">{displayDate(booking.createdAt)}</p></div>
                    </div>
                    <div className="rounded-md border bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Booking amount</p>
                      <p className="text-sm font-semibold text-slate-900">{currency(booking.bookingAmount)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t bg-slate-50 px-4 py-3">
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setSelectedBooking(booking)}>
                      <FileText className="h-4 w-4" />View
                    </Button>
                    <Button type="button" size="sm" className="w-full bg-[#0b2545] text-white hover:bg-[#08182d]" disabled={pdfAction?.startsWith(`${booking.id}:`)} onClick={() => void previewPdf(booking)}>
                      {pdfAction === `${booking.id}:preview` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      Preview PDF
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="w-full" disabled={pdfAction?.startsWith(`${booking.id}:`)} onClick={() => void downloadPdf(booking)}>
                      {pdfAction === `${booking.id}:download` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Download PDF
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="w-full" disabled={pdfAction?.startsWith(`${booking.id}:`)} onClick={() => void printPdf(booking)}>
                      {pdfAction === `${booking.id}:print` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                      Print
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BookingDetailsDialog
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onPreview={(booking) => void previewPdf(booking)}
        onDownload={(booking) => void downloadPdf(booking)}
        onPrint={(booking) => void printPdf(booking)}
        busyAction={selectedBooking && pdfAction?.startsWith(`${selectedBooking.id}:`) ? pdfAction : null}
      />
      <PdfDocumentPreview preview={pdfPreview} onClose={closePdfPreview} />
    </>
  );
}

export function BookingDetailsBody({ booking }: { booking: BookingRecord }) {
  return (
              <div className="space-y-5">
                <section>
                  <h3 className="mb-3 font-semibold text-slate-900">Booking and property summary</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label="Booking number" value={booking.bookingNumber} />
                    <DetailField label="Booking status" value={bookingStatusLabel(booking.status)} />
                    <DetailField label="Owner" value={personName(booking.owner)} />
                    <DetailField label="Booking date" value={displayDate(booking.createdAt)} />
                    <DetailField label="Quotation" value={booking.quotation.quotationNumber} />
                    <DetailField label="Project" value={booking.project.name} />
                    <DetailField label="Plot number" value={booking.unit.number} />
                    <DetailField label="Unit type" value={booking.unit.type} />
                    <DetailField label="Facing direction" value={booking.plotDetails.facingDirection} />
                    <DetailField label="Area (sq ft)" value={booking.unit.area} />
                    <DetailField label="Area (cents)" value={booking.plotDetails.areaCent} />
                    <DetailField label="Basic price" value={currency(booking.quotation.basePrice)} />
                    <DetailField label="Booking amount" value={currency(booking.bookingAmount)} />
                    <DetailField label="PLC / other charges" value={currency(booking.quotation.plcAmount)} />
                    <DetailField label="Discount" value={currency(booking.quotation.discountAmount)} />
                    <DetailField label="Total cost" value={currency(booking.quotation.totalPrice)} />
                    <DetailField label="Project address" value={[booking.project.address, booking.project.city].filter(Boolean).join(", ")} />
                  </div>
                </section>

                <ApplicantDetails title="First applicant" applicant={booking.firstApplicant} />
                {booking.secondApplicant?.name && (
                  <ApplicantDetails title="Second applicant" applicant={booking.secondApplicant} />
                )}
                {additionalApplicants(booking.profession).map((applicant, index) => (
                  <ApplicantDetails key={`${applicant.name || "applicant"}-${index}`} title={index === 0 ? "Third applicant" : "Fourth applicant"} applicant={applicant} />
                ))}

                <section className="rounded-lg border bg-white p-4">
                  <h3 className="mb-3 font-semibold text-slate-900">Profession and referral</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label="Organization type" value={booking.profession.organizationType} />
                    <DetailField label="Industry" value={booking.profession.industry} />
                    <DetailField label="Referred by" value={booking.referredBy} />
                    <DetailField label="Created by" value={booking.createdBy ? `${booking.createdBy.firstName} ${booking.createdBy.lastName}` : "—"} />
                  </div>
                </section>

                <section className="rounded-lg border bg-white p-4">
                  <h3 className="font-semibold text-slate-900">Payment plan</h3>
                  <p className="mt-1 text-sm text-indigo-700">{booking.quotation.paymentPlanName}</p>
                  {booking.quotation.terms && <p className="mt-4 whitespace-pre-wrap border-t pt-3 text-sm"><span className="font-semibold">Terms and notes:</span> {booking.quotation.terms}</p>}
                </section>
              </div>
  );
}

export function BookingDetailsDialog({
  booking: selectedBooking,
  onClose,
  onPreview,
  onDownload,
  onPrint,
  busyAction,
}: {
  booking: BookingRecord | null;
  onClose: () => void;
  onPreview: (booking: BookingRecord) => void;
  onDownload: (booking: BookingRecord) => void;
  onPrint: (booking: BookingRecord) => void;
  busyAction: string | null;
}) {
  return (
      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
          {selectedBooking && (
            <>
              <div className="border-b bg-muted/40 px-6 py-5">
                <DialogHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-sm bg-indigo-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-800">Booking record</span>
                    <Badge variant="secondary">{selectedBooking.status}</Badge>
                  </div>
                  <DialogTitle className="text-2xl text-slate-900">{selectedBooking.bookingNumber}</DialogTitle>
                  <DialogDescription>
                    {selectedBooking.project.name} · Plot {selectedBooking.unit.number} · {selectedBooking.quotation.quotationNumber}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-5 sm:p-6"><BookingDetailsBody booking={selectedBooking} /></div>
              <DialogFooter className="gap-2 border-t bg-white px-5 py-4 sm:px-6">
                <Button type="button" size="sm" className="bg-[#0b2545] text-white hover:bg-[#08182d]" disabled={!!busyAction} onClick={() => onPreview(selectedBooking)}>
                  {busyAction?.endsWith(":preview") ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}
                  Preview PDF
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!!busyAction} onClick={() => onDownload(selectedBooking)}>
                  {busyAction?.endsWith(":download") ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                  Download PDF
                </Button>
                <Button type="button" size="sm" className="bg-[#c6a15b] text-[#0b2545] hover:bg-[#b58d45]" disabled={!!busyAction} onClick={() => onPrint(selectedBooking)}>
                  {busyAction?.endsWith(":print") ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}
                  Print
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
  );
}
