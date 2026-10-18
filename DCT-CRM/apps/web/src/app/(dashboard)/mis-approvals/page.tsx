"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Clock3, ExternalLink, FileCheck2, Loader2, RefreshCw, X } from "lucide-react";
import { quotationDueLabel } from "@dct-crm/shared";
import { receiptApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingCancellationRequests } from "@/components/crm/booking-cancellation-requests";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type ApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
type JsonRecord = Record<string, unknown>;

interface ApprovalPacket {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  receivedFrom: string;
  amount: number;
  paymentMode: string;
  transactionId?: string | null;
  receivedDate: string;
  approvalStatus: ApprovalStatus;
  approvalSubmittedAt: string;
  approvalReviewedAt?: string | null;
  approvalNote?: string | null;
  lead: {
    id: string;
    leadNumber?: string | null;
    firstName?: string | null;
    lastName: string;
    company: string;
    mobile?: string | null;
    email?: string | null;
    status: string;
    owner?: { firstName: string; lastName: string; profile?: { name: string } | null } | null;
  };
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    bookingAmount: number;
    createdAt: string;
    referredBy?: string | null;
    firstApplicant: JsonRecord;
    secondApplicant?: JsonRecord | null;
    profession: JsonRecord;
    plotDetails: JsonRecord;
    project: { name: string; address?: string | null; city?: string | null };
    unit: { number: string; type?: string | null; area?: number | null; status: string };
    quotation: {
      quotationNumber: string;
      customerName: string;
      customerPhone?: string | null;
      customerEmail?: string | null;
      customerAddress?: string | null;
      projectName: string;
      unitNumber: string;
      unitType?: string | null;
      area: number;
      pricePerSqFt: number;
      basePrice: number;
      plcAmount: number;
      discountAmount: number;
      totalPrice: number;
      paymentPlanName: string;
      paymentPlan: { installments?: { milestone: string; percentage: number; dueMonths?: number; dueDays?: number }[] };
      terms?: string | null;
      siteVisit: { status: string; completedAt?: string | null; scheduledAt?: string | null };
    };
  };
  createdBy: { firstName: string; lastName: string };
  reviewedBy?: { firstName: string; lastName: string } | null;
}

type QueueFilter = "PENDING_APPROVAL" | "REVIEWED" | "ALL";

const currency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
const dateText = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value))
  : "—";
const text = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return "—";
  return String(value);
};
const fullName = (applicant?: JsonRecord | null) =>
  [applicant?.salutation, applicant?.name].filter(Boolean).map(String).join(" ") || "—";

function Detail({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  return (
    <div className={`min-w-0 border-b border-slate-100 py-2 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1479a8]">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-slate-800">{text(value)}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-sky-100 bg-white p-4">
      <h3 className="mb-3 border-b border-sky-100 pb-2 text-sm font-semibold text-[#075d91]">{title}</h3>
      <div className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

const applicantFields: Array<[string, string]> = [
  ["Date of birth", "dateOfBirth"],
  ["Relationship", "relationType"],
  ["Relationship name", "relationshipName"],
  ["Nationality", "nationality"],
  ["Aadhaar number", "aadhaarNumber"],
  ["PAN number", "panNumber"],
  ["Email", "email"],
  ["Mobile number", "mobileNumber"],
  ["Alternate number", "alternateNumber"],
  ["Marital status", "maritalStatus"],
  ["State", "state"],
  ["District", "district"],
];

function ApplicantSection({ title, applicant }: { title: string; applicant?: JsonRecord | null }) {
  if (!applicant || !Object.values(applicant).some((value) => value !== null && value !== undefined && value !== "" && value !== false)) {
    return <Section title={title}><Detail label="Applicant" value="Not provided" /></Section>;
  }
  const photoUrl = typeof applicant.photoUrl === "string" && applicant.photoUrl.startsWith("data:image/")
    ? applicant.photoUrl
    : null;

  return (
    <Section title={`${title} · ${fullName(applicant)}`}>
      {photoUrl && (
        <div className="row-span-4 flex items-start py-2 lg:col-span-1 lg:row-span-5">
          <Image src={photoUrl} alt={`${title} photo`} width={96} height={112} unoptimized className="h-28 w-24 rounded-md border object-cover" />
        </div>
      )}
      {applicantFields.map(([label, key]) => (
        <Detail key={key} label={label} value={key === "dateOfBirth" && applicant[key] ? dateText(String(applicant[key])) : applicant[key]} />
      ))}
      <Detail label="Same as corresponding address" value={applicant.sameAddress} />
      <Detail label="Corresponding address" value={applicant.correspondingAddress} wide />
      <Detail label="Permanent address" value={applicant.permanentAddress} wide />
    </Section>
  );
}

const plotFields: Array<[string, string, "currency" | "area" | "number" | "text"]> = [
  ["Plot / unit number", "plotNumber", "text"],
  ["Project", "projectName", "text"],
  ["Unit type", "unitType", "text"],
  ["Facing direction", "facingDirection", "text"],
  ["Area", "areaSqFt", "area"],
  ["Area (cents)", "areaCent", "number"],
  ["Basic price", "basicPrice", "currency"],
  ["Total cost", "totalCostOfFlat", "currency"],
  ["Quotation number", "quotationNumber", "text"],
  ["Booking amount", "bookingAmount", "currency"],
];

function BookingPlotDetails({ details }: { details: JsonRecord }) {
  return (
    <Section title="Plot / Unit Details">
      {plotFields.map(([label, key, format]) => {
        const value = details[key];
        const formatted = value === null || value === undefined || value === ""
          ? "—"
          : format === "currency"
            ? currency(Number(value))
            : format === "area"
              ? `${Number(value).toLocaleString("en-IN")} sq ft`
              : format === "number"
                ? Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 })
                : value;
        return <Detail key={key} label={label} value={formatted} />;
      })}
    </Section>
  );
}

export default function MISApprovalsPage() {
  const { toast } = useToast();
  const [packets, setPackets] = React.useState<ApprovalPacket[]>([]);
  const [filter, setFilter] = React.useState<QueueFilter>("PENDING_APPROVAL");
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);

  const loadPackets = React.useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await receiptApi.listApprovals();
      setPackets((response.data.data || []) as ApprovalPacket[]);
    } catch (cause) {
      console.error("Failed to load MIS approval packets:", cause);
      const message = (cause as { response?: { data?: { error?: string } } }).response?.data?.error;
      setLoadError(message || "Approval packets could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPackets();
  }, [loadPackets]);

  const filteredPackets = packets.filter((packet) => {
    if (filter === "ALL") return true;
    if (filter === "REVIEWED") return packet.approvalStatus !== "PENDING_APPROVAL";
    return packet.approvalStatus === filter;
  });

  const review = async (packet: ApprovalPacket, decision: "APPROVE" | "REJECT") => {
    setReviewingId(packet.id);
    try {
      const response = await receiptApi.reviewApproval(packet.id, {
        decision,
        note: notes[packet.id]?.trim() || undefined,
      });
      const assignedCRMUserId = response.data.data?.assignment?.assignedUserId as string | undefined;
      setPackets((current) => current.map((item) => item.id === packet.id
        ? {
            ...item,
            approvalStatus: decision === "APPROVE" ? "APPROVED" : "REJECTED",
            approvalReviewedAt: new Date().toISOString(),
            approvalNote: notes[packet.id]?.trim() || null,
          }
        : item));
      toast({
        title: decision === "APPROVE" ? "Packet approved" : "Packet rejected",
        description: decision === "APPROVE"
          ? `The lead was assigned to CRM${assignedCRMUserId ? ` (${assignedCRMUserId})` : ""} by round robin.`
          : "The packet was rejected and the reserved unit was released.",
      });
    } catch (cause) {
      console.error(`Failed to ${decision.toLowerCase()} approval packet:`, cause);
      const message = (cause as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast({
        title: decision === "APPROVE" ? "Could not approve packet" : "Could not reject packet",
        description: message || "Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="crm-sky mx-auto w-full max-w-none space-y-5 p-4 md:p-6 [&_button.border]:border-sky-200 [&_button.border]:text-[#075d91] [&_button.border:hover]:bg-sky-50">
      <BookingCancellationRequests />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1479a8]">MIS Team</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#075d91]">Commercial Approvals</h1>
          <p className="mt-1 text-sm text-[#1479a8]">Review the quotation, booking, and receipt together before handing an approved lead to CRM.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadPackets()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh
        </Button>
      </div>

      {loadError && (
        <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p role="alert" className="text-sm text-rose-700">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadPackets()}>Retry</Button>
        </CardContent></Card>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Approval packet status">
        {([
          ["PENDING_APPROVAL", "Pending"],
          ["REVIEWED", "Reviewed"],
          ["ALL", "All packets"],
        ] as const).map(([value, label]) => {
          const count = value === "PENDING_APPROVAL"
            ? packets.filter((packet) => packet.approvalStatus === value).length
            : value === "REVIEWED"
              ? packets.filter((packet) => packet.approvalStatus !== "PENDING_APPROVAL").length
              : packets.length;
          return (
            <Button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {label}<Badge variant="secondary" className="ml-2">{count}</Badge>
            </Button>
          );
        })}
      </div>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading approval packets…</CardContent></Card>
      ) : filteredPackets.length === 0 ? (
        <Card className="rounded-xl border-sky-100 bg-[#f5fbff]"><CardContent className="py-14 text-center">
          <Clock3 className="mx-auto h-8 w-8 text-sky-300" />
          <p className="mt-3 text-sm font-semibold text-[#075d91]">{filter === "PENDING_APPROVAL" ? "No packets are waiting for MIS approval" : "No packets found"}</p>
          <p className="mt-1 text-xs text-[#1479a8]">Submitted receipt packets will appear here with their quotation and booking details.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filteredPackets.map((packet) => (
            <Card key={packet.id} className="overflow-hidden rounded-xl border-sky-100 bg-[#f5fbff]">
              <CardHeader className="border-b border-sky-100 bg-gradient-to-r from-sky-50 to-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-100 text-blue-600"><FileCheck2 className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{packet.receiptNumber} <span className="font-normal text-slate-500">· {packet.lead.leadNumber || packet.lead.id}</span></CardTitle>
                    <p className="mt-1 text-xs text-slate-500">
                      {packet.lead.firstName} {packet.lead.lastName} · Submitted {dateText(packet.approvalSubmittedAt)} · Prepared by {packet.createdBy.firstName} {packet.createdBy.lastName}
                    </p>
                  </div>
                  <Badge variant={packet.approvalStatus === "APPROVED" ? "default" : packet.approvalStatus === "REJECTED" ? "destructive" : "secondary"}>
                    {packet.approvalStatus === "PENDING_APPROVAL" ? "Pending MIS" : packet.approvalStatus}
                  </Badge>
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link href={`/leads/${packet.lead.id}`}>Lead <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <Section title={`Quotation · ${packet.booking.quotation.quotationNumber}`}>
                  <Detail label="Project" value={packet.booking.quotation.projectName} />
                  <Detail label="Plot / Unit" value={`${packet.booking.quotation.unitNumber} · ${packet.booking.quotation.unitType || packet.booking.unit.type || "Unit"}`} />
                  <Detail label="Area" value={`${packet.booking.quotation.area.toLocaleString("en-IN")} sq ft`} />
                  <Detail label="Customer" value={packet.booking.quotation.customerName} />
                  <Detail label="Customer phone" value={packet.booking.quotation.customerPhone} />
                  <Detail label="Customer email" value={packet.booking.quotation.customerEmail} />
                  <Detail label="Rate" value={currency(packet.booking.quotation.pricePerSqFt)} />
                  <Detail label="Base price" value={currency(packet.booking.quotation.basePrice)} />
                  <Detail label="PLC / discount" value={`${currency(packet.booking.quotation.plcAmount)} / ${currency(packet.booking.quotation.discountAmount)}`} />
                  <Detail label="Quotation total" value={currency(packet.booking.quotation.totalPrice)} />
                  <Detail label="Payment plan" value={packet.booking.quotation.paymentPlanName} />
                  <Detail label="Site visit" value={`${packet.booking.quotation.siteVisit.status} · ${dateText(packet.booking.quotation.siteVisit.completedAt || packet.booking.quotation.siteVisit.scheduledAt)}`} />
                  <Detail label="Site address" value={[packet.booking.project.address, packet.booking.project.city].filter(Boolean).join(", ")} wide />
                  {packet.booking.quotation.paymentPlan.installments?.map((item, index) => (
                    <Detail key={`${item.milestone}-${index}`} label={`Installment ${index + 1}`} value={`${item.milestone} · ${item.percentage}% · ${quotationDueLabel(item)}`} />
                  ))}
                  <Detail label="Customer address" value={packet.booking.quotation.customerAddress} wide />
                  <Detail label="Quotation terms" value={packet.booking.quotation.terms} wide />
                </Section>

                <Section title={`Booking · ${packet.booking.bookingNumber}`}>
                  <Detail label="Booking status" value={packet.booking.status} />
                  <Detail label="Booking date" value={dateText(packet.booking.createdAt)} />
                  <Detail label="Booking amount" value={currency(packet.booking.bookingAmount)} />
                  <Detail label="Reserved unit" value={`${packet.booking.unit.number} · ${packet.booking.unit.type || "Unit"} · ${packet.booking.unit.status}`} />
                  <Detail label="Lead / customer" value={`${packet.lead.firstName || ""} ${packet.lead.lastName}`.trim()} />
                  <Detail label="Lead phone" value={packet.lead.mobile} />
                  <Detail label="Lead email" value={packet.lead.email} />
                  <Detail label="Company" value={packet.lead.company} />
                  <Detail label="Lead status" value={packet.lead.status} />
                  <Detail label="Current owner" value={packet.lead.owner ? `${packet.lead.owner.firstName} ${packet.lead.owner.lastName} · ${packet.lead.owner.profile?.name || "—"}` : "Unassigned"} />
                  <Detail label="Organization type" value={packet.booking.profession.organizationType} />
                  <Detail label="Industry" value={packet.booking.profession.industry} />
                  <Detail label="Referred by" value={packet.booking.referredBy} />
                </Section>

                <BookingPlotDetails details={packet.booking.plotDetails} />
                <ApplicantSection title="First Applicant" applicant={packet.booking.firstApplicant} />
                <ApplicantSection title="Second Applicant" applicant={packet.booking.secondApplicant} />

                <Section title={`Receipt · ${currency(packet.amount)}`}>
                  <Detail label="Received from" value={packet.receivedFrom} />
                  <Detail label="Receipt date" value={dateText(packet.receiptDate)} />
                  <Detail label="Received date" value={dateText(packet.receivedDate)} />
                  <Detail label="Payment mode" value={packet.paymentMode} />
                  <Detail label="Transaction ID" value={packet.transactionId} />
                  <Detail label="Receipt amount" value={currency(packet.amount)} />
                  <Detail label="Approval status" value={packet.approvalStatus === "PENDING_APPROVAL" ? "Pending MIS review" : packet.approvalStatus} />
                </Section>

                {packet.approvalNote && (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold">MIS note:</span> {packet.approvalNote}
                  </div>
                )}
                {packet.approvalStatus !== "PENDING_APPROVAL" && (
                  <p className="text-xs text-slate-500">
                    {packet.approvalStatus} {packet.reviewedBy ? `by ${packet.reviewedBy.firstName} ${packet.reviewedBy.lastName}` : ""} · {dateText(packet.approvalReviewedAt)}
                  </p>
                )}

                {packet.approvalStatus === "PENDING_APPROVAL" && (
                  <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1.5">
                      <label htmlFor={`note-${packet.id}`} className="text-xs font-medium text-slate-700">MIS note (optional)</label>
                      <Textarea
                        id={`note-${packet.id}`}
                        value={notes[packet.id] || ""}
                        maxLength={1000}
                        rows={2}
                        placeholder="Add a note for the CRM team or rejection reason"
                        onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2 sm:pb-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={reviewingId !== null}
                        onClick={() => void review(packet, "REJECT")}
                        className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      >
                        {reviewingId === packet.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}Reject
                      </Button>
                      <Button
                        type="button"
                        disabled={reviewingId !== null}
                        onClick={() => void review(packet, "APPROVE")}
                        className="bg-emerald-700 text-white hover:bg-emerald-800"
                      >
                        {reviewingId === packet.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Accept & Assign to CRM
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
