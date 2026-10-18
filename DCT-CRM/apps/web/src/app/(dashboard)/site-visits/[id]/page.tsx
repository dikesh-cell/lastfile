"use client";

import { formatDate, formatDateTime } from "@/lib/date-format";
import { crmDateTimeInputValue, crmLocalDateTimeToDate, SITE_VISIT_FUTURE_TIME_ERROR, SITE_VISIT_TYPE_OPTIONS } from "@dct-crm/shared";

import * as React from "react";

import { useParams, useRouter } from "next/navigation";

import Link from "next/link";

import { siteVisitApi } from "@/lib/api";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Separator } from "@/components/ui/separator";

import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RecordPageHeader } from "@/components/crm/record-page-header";
import { SiteVisitHistoryTimeline } from "@/components/crm/site-visit-history-timeline";
import {
  emptySiteVisitScheduleFormValue,
  siteVisitScheduleIsFuture,
  SiteVisitScheduleFields,
  type SiteVisitScheduleFormValue,
} from "@/components/crm/site-visit-schedule-fields";

import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  CheckCircle2,
  Clock,
  FileText,
  History,
  StickyNote,
  MessageSquare,
} from "lucide-react";

interface SiteVisitData {
  id: string;
  siteVisitNumber?: string | null;
  status: string;
  scheduledAt?: string;
  notes?: string;
  feedback?: string | null;
  customerFeedback?: string | null;
  completionNotes?: string | null;
  completedAt?: string | null;
  completedBy?: { id: string; firstName: string; lastName: string; profile?: { name: string } | null } | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: { id: string; firstName: string; lastName: string; profile?: { name: string } | null } | null;
  rating?: number | null;
  visitType?: string | null;
  transportRequired?: boolean | null;
  customFields?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  lead?: { id: string; leadNumber?: string | null; firstName: string; lastName: string; phone?: string | null; company?: string | null; email?: string | null; status?: string; customFields?: Record<string, any> | null; owner?: { firstName: string; lastName: string; email?: string | null; profile?: { name: string } | null } | null };
  leadName?: string;
  project?: { id: string; name: string; allowedRadiusMeters?: number };
  projectName?: string;
  assignee?: { id: string; firstName: string; lastName: string };
  creator?: { id: string; firstName: string; lastName: string; email?: string; profile?: { name: string } | null };
  assignedTo?: string;
  visitDate?: string;
  previousSiteVisitId?: string | null;
  previousSiteVisit?: { id: string; siteVisitNumber?: string | null; status?: string; scheduledAt?: string } | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  SCHEDULED: "info",
  COMPLETED: "success",
  CANCELLED: "destructive",
  MISSED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  MISSED: "Missed",
};

const normalizeStatus = (status: string) => {
  const upper = String(status || "").toUpperCase();
  if (upper === "RESCHEDULED") return "SCHEDULED";
  if (["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"].includes(upper)) return upper;
  return upper || "SCHEDULED";
};

const deriveLeadName = (sv: SiteVisitData) =>
  sv.leadName ||
  (sv.lead ? `${sv.lead.firstName} ${sv.lead.lastName}`.trim() : "—");

const deriveProjectName = (sv: SiteVisitData) =>
  sv.projectName || sv.project?.name || "N/A";

const deriveAssignedTo = (sv: SiteVisitData) =>
  sv.assignedTo ||
  (sv.assignee ? `${sv.assignee.firstName} ${sv.assignee.lastName}`.trim() : "Unassigned");

const deriveVisitDate = (sv: SiteVisitData) =>
  sv.visitDate || sv.scheduledAt || sv.createdAt;

export default function SiteVisitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [siteVisit, setSiteVisit] = React.useState<SiteVisitData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("details");
  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [completeDialogOpen, setCompleteDialogOpen] = React.useState(false);
  const [completionTime, setCompletionTime] = React.useState("");
  const [customerFeedback, setCustomerFeedback] = React.useState("");
  const [completionNotes, setCompletionNotes] = React.useState("");
  const [revisitDialogOpen, setRevisitDialogOpen] = React.useState(false);
  const [revisitForm, setRevisitForm] = React.useState<SiteVisitScheduleFormValue>(emptySiteVisitScheduleFormValue);

  const fetchSiteVisit = React.useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setIsLoading(true);
      const res = await siteVisitApi.get(params.id as string);
      if (res.data.success && res.data.data) {
        setSiteVisit(res.data.data);
      } else if (!options?.silent) {
        toast({ title: "Error", description: "Site visit not found", variant: "destructive" as any });
        router.push("/site-visits");
      }
    } catch {
      if (!options?.silent) {
        toast({ title: "Error", description: "Failed to load site visit", variant: "destructive" as any });
      }
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [params.id, router, toast]);

  React.useEffect(() => {
    void fetchSiteVisit();
  }, [fetchSiteVisit]);

  const pauseStatusRefresh = isActionLoading || completeDialogOpen || cancelDialogOpen || revisitDialogOpen;
  React.useEffect(() => {
    if (pauseStatusRefresh) return undefined;
    const refreshTimer = window.setInterval(() => {
      void fetchSiteVisit({ silent: true });
    }, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchSiteVisit, pauseStatusRefresh]);

  const handleComplete = async () => {
    if (!completionTime || !customerFeedback.trim() || !completionNotes.trim()) {
      toast({ title: "Validation", description: "Completion time, customer feedback, and notes are required", variant: "destructive" as any });
      return;
    }
    setIsActionLoading(true);
    try {
      const response = await siteVisitApi.complete(params.id as string, {
        completedAt: crmLocalDateTimeToDate(completionTime.split("T")[0], completionTime.split("T")[1]).toISOString(),
        customerFeedback: customerFeedback.trim(),
        completionNotes: completionNotes.trim(),
      });
      if (response.data.success) {
        toast({ title: "Success", description: "Site visit completed successfully." });
        setCompleteDialogOpen(false);
        await fetchSiteVisit();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.response?.data?.error || "Failed to complete site visit", variant: "destructive" as any });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast({ title: "Validation", description: "A reason is required to cancel", variant: "destructive" as any });
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await siteVisitApi.cancel(params.id as string, cancelReason.trim());
      if (res.data.success) {
        toast({ title: "Success", description: "Site visit cancelled" });
        setCancelDialogOpen(false);
        setCancelReason("");
        await fetchSiteVisit();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.response?.data?.error || "Failed to cancel site visit", variant: "destructive" as any });
    } finally {
      setIsActionLoading(false);
    }
  };

  const openRevisitDialog = () => {
    const isScheduled = normalizeStatus(siteVisit?.status || "") === "SCHEDULED";
    setRevisitForm({
      ...emptySiteVisitScheduleFormValue(),
      projectId: siteVisit?.project?.id || "",
      visitType: isScheduled && (SITE_VISIT_TYPE_OPTIONS as readonly string[]).includes(siteVisit?.visitType || "") ? siteVisit?.visitType || "" : "",
      rating: isScheduled ? siteVisit?.customFields?.schedule_rating || "" : "",
      transport: isScheduled ? siteVisit?.customFields?.schedule_transport || "" : "",
      callSummaryRemarks: isScheduled ? siteVisit?.customFields?.schedule_call_summary_remarks || "" : "",
      minimumBudget: isScheduled ? siteVisit?.customFields?.schedule_minimum_budget || "" : "",
      maximumBudget: isScheduled ? siteVisit?.customFields?.schedule_maximum_budget || "" : "",
      propertyType: isScheduled && Array.isArray(siteVisit?.customFields?.schedule_property_type)
        ? siteVisit.customFields.schedule_property_type
        : [],
      bedroomPreference: isScheduled && Array.isArray(siteVisit?.customFields?.schedule_bedroom_preference)
        ? siteVisit.customFields.schedule_bedroom_preference
        : [],
    });
    setRevisitDialogOpen(true);
  };

  const handleRevisit = async () => {
    if (!revisitForm.projectId || !siteVisitScheduleIsFuture(revisitForm) || !revisitForm.visitType.trim() ||
      !revisitForm.minimumBudget || !revisitForm.maximumBudget || !revisitForm.propertyType.length) {
      toast({ title: "Validation", description: revisitForm.date && revisitForm.time && !siteVisitScheduleIsFuture(revisitForm) ? SITE_VISIT_FUTURE_TIME_ERROR : "Complete all required site visit fields", variant: "destructive" as any });
      return;
    }
    setIsActionLoading(true);
    try {
      const scheduledAt = crmLocalDateTimeToDate(revisitForm.date, revisitForm.time).toISOString();
      const customFields = {
        schedule_call_summary_remarks: revisitForm.callSummaryRemarks.trim() || null,
        schedule_minimum_budget: revisitForm.minimumBudget,
        schedule_maximum_budget: revisitForm.maximumBudget,
        schedule_property_type: revisitForm.propertyType,
        schedule_bedroom_preference: revisitForm.bedroomPreference,
        schedule_rating: revisitForm.rating || null,
        schedule_transport: revisitForm.transport || null,
      };
      const isScheduled = normalizeStatus(siteVisit?.status || "") === "SCHEDULED";
      const res = isScheduled
        ? await siteVisitApi.update(params.id as string, {
            scheduledAt,
            projectId: revisitForm.projectId,
            visitType: revisitForm.visitType.trim(),
            customFields,
          })
        : await siteVisitApi.revisit(params.id as string, {
            reason: revisitForm.callSummaryRemarks.trim() || "Revisit scheduled",
            scheduledAt,
            projectId: revisitForm.projectId,
            notes: revisitForm.callSummaryRemarks.trim() || undefined,
            visitType: revisitForm.visitType.trim(),
            rating: revisitForm.rating || null,
            transport: revisitForm.transport || null,
            callSummaryRemarks: revisitForm.callSummaryRemarks.trim(),
            minimumBudget: revisitForm.minimumBudget,
            maximumBudget: revisitForm.maximumBudget,
            propertyType: revisitForm.propertyType,
            bedroomPreference: revisitForm.bedroomPreference,
          });
      if (res.data.success) {
        toast({
          title: "Success",
          description: isScheduled ? "Site visit rescheduled" : "Revisit site visit created",
        });
        setRevisitDialogOpen(false);
        setRevisitForm(emptySiteVisitScheduleFormValue());
        await fetchSiteVisit();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.response?.data?.error || "Failed to create revisit", variant: "destructive" as any });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!siteVisit) return null;

  const status = normalizeStatus(siteVisit.status);
  const leadName = deriveLeadName(siteVisit);
  const projectName = deriveProjectName(siteVisit);
  const assignedTo = deriveAssignedTo(siteVisit);
  const visitDate = deriveVisitDate(siteVisit);
  const visitCustomFields = siteVisit.customFields || {};
  const leadCustomFields = siteVisit.lead?.customFields || {};
  const minimumBudget = visitCustomFields.schedule_minimum_budget || leadCustomFields.svc_minimum_budget;
  const maximumBudget = visitCustomFields.schedule_maximum_budget || leadCustomFields.svc_maximum_budget;
  const propertyTypes = Array.isArray(visitCustomFields.schedule_property_type) && visitCustomFields.schedule_property_type.length
    ? visitCustomFields.schedule_property_type
    : Array.isArray(leadCustomFields.svc_property_type) ? leadCustomFields.svc_property_type : [];
  const bedroomPreferences = Array.isArray(visitCustomFields.schedule_bedroom_preference) && visitCustomFields.schedule_bedroom_preference.length
    ? visitCustomFields.schedule_bedroom_preference
    : Array.isArray(leadCustomFields.svc_bedroom_preference) ? leadCustomFields.svc_bedroom_preference : [];
  const callSummaryRemarks =
    visitCustomFields.schedule_call_summary_remarks ||
    leadCustomFields.svc_call_summary_remarks ||
    siteVisit.notes;

  return (
    <div className="space-y-6">
      <RecordPageHeader
        objectLabel="Site Visit"
        title={siteVisit.siteVisitNumber || `#${siteVisit.id.slice(-8).toUpperCase()}`}
        subtitle={`Lead: ${leadName} · Project: ${projectName}`}
        backHref="/site-visits"
        icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
        badges={<Badge variant={STATUS_VARIANT[status] || "default"}>{STATUS_LABEL[status] || status}</Badge>}
        actions={
          <>
          {status === "SCHEDULED" && (
            <>
              <Button onClick={() => {
                setCompletionTime(crmDateTimeInputValue());
                setCustomerFeedback("");
                setCompletionNotes("");
                setCompleteDialogOpen(true);
              }} disabled={isActionLoading}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark Completed
              </Button>
              <Button variant="outline" onClick={openRevisitDialog} disabled={isActionLoading}>
                <Clock className="mr-2 h-4 w-4" />
                Reschedule
              </Button>
              <Button variant="destructive" onClick={() => setCancelDialogOpen(true)} disabled={isActionLoading}>
                Cancel Site Visit
              </Button>
            </>
          )}
          {status === "COMPLETED" && (
            <>
              <Button variant="outline" onClick={openRevisitDialog} disabled={isActionLoading}>
                <Clock className="mr-2 h-4 w-4" />
                Reschedule
              </Button>
            </>
          )}
          </>
        }
      />

      <div className="border-b">
        <div className="inline-flex items-center gap-2 border-b-2 border-primary px-3 py-2 text-sm font-medium">
          <FileText className="h-4 w-4" />
          Details
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="border-b bg-muted/30 py-3">
              <CardTitle>Site Visit Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2">
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Site Visit Number</span>
                <span className="text-right text-sm font-medium font-mono">{siteVisit.siteVisitNumber || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Owner</span>
                <span className="text-right text-sm font-medium">{assignedTo}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Project</span>
                <span className="text-right text-sm font-medium">{projectName}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Lead</span>
                <span className="text-right text-sm font-medium">{leadName}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Scheduled Date</span>
                <span className="text-right text-sm font-medium">{formatDateTime(visitDate)}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Site Visit Type</span>
                <span className="text-right text-sm font-medium">{siteVisit.visitType || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Rating</span>
                <span className="text-right text-sm font-medium">{siteVisit.customFields?.schedule_rating || siteVisit.rating || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Transport Arrangement</span>
                <span className="text-right text-sm font-medium">
                  {siteVisit.customFields?.schedule_transport || (siteVisit.transportRequired == null ? "—" : siteVisit.transportRequired ? "Required" : "Not Required")}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Minimum Budget</span>
                <span className="text-right text-sm font-medium">{minimumBudget || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Maximum Budget</span>
                <span className="text-right text-sm font-medium">{maximumBudget || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Property Type</span>
                <span className="text-right text-sm font-medium">
                  {propertyTypes.join(", ") || "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Bedroom Preference</span>
                <span className="text-right text-sm font-medium">
                  {bedroomPreferences.join(", ") || "—"}
                </span>
              </div>
              <div className="border-b pb-2 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Call Summary/Remarks</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium">
                  {callSummaryRemarks || "—"}
                </p>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={STATUS_VARIANT[status] || "default"}>{STATUS_LABEL[status] || status}</Badge>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Lead Number</span>
                <span className="text-right text-sm font-medium font-mono">{siteVisit.lead?.leadNumber || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Created By</span>
                <span className="text-right text-sm font-medium">
                  {siteVisit.creator
                    ? `${siteVisit.creator.firstName} ${siteVisit.creator.lastName}${siteVisit.creator.profile?.name ? ` (${siteVisit.creator.profile.name})` : ""}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="text-right text-sm font-medium">{siteVisit.lead?.phone || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-right text-sm font-medium">{formatDateTime(siteVisit.createdAt)}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Company</span>
                <span className="text-right text-sm font-medium">{siteVisit.lead?.company || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Last Modified</span>
                <span className="text-right text-sm font-medium">{formatDateTime(siteVisit.updatedAt)}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="break-all text-right text-sm font-medium">{siteVisit.lead?.email || "—"}</span>
              </div>
              {siteVisit.previousSiteVisit && (
                <div className="flex items-start justify-between gap-3 border-b pb-2">
                  <span className="text-sm text-muted-foreground">Previous Visit</span>
                  <span className="text-right text-sm font-medium font-mono">
                    {siteVisit.previousSiteVisit.siteVisitNumber || siteVisit.previousSiteVisit.id.slice(-8).toUpperCase()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        <aside className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader className="border-b bg-muted/30 py-3">
              <CardTitle>Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {siteVisit.feedback || siteVisit.customerFeedback || siteVisit.completionNotes ? (
                <>
                  {siteVisit.feedback && (
                    <div className="flex items-start gap-2">
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="whitespace-pre-wrap text-sm">{siteVisit.feedback}</p>
                    </div>
                  )}
                  {siteVisit.customerFeedback && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Customer Feedback</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{siteVisit.customerFeedback}</p>
                    </div>
                  )}
                  {siteVisit.completionNotes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Completion Feedback</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{siteVisit.completionNotes}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No feedback recorded.</p>
              )}
            </CardContent>
          </Card>

          <SiteVisitHistoryTimeline
            siteVisitId={siteVisit.id}
            siteVisitNumber={siteVisit.siteVisitNumber || `#${siteVisit.id.slice(-8).toUpperCase()}`}
            leadName={leadName}
            createdAt={siteVisit.createdAt}
            createdBy={siteVisit.creator}
            scheduledAt={siteVisit.scheduledAt}
          />
        </aside>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Site Visit</DialogTitle>
            <DialogDescription>A cancellation reason is required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="site-visit-cancel-reason">Reason *</Label>
            <Textarea id="site-visit-cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={isActionLoading}>Close</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isActionLoading || !cancelReason.trim()}>
              {isActionLoading ? "Cancelling..." : "Cancel Site Visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Site Visit</DialogTitle>
            <DialogDescription>Completion time, customer feedback, and notes are required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-visit-completion-time">Completion Time *</Label>
              <Input id="site-visit-completion-time" type="datetime-local" value={completionTime} onChange={(event) => setCompletionTime(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-visit-customer-feedback">Customer Feedback *</Label>
              <Textarea id="site-visit-customer-feedback" value={customerFeedback} onChange={(event) => setCustomerFeedback(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-visit-completion-notes">Notes *</Label>
              <Textarea id="site-visit-completion-notes" value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Completed By</p>
              <p className="text-muted-foreground">{user ? `${user.firstName} ${user.lastName}` : "Authenticated user"}</p>
              <p className="text-muted-foreground">{profile?.name || "Current profile"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)} disabled={isActionLoading}>Cancel</Button>
            <Button onClick={handleComplete} disabled={isActionLoading || !completionTime || !customerFeedback.trim() || !completionNotes.trim()}>
              {isActionLoading ? "Completing..." : "Complete Site Visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revisitDialogOpen} onOpenChange={setRevisitDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{status === "SCHEDULED" ? "Reschedule Site Visit" : "Create Revisit Site Visit"}</DialogTitle>
            <DialogDescription><span className="text-destructive">*</span> Required information</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p><strong>Lead Number:</strong> {siteVisit.lead?.leadNumber || "—"}</p>
            <p><strong>Lead Name:</strong> {leadName}</p>
            <p><strong>Phone:</strong> {siteVisit.lead?.phone || "—"}</p>
            <p><strong>Company:</strong> {siteVisit.lead?.company || "—"}</p>
            <p><strong>Email:</strong> {siteVisit.lead?.email || "—"}</p>
            <p><strong>Project:</strong> {projectName}</p>
          </div>
          <SiteVisitScheduleFields
            idPrefix="site-visit-revisit"
            value={revisitForm}
            onChange={setRevisitForm}
            projects={siteVisit.project ? [{ id: siteVisit.project.id, name: siteVisit.project.name }] : []}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisitDialogOpen(false)} disabled={isActionLoading}>Close</Button>
            <Button
              onClick={handleRevisit}
              disabled={isActionLoading || !siteVisit.project || !revisitForm.projectId || !siteVisitScheduleIsFuture(revisitForm) || !revisitForm.visitType.trim() || !revisitForm.minimumBudget || !revisitForm.maximumBudget || !revisitForm.propertyType.length}
            >
              {isActionLoading ? "Saving..." : status === "SCHEDULED" ? "Reschedule Site Visit" : "Create Revisit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}