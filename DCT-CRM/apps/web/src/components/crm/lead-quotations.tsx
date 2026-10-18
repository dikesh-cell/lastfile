"use client";

import * as React from "react";
import { Building2, Check, CreditCard, Download, Eye, FileText, Loader2, MapPinned, Plus, Printer, UserRound } from "lucide-react";
import { INDIAN_STATES, ORGANIZATION_TYPES, PAN_PATTERN, quotationDueLabel, quotationPropertyFields, quotationScheduleAmounts } from "@dct-crm/shared";
import { bookingApi, quotationApi, projectApi, unitApi } from "@/lib/api";
import { createIllustrativeProjectPlots, projectUnitStatusColors } from "@/lib/project-land-layout";
import { SampleLandLayout } from "@/components/projects/sample-land-layout";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PdfDocumentPreview, type PdfPreviewDocument } from "@/components/crm/pdf-document-preview";
import { useToast } from "@/hooks/use-toast";
import type { SampleLandPlot } from "@/lib/mock-land-layout";

interface CompletedVisit {
  id: string;
  siteVisitNumber?: string;
  completedAt?: string | null;
  scheduledAt?: string;
  projectId?: string | null;
}

interface QuotationLead {
  id: string;
  firstName?: string;
  lastName: string;
  company: string;
  email?: string;
  phone?: string;
  mobile?: string;
  street?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  projectId?: string | null;
}

interface Project {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  totalUnits?: number | null;
}

interface Unit {
  id: string;
  number: string;
  type?: string | null;
  area?: number | null;
  price?: number | null;
  status: string;
}

interface Installment {
  milestone: string;
  percentage: number;
  dueMonths?: number;
  dueDays?: number;
}

interface PaymentPlan {
  name: string;
  installments: Installment[];
}

interface EditableInstallment {
  id: string;
  milestone: string;
  percentage: number;
  dueDays: number;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
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
  paymentPlan: PaymentPlan;
  terms?: string | null;
  confirmedAt: string;
  createdBy?: { firstName: string; lastName: string };
  booking?: { id: string; bookingNumber: string; status: string; profession?: { organizationType?: string | null } | null } | null;
  unit?: { id: string; number: string; type?: string | null; block?: string | null; floor?: number | null; area?: number | null } | null;
  project?: { id: string; name: string; address?: string | null; city?: string | null; state?: string | null } | null;
}

interface ApplicantForm {
  salutation: string;
  name: string;
  photoUrl: string;
  dateOfBirth: string;
  relationType: string;
  relationshipName: string;
  nationality: string;
  aadhaarNumber: string;
  panNumber: string;
  email: string;
  mobileNumber: string;
  alternateNumber: string;
  maritalStatus: string;
  state: string;
  district: string;
  correspondingAddress: string;
  permanentAddress: string;
  sameAddress: boolean;
}

type ApplicantTextField = Exclude<keyof ApplicantForm, "sameAddress">;

const emptyApplicant: ApplicantForm = {
  salutation: "",
  name: "",
  photoUrl: "",
  dateOfBirth: "",
  relationType: "",
  relationshipName: "",
  nationality: "Indian",
  aadhaarNumber: "",
  panNumber: "",
  email: "",
  mobileNumber: "",
  alternateNumber: "",
  maritalStatus: "",
  state: "",
  district: "",
  correspondingAddress: "",
  permanentAddress: "",
  sameAddress: false,
};

const APPLICANT_FIELDS: { name: ApplicantTextField; label: string; type?: string; required?: boolean }[] = [
  { name: "name", label: "Full name", required: true },
  { name: "dateOfBirth", label: "Date of birth", type: "date", required: true },
  { name: "relationType", label: "Relation type" },
  { name: "relationshipName", label: "Relation name" },
  { name: "nationality", label: "Nationality", required: true },
  { name: "aadhaarNumber", label: "Aadhaar number", required: true },
  { name: "panNumber", label: "PAN number" },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "mobileNumber", label: "Mobile number", type: "tel", required: true },
  { name: "alternateNumber", label: "Alternate number", type: "tel" },
  { name: "state", label: "State", required: true },
  { name: "district", label: "District" },
];

const salutationOptions = ["Mr.", "Mrs.", "Ms.", "Dr.", "Other"];

const PAYMENT_PLANS: PaymentPlan[] = [
  {
    name: "10% Booking + 90% Registration",
    installments: [
      { milestone: "On confirmation", percentage: 10, dueMonths: 0 },
      { milestone: "On registration", percentage: 90, dueMonths: 1 },
    ],
  },
  {
    name: "10% Booking + 40% Agreement + 50% Possession",
    installments: [
      { milestone: "On confirmation", percentage: 10, dueMonths: 0 },
      { milestone: "On agreement", percentage: 40, dueMonths: 1 },
      { milestone: "On possession", percentage: 50, dueMonths: 6 },
    ],
  },
];
const CUSTOM_PLAN_VALUE = "__CUSTOM_PAYMENT_PLAN__";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));

const locationLine = (parts: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const items: string[] = [];
  parts.forEach((part) => {
    part?.split(",").forEach((piece) => {
      const cleaned = piece.trim();
      const key = cleaned.toLowerCase();
      if (!cleaned || seen.has(key)) return;
      seen.add(key);
      items.push(cleaned);
    });
  });
  return items.join(", ");
};

const formatShare = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
};

const defaultCustomInstallments = (): EditableInstallment[] => [
  { id: "custom-installment-1", milestone: "On confirmation", percentage: 10, dueDays: 0 },
  { id: "custom-installment-2", milestone: "On registration", percentage: 90, dueDays: 30 },
];

export function LeadQuotations({
  lead,
  completedVisits,
  canCreate,
}: {
  lead: QuotationLead;
  completedVisits: CompletedVisit[];
  canCreate: boolean;
}) {
  const { toast } = useToast();
  const [quotations, setQuotations] = React.useState<Quotation[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = React.useState(true);
  const [projectsError, setProjectsError] = React.useState<string | null>(null);
  const [unitsLoading, setUnitsLoading] = React.useState(false);
  const [unitsError, setUnitsError] = React.useState<string | null>(null);
  const [unitsReloadKey, setUnitsReloadKey] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [quotationDetail, setQuotationDetail] = React.useState<Quotation | null>(null);
  const [pdfPreview, setPdfPreview] = React.useState<PdfPreviewDocument | null>(null);
  const [pdfAction, setPdfAction] = React.useState<string | null>(null);
  const [bookingQuotation, setBookingQuotation] = React.useState<Quotation | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = React.useState(false);
  const [bookingSaving, setBookingSaving] = React.useState(false);
  const [bookingAmount, setBookingAmount] = React.useState("");
  const [firstApplicant, setFirstApplicant] = React.useState<ApplicantForm>(emptyApplicant);
  const [secondApplicant, setSecondApplicant] = React.useState<ApplicantForm>(emptyApplicant);
  const [extraApplicants, setExtraApplicants] = React.useState<ApplicantForm[]>([]);
  const [profession, setProfession] = React.useState({ organizationType: "", industry: "" });
  const [referredBy, setReferredBy] = React.useState("");
  const [selectedVisitId, setSelectedVisitId] = React.useState(completedVisits[0]?.id || "");
  const [selectedProjectId, setSelectedProjectId] = React.useState(
    completedVisits[0]?.projectId || lead.projectId || "",
  );
  const [selectedUnitId, setSelectedUnitId] = React.useState("");
  const [pricePerSqFt, setPricePerSqFt] = React.useState("");
  const [plcAmount, setPlcAmount] = React.useState("0");
  const [discountAmount, setDiscountAmount] = React.useState("0");
  const [paymentPlanName, setPaymentPlanName] = React.useState(PAYMENT_PLANS[0].name);
  const [customPlanName, setCustomPlanName] = React.useState("Custom payment plan");
  const [customInstallments, setCustomInstallments] = React.useState<EditableInstallment[]>(defaultCustomInstallments);
  const customInstallmentCounter = React.useRef(2);
  const [terms, setTerms] = React.useState("");

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const milestoneKeys = customInstallments.map((installment) => installment.milestone.trim().toLowerCase());
  const customInstallmentErrors = customInstallments.map((installment) => {
    const errors: { milestone?: string; percentage?: string; dueDays?: string } = {};
    const name = installment.milestone.trim();
    if (!name) errors.milestone = "Milestone name is required.";
    else if (milestoneKeys.filter((key) => key === name.toLowerCase()).length > 1) errors.milestone = "Milestone name is already used.";
    if (!Number.isFinite(installment.percentage) || installment.percentage <= 0) errors.percentage = "Enter a percentage greater than 0.";
    else if (installment.percentage > 100) errors.percentage = "Percentage cannot exceed 100.";
    if (!Number.isInteger(installment.dueDays) || installment.dueDays < 0) errors.dueDays = "Enter a whole number of days, 0 or more.";
    else if (installment.dueDays > 3650) errors.dueDays = "Due days cannot exceed 3,650.";
    return errors;
  });
  const customPlanTotal = customInstallments.reduce(
    (sum, installment) => sum + (Number.isFinite(installment.percentage) ? installment.percentage : 0),
    0,
  );
  const customPlanTotalExact = Math.round(customPlanTotal * 100) / 100 === 100;
  const customPlanTotalMessage = `Total installment percentage must equal 100%. Current total: ${formatShare(customPlanTotal)}%.`;
  const customPlanNameError = customPlanName.trim() ? "" : "Custom plan name is required.";
  const selectedPlan = paymentPlanName === CUSTOM_PLAN_VALUE
    ? {
        name: customPlanName.trim() || "Custom payment plan",
        installments: customInstallments.map(({ milestone, percentage, dueDays }) => ({
          milestone: milestone.trim(),
          percentage,
          dueDays,
        })),
      }
    : PAYMENT_PLANS.find((plan) => plan.name === paymentPlanName) || PAYMENT_PLANS[0];
  const paymentPlanValid = paymentPlanName !== CUSTOM_PLAN_VALUE || (
    !customPlanNameError &&
    customPlanName.trim().length <= 120 &&
    customInstallments.length > 0 &&
    customInstallments.length <= 12 &&
    customInstallmentErrors.every((errors) => !errors.milestone && !errors.percentage && !errors.dueDays) &&
    customPlanTotalExact
  );
  const area = Number(selectedUnit?.area || 0);
  const basePrice = area * Number(pricePerSqFt || 0);
  const plc = Number(plcAmount || 0);
  const discount = Number(discountAmount || 0);
  const totalPrice = basePrice + plc - discount;
  const customAmounts = quotationScheduleAmounts(
    totalPrice,
    customInstallments.map((installment) => (Number.isFinite(installment.percentage) ? installment.percentage : 0)),
  );
  const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company;
  const customerAddress = [lead.street, lead.city, lead.stateProvince, lead.postalCode, lead.country]
    .filter(Boolean)
    .join(", ");

  const openBooking = (quotation: Quotation) => {
    setBookingQuotation(quotation);
    setBookingAmount(String(Math.round(quotation.totalPrice * (quotation.paymentPlan?.installments?.[0]?.percentage || 10) / 100)));
    setFirstApplicant({
      ...emptyApplicant,
      name: leadName,
      email: lead.email || "",
      mobileNumber: lead.mobile || lead.phone || "",
      state: (INDIAN_STATES as readonly string[]).includes(lead.stateProvince || "") ? lead.stateProvince || "" : "",
      correspondingAddress: customerAddress,
      permanentAddress: customerAddress,
    });
    setSecondApplicant(emptyApplicant);
    setExtraApplicants([]);
    setProfession({ organizationType: "", industry: "" });
    setReferredBy("");
    setQuotationDetail(null);
    setBookingDialogOpen(true);
  };

  const handleApplicantPhoto = (
    event: React.ChangeEvent<HTMLInputElement>,
    setApplicant: React.Dispatch<React.SetStateAction<ApplicantForm>>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 1_000_000) {
      toast({
        title: "Photo not supported",
        description: "Choose a JPG or PNG image smaller than 1 MB. These formats are included in the booking PDF.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const photo = reader.result;
      if (typeof photo === "string") {
        setApplicant((current) => ({ ...current, photoUrl: photo }));
      }
    };
    reader.onerror = () => toast({
      title: "Could not read photo",
      description: "Please choose the image again.",
      variant: "destructive",
    });
    reader.readAsDataURL(file);
  };

  const submitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bookingQuotation) return;
    const applicantProblems = (label: string, applicant: ApplicantForm, required: boolean) => {
      const started = Object.entries(applicant).some(([key, value]) => key !== "sameAddress" && typeof value === "string" && value.trim());
      if (!required && !started) return [];
      return [
        !applicant.salutation && `${label} salutation`,
        !applicant.name.trim() && `${label} name`,
        !PAN_PATTERN.test(applicant.panNumber.trim()) && `${label} PAN number`,
        !applicant.maritalStatus && `${label} marital status`,
        !(INDIAN_STATES as readonly string[]).includes(applicant.state) && `${label} state`,
      ].filter(Boolean);
    };
    const missingSelect = [
      ...applicantProblems("First applicant", firstApplicant, true),
      ...extraApplicants.flatMap((applicant, index) => applicantProblems(index === 0 ? "Third applicant" : "Fourth applicant", applicant, true)),
      !(ORGANIZATION_TYPES as readonly string[]).includes(profession.organizationType) && "Organization type",
    ].filter(Boolean);
    if (missingSelect.length > 0) {
      toast({
        title: "Complete the required applicant fields",
        description: `${missingSelect[0]} is required.`,
        variant: "destructive",
      });
      return;
    }
    try {
      setBookingSaving(true);
      const response = await bookingApi.createFromQuotation(lead.id, bookingQuotation.id, {
        bookingAmount: Number(bookingAmount),
        firstApplicant: {
          ...firstApplicant,
          salutation: firstApplicant.salutation.trim(),
          name: firstApplicant.name.trim(),
          permanentAddress: firstApplicant.permanentAddress.trim(),
        },
        secondApplicant: secondApplicant.name.trim()
          ? { ...secondApplicant, panNumber: secondApplicant.panNumber.trim().toUpperCase() }
          : null,
        profession: {
          ...profession,
          additionalApplicants: extraApplicants.map((applicant) => ({
            ...applicant,
            panNumber: applicant.panNumber.trim().toUpperCase(),
            name: applicant.name.trim(),
            salutation: applicant.salutation.trim(),
            permanentAddress: applicant.permanentAddress.trim(),
          })),
        },
        referredBy: referredBy || null,
      });
      const booking = response.data.data as { id: string; bookingNumber: string; status: string };
      setQuotations((current) => current.map((item) =>
        item.id === bookingQuotation.id ? { ...item, booking } : item
      ));
      setBookingDialogOpen(false);
      toast({
        title: "Booking saved and unit reserved",
        description: `${booking.bookingNumber} is linked to ${bookingQuotation.quotationNumber}.`,
      });
      try {
        const pdfResponse = await bookingApi.downloadPdf(lead.id, booking.id);
        const blob = pdfResponse.data instanceof Blob
          ? pdfResponse.data
          : new Blob([pdfResponse.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPdfPreview((current) => {
          if (current) URL.revokeObjectURL(current.url);
          return {
            number: booking.bookingNumber,
            url,
            eyebrow: "Booking preview",
            description: "Download and print use the saved booking PDF.",
          };
        });
      } catch (previewError) {
        console.error("Failed to open booking PDF preview:", previewError);
        toast({
          title: "Booking saved",
          description: "The PDF preview could not be opened. Use Preview PDF on the booking record.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Failed to save booking:", error);
      toast({
        title: "Could not save booking",
        description: error?.response?.data?.error || "Please review the details and try again.",
        variant: "destructive",
      });
    } finally {
      setBookingSaving(false);
    }
  };

  const loadQuotations = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const quoteResponse = await quotationApi.listForLead(lead.id);
      setQuotations(quoteResponse.data.data || []);
    } catch (error) {
      console.error("Failed to load lead quotations:", error);
      setLoadError("Could not load quotations. Please retry.");
    } finally {
      setIsLoading(false);
    }
  }, [lead.id]);

  const loadProjects = React.useCallback(async () => {
    try {
      setProjectsLoading(true);
      setProjectsError(null);
      const projectRows = await projectApi.listAll({ isActive: true });
      setProjects(projectRows);
      if (projectRows.length === 0) {
        setProjectsError("No active projects are available. Add or activate a project, then retry.");
      }
    } catch (error) {
      console.error("Failed to load projects for quotation:", error);
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      setProjects([]);
      setProjectsError(message || "Could not load projects. Check your connection and retry.");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadQuotations();
    void loadProjects();
  }, [loadProjects, loadQuotations]);

  React.useEffect(() => {
    if (!selectedProjectId) {
      setUnits([]);
      setSelectedUnitId("");
      setUnitsLoading(false);
      return;
    }

    let cancelled = false;
    const loadUnits = async () => {
      try {
        setUnitsLoading(true);
        setUnitsError(null);
        setSelectedUnitId("");
        setPricePerSqFt("");
        const pageSize = 100;
        const firstResponse = await unitApi.list({ projectId: selectedProjectId, page: 1, limit: pageSize });
        const firstPage = firstResponse.data.data || [];
        const totalPages = firstResponse.data.pagination?.totalPages || 1;
        const otherPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            unitApi.list({ projectId: selectedProjectId, page: index + 2, limit: pageSize }),
          ),
        );
        if (!cancelled) {
          setUnits([...firstPage, ...otherPages.flatMap((response) => response.data.data || [])]);
        }
      } catch (error) {
        console.error("Failed to load project units:", error);
        if (!cancelled) {
          setUnits([]);
          const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
          setUnitsError(message || "Could not load this project's units. Please retry.");
        }
      } finally {
        if (!cancelled) setUnitsLoading(false);
      }
    };
    void loadUnits();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, unitsReloadKey]);

  const retryUnits = () => {
    setUnitsReloadKey((current) => current + 1);
  };

  const selectUnit = (plot: SampleLandPlot | null) => {
    const unit = units.find((candidate) => candidate.id === plot?.id);
    setSelectedUnitId(unit?.id || "");
    const unitArea = Number(unit?.area || 0);
    setPricePerSqFt(unit && unitArea > 0 && unit.price != null ? String(unit.price / unitArea) : "");
  };

  const openBuilder = () => {
    setSelectedVisitId(completedVisits[0]?.id || "");
    setSelectedProjectId(completedVisits[0]?.projectId || lead.projectId || "");
    setSelectedUnitId("");
    setPlcAmount("0");
    setDiscountAmount("0");
    setPaymentPlanName(PAYMENT_PLANS[0].name);
    setCustomPlanName("Custom payment plan");
    setCustomInstallments(defaultCustomInstallments());
    customInstallmentCounter.current = 2;
    setTerms("");
    setBuilderOpen(true);
  };

  const showPreview = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !selectedVisitId ||
      !selectedProjectId ||
      !selectedUnitId ||
      !area ||
      !Number.isFinite(Number(pricePerSqFt)) ||
      Number(pricePerSqFt) <= 0 ||
      !Number.isFinite(plc) ||
      plc < 0 ||
      !Number.isFinite(discount) ||
      discount < 0 ||
      !Number.isFinite(totalPrice) ||
      totalPrice < 0 ||
      !paymentPlanValid
    ) {
      toast({
        title: "Complete the quotation details",
        description: paymentPlanValid
          ? "Choose a completed visit, project and available unit, then enter valid pricing."
          : customPlanTotalExact
            ? "Complete the custom payment plan. Each installment needs a name, a percentage, and a due day."
            : customPlanTotalMessage,
        variant: "destructive",
      });
      return;
    }
    setBuilderOpen(false);
    setPreviewOpen(true);
  };

  const confirmQuotation = async () => {
    if (!selectedUnit || !selectedProject) return;
    try {
      setIsSaving(true);
      const response = await quotationApi.createForLead(lead.id, {
        siteVisitId: selectedVisitId,
        projectId: selectedProjectId,
        unitId: selectedUnitId,
        pricePerSqFt: Number(pricePerSqFt),
        plcAmount: plc,
        discountAmount: discount,
        paymentPlan: selectedPlan,
        terms: terms.trim() || undefined,
      });
      const quotation = response.data.data as Quotation;
      setQuotations((current) => [quotation, ...current]);
      setPreviewOpen(false);
      setSelectedUnitId("");
      toast({
        title: "Quotation confirmed",
        description: `${quotation.quotationNumber} was saved. The unit remains available until booking.`,
      });
    } catch (error: any) {
      console.error("Failed to confirm quotation:", error);
      toast({
        title: "Could not confirm quotation",
        description: error?.response?.data?.error || "Please check the unit availability and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const plots = React.useMemo(
    () => selectedProjectId
      ? createIllustrativeProjectPlots(selectedProjectId, units.map((unit) => ({
          id: unit.id,
          unitNumber: unit.number,
          type: unit.type || "Unit",
          area: Number(unit.area || 0),
          price: Number(unit.price || 0),
          status: unit.status,
        })))
      : [],
    [selectedProjectId, units],
  );

  const renderApplicantFields = (
    title: string,
    applicant: ApplicantForm,
    setApplicant: React.Dispatch<React.SetStateAction<ApplicantForm>>,
    prefix: string,
    required: boolean,
  ) => (
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{required ? "Applicant details marked * are required." : "Optional co-applicant details."}</p>
        </div>
        <UserRound className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-salutation`}>Salutation{required ? " *" : ""}</Label>
          <Select
            value={applicant.salutation}
            onValueChange={(value) => setApplicant((current) => ({ ...current, salutation: value }))}
          >
            <SelectTrigger id={`${prefix}-salutation`}><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{salutationOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {APPLICANT_FIELDS.map((field) => {
          if (field.name === "state") {
            return (
              <div className="space-y-1.5" key={`${prefix}-state`}>
                <Label htmlFor={`${prefix}-state`}>State{required ? " *" : ""}</Label>
                <Select
                  value={applicant.state || undefined}
                  onValueChange={(value) => setApplicant((current) => ({ ...current, state: value }))}
                >
                  <SelectTrigger id={`${prefix}-state`}><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {INDIAN_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          if (field.name === "panNumber") {
            return (
              <div className="space-y-1.5" key={`${prefix}-panNumber`}>
                <Label htmlFor={`${prefix}-panNumber`}>PAN number{required ? " *" : ""}</Label>
                <Input
                  id={`${prefix}-panNumber`}
                  required={required}
                  maxLength={10}
                  autoCapitalize="characters"
                  placeholder="ABCDE1234F"
                  value={applicant.panNumber}
                  onChange={(event) => setApplicant((current) => ({ ...current, panNumber: event.target.value.toUpperCase() }))}
                />
              </div>
            );
          }
          return (
            <div className="space-y-1.5" key={`${prefix}-${field.name}`}>
              <Label htmlFor={`${prefix}-${field.name}`}>{field.label}{required && field.required ? " *" : ""}</Label>
              <Input
                id={`${prefix}-${field.name}`}
                type={field.type || "text"}
                required={required && !!field.required}
                value={applicant[field.name]}
                onChange={(event) => setApplicant((current) => ({ ...current, [field.name]: event.target.value }))}
              />
            </div>
          );
        })}
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-maritalStatus`}>Marital status{required ? " *" : ""}</Label>
          <Select
            value={applicant.maritalStatus}
            onValueChange={(value) => setApplicant((current) => ({ ...current, maritalStatus: value }))}
          >
            <SelectTrigger id={`${prefix}-maritalStatus`}><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {["Single", "Married", "Divorced", "Widowed"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor={`${prefix}-photo`}>Applicant photo</Label>
          <Input
            id={`${prefix}-photo`}
            type="file"
            accept="image/jpeg,image/png"
            onChange={(event) => handleApplicantPhoto(event, setApplicant)}
          />
          {applicant.photoUrl && <p className="text-xs text-emerald-700">Photo attached</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-correspondingAddress`}>Corresponding address</Label>
          <Textarea
            id={`${prefix}-correspondingAddress`}
            value={applicant.correspondingAddress}
            onChange={(event) => setApplicant((current) => ({ ...current, correspondingAddress: event.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-permanentAddress`}>Permanent address{required ? " *" : ""}</Label>
          <Textarea
            id={`${prefix}-permanentAddress`}
            required={required}
            value={applicant.permanentAddress}
            onChange={(event) => setApplicant((current) => ({ ...current, permanentAddress: event.target.value }))}
          />
        </div>
      </div>
    </section>
  );

  const closePdfPreview = () => {
    setPdfPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const fetchQuotationPdf = async (quotation: Quotation) => {
    const response = await quotationApi.downloadPdf(lead.id, quotation.id);
    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  };

  const previewQuotationPdf = async (quotation: Quotation) => {
    try {
      setPdfAction(`${quotation.id}:preview`);
      const url = await fetchQuotationPdf(quotation);
      setPdfPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return {
          number: quotation.quotationNumber,
          url,
          eyebrow: "Quotation preview",
          description: "Download and print use the saved quotation PDF.",
        };
      });
    } catch (error) {
      console.error("Failed to preview quotation PDF:", error);
      toast({ title: "Could not preview PDF", description: "The quotation PDF could not be generated. Please try again.", variant: "destructive" });
    } finally {
      setPdfAction(null);
    }
  };

  const downloadQuotationPdf = async (quotation: Quotation) => {
    try {
      setPdfAction(`${quotation.id}:download`);
      const url = await fetchQuotationPdf(quotation);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${quotation.quotationNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Failed to download quotation PDF:", error);
      toast({ title: "Could not download PDF", description: "The quotation PDF could not be generated. Please try again.", variant: "destructive" });
    } finally {
      setPdfAction(null);
    }
  };

  const printQuotationPdf = async (quotation: Quotation) => {
    try {
      setPdfAction(`${quotation.id}:print`);
      const url = await fetchQuotationPdf(quotation);
      const frame = document.createElement("iframe");
      frame.setAttribute("title", `${quotation.quotationNumber} print`);
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
    } catch (error) {
      console.error("Failed to print quotation PDF:", error);
      toast({ title: "Could not print PDF", description: "The quotation PDF could not be generated. Please try again.", variant: "destructive" });
    } finally {
      setPdfAction(null);
    }
  };

  const renderPdfActions = (quotation: Quotation, layout: "card" | "row" = "row") => {
    const busy = pdfAction?.startsWith(`${quotation.id}:`) ?? false;
    const width = layout === "card" ? "w-full" : "";
    return (
      <div className={layout === "card" ? "contents" : "flex flex-wrap gap-2"}>
        <Button type="button" size="sm" className={width} disabled={busy} onClick={() => void previewQuotationPdf(quotation)}>
          {pdfAction === `${quotation.id}:preview` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Preview PDF
        </Button>
        <Button type="button" variant="outline" size="sm" className={width} disabled={busy} onClick={() => void downloadQuotationPdf(quotation)}>
          {pdfAction === `${quotation.id}:download` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PDF
        </Button>
        <Button type="button" variant="outline" size="sm" className={width} disabled={busy} onClick={() => void printQuotationPdf(quotation)}>
          {pdfAction === `${quotation.id}:print` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          Print
        </Button>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <CardTitle className="flex items-center gap-3 text-base font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-600 text-white">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          Quotations ({quotations.length})
        </CardTitle>
        {canCreate && (
          <Button size="sm" onClick={openBuilder} disabled={completedVisits.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" />New Quotation
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {isLoading ? (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading quotations...</p>
        ) : loadError ? (
          <div className="space-y-3 text-center">
            <p role="alert" className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void loadQuotations()}>Retry</Button>
          </div>
        ) : quotations.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No quotations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a quotation after the site visit is complete.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {quotations.map((quotation) => (
              <article key={quotation.id} className="flex flex-col rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight">{quotation.quotationNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(quotation.confirmedAt)}</p>
                  </div>
                  <Badge variant={quotation.booking ? "default" : "secondary"} className="shrink-0">
                    {quotation.booking ? "BOOKED" : quotation.status}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Project</dt><dd className="truncate text-right font-medium">{quotation.projectName}</dd>
                  <dt className="text-muted-foreground">Unit</dt><dd className="truncate text-right font-medium">{quotation.unitNumber}{quotation.unitType ? ` · ${quotation.unitType}` : ""}</dd>
                  <dt className="text-muted-foreground">Plan</dt><dd className="truncate text-right font-medium">{quotation.paymentPlanName}</dd>
                </dl>
                <div className="mt-3 flex items-end justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Grand total</span>
                  <span className="text-base font-semibold tabular-nums">{formatCurrency(quotation.totalPrice)}</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {quotation.booking
                    ? `Booking ${quotation.booking.bookingNumber} · Unit reserved`
                    : `Created by ${quotation.createdBy ? `${quotation.createdBy.firstName} ${quotation.createdBy.lastName}` : "CRM user"} · Unit remains available until booking.`}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setQuotationDetail(quotation)}>
                    <FileText className="h-4 w-4" />View
                  </Button>
                  {renderPdfActions(quotation, "card")}
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!quotationDetail} onOpenChange={(open) => { if (!open) setQuotationDetail(null); }}>
        <DialogContent className="!flex max-h-[90vh] max-w-3xl !flex-col !overflow-hidden">
          {quotationDetail && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  {quotationDetail.quotationNumber}
                  <Badge variant="secondary">{quotationDetail.booking ? "BOOKED" : quotationDetail.status}</Badge>
                </DialogTitle>
                <DialogDescription>Complete quotation and customer details.</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                <section className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{quotationDetail.customerName}</p></div>
                  <div><p className="text-xs text-muted-foreground">Phone / email</p><p className="font-medium">{quotationDetail.customerPhone || lead.mobile || lead.phone || "—"} · {quotationDetail.customerEmail || lead.email || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Customer address</p><p className="font-medium">{quotationDetail.customerAddress || customerAddress || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Quotation date</p><p className="font-medium">{formatDate(quotationDetail.confirmedAt)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Organization type</p><p className="font-medium">{quotationDetail.booking?.profession?.organizationType || "—"}</p></div>
                </section>
                <section className="rounded-xl border p-4">
                  <h3 className="font-semibold">Project</h3>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Project:</span> {quotationDetail.projectName}</p>
                    <p><span className="text-muted-foreground">Location:</span> {locationLine([quotationDetail.project?.address, quotationDetail.project?.city, quotationDetail.project?.state]) || "—"}</p>
                  </div>
                </section>
                <section className="rounded-xl border p-4">
                  <h3 className="font-semibold">Property</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {quotationPropertyFields({
                      unitType: quotationDetail.unit?.type || quotationDetail.unitType,
                      unitNumber: quotationDetail.unitNumber,
                      block: quotationDetail.unit?.block,
                      floor: quotationDetail.unit?.floor,
                      area: quotationDetail.area,
                    }).map((field) => (
                      <div key={field.label} className="rounded-md border bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</p>
                        <p className="mt-0.5 text-sm font-medium">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-xl border p-4">
                  <h3 className="font-semibold">Price summary</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span>Base price</span><span className="tabular-nums">{formatCurrency(quotationDetail.basePrice)}</span></div>
                    <div className="flex justify-between gap-3"><span>Additional charges</span><span className="tabular-nums">{formatCurrency(quotationDetail.plcAmount)}</span></div>
                    <div className="flex justify-between gap-3"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(quotationDetail.basePrice + quotationDetail.plcAmount)}</span></div>
                    <div className="flex justify-between gap-3"><span>Discount</span><span className="tabular-nums">{quotationDetail.discountAmount > 0 ? `-${formatCurrency(quotationDetail.discountAmount)}` : formatCurrency(0)}</span></div>
                    <div className="flex justify-between gap-3"><span>Taxes</span><span className="tabular-nums">{formatCurrency(0)}</span></div>
                    <div className="flex justify-between gap-3 rounded-md bg-slate-900 px-3 py-2.5 font-semibold text-white"><span>Grand total</span><span className="tabular-nums">{formatCurrency(quotationDetail.totalPrice)}</span></div>
                  </div>
                </section>
                <section className="rounded-xl border p-4">
                  <h3 className="font-semibold">Payment plan</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{quotationDetail.paymentPlanName || "—"}</p>
                  <div className="mt-3 overflow-hidden rounded-md border">
                    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-3 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>Milestone</span><span>Due</span><span className="text-right">Amount</span>
                    </div>
                    {quotationDetail.paymentPlan?.installments?.length ? quotationDetail.paymentPlan.installments.map((installment, index) => {
                      const amount = quotationScheduleAmounts(
                        quotationDetail.totalPrice,
                        quotationDetail.paymentPlan?.installments.map((item) => item.percentage) || [],
                      )[index];
                      return (
                        <div key={`${installment.milestone}-${index}`} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-3 border-t px-3 py-2 text-sm">
                          <span className="min-w-0">{installment.milestone} ({installment.percentage}%)</span>
                          <span className="text-muted-foreground">{quotationDueLabel(installment)}</span>
                          <span className="text-right font-medium tabular-nums">{formatCurrency(amount || 0)}</span>
                        </div>
                      );
                    }) : (
                      <p className="border-t px-3 py-3 text-sm text-muted-foreground">No payment schedule was recorded on this quotation.</p>
                    )}
                  </div>
                </section>
                <section className="rounded-xl border p-4">
                  <h3 className="font-semibold">Terms and conditions</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{quotationDetail.terms?.trim() || "No additional terms were recorded on this quotation."}</p>
                </section>
              </div>
              <DialogFooter className="shrink-0 gap-3 border-t bg-background pt-3 sm:items-center sm:justify-between">
                {renderPdfActions(quotationDetail)}
                {quotationDetail.booking ? (
                  <p className="text-sm font-medium text-emerald-700">Booking {quotationDetail.booking.bookingNumber} saved; this unit is reserved.</p>
                ) : canCreate ? (
                  <Button type="button" onClick={() => openBooking(quotationDetail)}>
                    Create Booking
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
          <div className="rounded-t-lg bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-6 py-5 text-white">
            <DialogHeader>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100">Booking form</span>
                {bookingQuotation && <span className="text-xs text-indigo-200">{bookingQuotation.quotationNumber}</span>}
              </div>
              <DialogTitle className="text-2xl font-semibold text-white">Plot booking details</DialogTitle>
              <DialogDescription className="text-indigo-100">
                Complete the applicant and profession details. Saving this booking reserves the selected unit.
              </DialogDescription>
            </DialogHeader>
          </div>
          {bookingQuotation && (
            <form onSubmit={(event) => void submitBooking(event)} className="space-y-5 px-5 pb-6 pt-5 sm:px-6">
              <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-700" />
                  <h3 className="font-semibold">Plot details</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Project", value: bookingQuotation.projectName },
                    { label: "Plot number", value: bookingQuotation.unitNumber },
                    { label: "Facing direction", value: "Not specified" },
                    { label: "Area", value: `${bookingQuotation.area.toLocaleString("en-IN")} sq ft · ${(bookingQuotation.area / 435.6).toFixed(2)} cents` },
                    { label: "Basic price", value: formatCurrency(bookingQuotation.basePrice) },
                    { label: "Total cost", value: formatCurrency(bookingQuotation.totalPrice) },
                    { label: "Quotation", value: bookingQuotation.quotationNumber },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border bg-white px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                    </div>
                  ))}
                  <div className="space-y-1.5 rounded-lg border bg-white p-3">
                    <Label htmlFor="booking-amount">Booking amount *</Label>
                    <Input
                      id="booking-amount"
                      type="number"
                      min="0"
                      max={bookingQuotation.totalPrice}
                      step="0.01"
                      required
                      value={bookingAmount}
                      onChange={(event) => setBookingAmount(event.target.value)}
                    />
                  </div>
                </div>
              </section>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 font-semibold">Applicant information</h3>
                {renderApplicantFields("First applicant", firstApplicant, setFirstApplicant, "first-applicant", true)}
                <div className="mt-4 flex items-center gap-2 rounded-lg border bg-white p-3">
                  <input
                    id="second-same-address"
                    type="checkbox"
                    className="h-4 w-4 accent-indigo-700"
                    checked={secondApplicant.sameAddress}
                    onChange={(event) => setSecondApplicant((current) => ({ ...current, sameAddress: event.target.checked }))}
                  />
                  <Label htmlFor="second-same-address" className="cursor-pointer">Second applicant address is the same as the first applicant</Label>
                </div>
                <div className="mt-4">
                  {renderApplicantFields("Second applicant (optional)", secondApplicant, setSecondApplicant, "second-applicant", false)}
                </div>
                {extraApplicants.map((applicant, index) => {
                  const title = index === 0 ? "Third applicant" : "Fourth applicant";
                  const setApplicant: React.Dispatch<React.SetStateAction<ApplicantForm>> = (value) => {
                    setExtraApplicants((current) => current.map((item, itemIndex) => {
                      if (itemIndex !== index) return item;
                      return typeof value === "function" ? value(item) : value;
                    }));
                  };
                  return (
                    <div key={title} className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3">
                        <div className="flex items-center gap-2">
                          <input
                            id={`extra-${index}-same-address`}
                            type="checkbox"
                            className="h-4 w-4 accent-indigo-700"
                            checked={applicant.sameAddress}
                            onChange={(event) => setApplicant((current) => ({ ...current, sameAddress: event.target.checked }))}
                          />
                          <Label htmlFor={`extra-${index}-same-address`} className="cursor-pointer">Address is the same as the first applicant</Label>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setExtraApplicants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                      {renderApplicantFields(title, applicant, setApplicant, `extra-applicant-${index}`, true)}
                    </div>
                  );
                })}
                {extraApplicants.length < 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => setExtraApplicants((current) => [...current, { ...emptyApplicant }])}
                  >
                    <Plus className="h-4 w-4" />
                    Add applicant
                  </Button>
                )}
              </div>

              <section className="space-y-4 rounded-xl border bg-white p-4">
                <h3 className="font-semibold">Profession details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="organization-type">Organization type *</Label>
                    <Select
                      value={profession.organizationType || undefined}
                      onValueChange={(value) => setProfession((current) => ({ ...current, organizationType: value }))}
                    >
                      <SelectTrigger id="organization-type"><SelectValue placeholder="Select organization type" /></SelectTrigger>
                      <SelectContent>
                        {ORGANIZATION_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="industry">Industry *</Label>
                    <Input
                      id="industry"
                      required
                      maxLength={100}
                      placeholder="Enter industry"
                      value={profession.industry}
                      onChange={(event) => setProfession((current) => ({ ...current, industry: event.target.value }))}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border bg-white p-4">
                <h3 className="font-semibold">Referral details</h3>
                <div className="max-w-md space-y-1.5">
                  <Label htmlFor="booking-referred-by">Referred by</Label>
                  <Select value={referredBy} onValueChange={setReferredBy}>
                    <SelectTrigger id="booking-referred-by"><SelectValue placeholder="Select referral source" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Customer">Customer</SelectItem>
                      <SelectItem value="Employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setBookingDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={bookingSaving}>
                  {bookingSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                  Save booking and reserve unit
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
          <div className="rounded-t-lg bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-6 py-5 text-white">
            <DialogHeader>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100">Quote builder</span>
                <span className="text-xs text-indigo-200">Lead {lead.id.slice(-6).toUpperCase()}</span>
              </div>
              <DialogTitle className="text-2xl font-semibold text-white">Create a quotation</DialogTitle>
              <DialogDescription className="max-w-2xl text-indigo-100">
                Select a project and available unit, set pricing, then review the customer-ready quotation.
              </DialogDescription>
              <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                {[
                  { icon: UserRound, label: "Customer" },
                  { icon: MapPinned, label: "Project & unit" },
                  { icon: CreditCard, label: "Pricing & plan" },
                ].map(({ icon: StepIcon, label }, index) => (
                  <div key={label} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">{index + 1}</span>
                    <StepIcon className="h-3.5 w-3.5 text-indigo-200" />
                    <span className="font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </DialogHeader>
          </div>
          <form onSubmit={showPreview} className="space-y-5 px-6 pb-6 pt-5">
            <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white"><UserRound className="h-4 w-4" /></span>
                <div>
                  <h3 className="font-semibold text-slate-900">Customer details</h3>
                  <p className="text-xs text-slate-500">Automatically captured from this lead</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Customer", value: leadName },
                  { label: "Phone", value: lead.mobile || lead.phone || "—" },
                  { label: "Email", value: lead.email || "—" },
                  { label: "Address", value: customerAddress || "—" },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 rounded-lg border border-white bg-white/80 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-800" title={item.value}>{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-800"><Building2 className="h-4 w-4" /></span>
                <div>
                  <h3 className="font-semibold text-slate-900">Property selection</h3>
                  <p className="text-xs text-slate-500">Choose the completed visit and project to load its live unit layout</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quote-site-visit">Completed site visit *</Label>
                  <Select value={selectedVisitId} onValueChange={setSelectedVisitId}>
                    <SelectTrigger id="quote-site-visit" className="h-11"><SelectValue placeholder="Select a completed visit" /></SelectTrigger>
                    <SelectContent>
                      {completedVisits.map((visit) => (
                        <SelectItem key={visit.id} value={visit.id}>
                          {visit.siteVisitNumber || "Site visit"} — {formatDate(visit.completedAt || visit.scheduledAt || new Date().toISOString())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="quote-project">Project *</Label>
                    {projectsError && <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => void loadProjects()}>Retry project list</Button>}
                  </div>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={projectsLoading || projects.length === 0}>
                    <SelectTrigger id="quote-project" className="h-11">
                      <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Select project"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {projectsLoading && <p role="status" className="text-xs text-slate-500">Loading active projects…</p>}
                  {projectsError && <p role="alert" className="text-xs text-rose-700">{projectsError}</p>}
                </div>
              </div>
            </section>

            {selectedProjectId ? (
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><MapPinned className="h-4 w-4" /></span>
                    <div>
                      <h3 className="font-semibold text-slate-900">Choose an available unit</h3>
                      <p className="text-xs text-slate-500">Select a green plot. Quotation confirmation never reserves a unit.</p>
                    </div>
                  </div>
                  {selectedUnit && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">{selectedUnit.number} selected</Badge>}
                </div>
                {unitsLoading ? (
                  <div role="status" className="space-y-3 rounded-xl border bg-white p-6">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <p className="text-center text-sm text-slate-500">Loading {selectedProject?.name || "project"} units…</p>
                  </div>
                ) : unitsError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center">
                    <p role="alert" className="text-sm text-rose-800">{unitsError}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={retryUnits}>Retry units</Button>
                  </div>
                ) : units.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border bg-white p-2">
                    <SampleLandLayout
                      project={{
                        id: selectedProject?.id || selectedProjectId,
                        name: selectedProject?.name || "Project",
                        location: [selectedProject?.address, selectedProject?.city].filter(Boolean).join(", "),
                        totalUnits: selectedProject?.totalUnits || units.length,
                      }}
                      plots={plots}
                      statusColors={projectUnitStatusColors}
                      demo={false}
                      pickerMode
                      selectedPlotId={selectedUnitId}
                      onSelectionChange={selectUnit}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed bg-white py-8 text-center">
                    <Building2 className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">No units are configured for this project</p>
                    <p className="mt-1 text-xs text-slate-500">Add units to this project before generating a quotation.</p>
                  </div>
                )}
              </section>
            ) : (
              <div className="rounded-xl border border-dashed bg-slate-50 p-6 text-center">
                <Building2 className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">{projectsLoading ? "Loading projects…" : "Select a project to view its layout"}</p>
              </div>
            )}

            {selectedUnit && (
              <section className="space-y-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-800"><CreditCard className="h-4 w-4" /></span>
                  <div>
                    <h3 className="font-semibold text-slate-900">Quotation pricing</h3>
                    <p className="text-xs text-slate-500">{selectedProject?.name} · Unit {selectedUnit.number} · {area.toLocaleString("en-IN")} sq ft</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="quote-area">Area (sq ft)</Label>
                    <Input id="quote-area" className="h-11 bg-slate-100 font-medium" value={area} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote-rate">Price / sq ft *</Label>
                    <Input id="quote-rate" className="h-11" type="number" min="0.01" step="0.01" required value={pricePerSqFt} onChange={(event) => setPricePerSqFt(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote-plc">PLC / other charges</Label>
                    <Input id="quote-plc" className="h-11" type="number" min="0" step="0.01" value={plcAmount} onChange={(event) => setPlcAmount(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote-discount">Discount</Label>
                    <Input id="quote-discount" className="h-11" type="number" min="0" step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950 px-4 py-3 text-white">
                  <div>
                    <p className="text-xs text-slate-300">Base price {formatCurrency(basePrice)} · PLC {formatCurrency(plc)} · Discount {formatCurrency(discount)}</p>
                    <p className="mt-1 text-xs text-slate-300">Calculated quotation value</p>
                  </div>
                  <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalPrice)}</p>
                </div>
              </section>
            )}

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800"><CreditCard className="h-4 w-4" /></span>
                  <div>
                    <h3 className="font-semibold text-slate-900">Choose a payment plan *</h3>
                    <p className="text-xs text-slate-500">Installment percentages total 100%</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PAYMENT_PLANS.map((plan) => {
                    const active = paymentPlanName === plan.name;
                    return (
                      <button
                        key={plan.name}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPaymentPlanName(plan.name)}
                        className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"}`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{plan.name}</span>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-transparent"}`}>
                            {active && <Check className="h-3 w-3" />}
                          </span>
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          {plan.installments.map((installment) => (
                            <span key={installment.milestone} className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-slate-600">
                              {installment.percentage}% {installment.milestone}
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={paymentPlanName === CUSTOM_PLAN_VALUE}
                    onClick={() => setPaymentPlanName(CUSTOM_PLAN_VALUE)}
                    className={`rounded-xl border p-3 text-left transition-colors ${paymentPlanName === CUSTOM_PLAN_VALUE ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">Build your own</span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${paymentPlanName === CUSTOM_PLAN_VALUE ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-transparent"}`}>
                        {paymentPlanName === CUSTOM_PLAN_VALUE && <Check className="h-3 w-3" />}
                      </span>
                    </span>
                    <span className="mt-2 block text-xs text-slate-500">Customize milestones, percentages, and payment timing.</span>
                  </button>
                </div>
                {paymentPlanName === CUSTOM_PLAN_VALUE && (
                  <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                    <div className="space-y-2">
                      <Label htmlFor="custom-payment-plan-name">Custom plan name *</Label>
                      <Input
                        id="custom-payment-plan-name"
                        maxLength={120}
                        value={customPlanName}
                        aria-invalid={Boolean(customPlanNameError)}
                        onChange={(event) => setCustomPlanName(event.target.value)}
                        placeholder="e.g. Construction-linked plan"
                      />
                      {customPlanNameError && <p className="text-xs text-rose-700">{customPlanNameError}</p>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Installments</p>
                        <p className="text-xs text-slate-500">Set the milestone, percent of total, and when it is due.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={customInstallments.length >= 12}
                        onClick={() => {
                          const id = `custom-installment-${++customInstallmentCounter.current}`;
                          setCustomInstallments((current) => [
                            ...current,
                            { id, milestone: "", percentage: Number.NaN, dueDays: 0 },
                          ]);
                        }}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />Add installment
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {customInstallments.map((installment, index) => {
                        const errors = customInstallmentErrors[index];
                        return (
                        <div key={installment.id} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-[minmax(0,1.4fr)_0.7fr_0.8fr_auto] sm:items-start">
                          <div className="space-y-1.5">
                            <Label htmlFor={`${installment.id}-milestone`} className="text-xs">Milestone {index + 1} *</Label>
                            <Input
                              id={`${installment.id}-milestone`}
                              value={installment.milestone}
                              maxLength={120}
                              aria-invalid={Boolean(errors?.milestone)}
                              onChange={(event) => setCustomInstallments((current) => current.map((item) =>
                                item.id === installment.id ? { ...item, milestone: event.target.value } : item
                              ))}
                              placeholder="e.g. On agreement"
                            />
                            {errors?.milestone && <p className="text-xs text-rose-700">{errors.milestone}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`${installment.id}-percentage`} className="text-xs">Percent *</Label>
                            <Input
                              id={`${installment.id}-percentage`}
                              type="number"
                              min="0.01"
                              max="100"
                              step="0.01"
                              aria-invalid={Boolean(errors?.percentage)}
                              value={Number.isFinite(installment.percentage) ? installment.percentage : ""}
                              onChange={(event) => {
                                const percentage = event.target.value === "" ? Number.NaN : Number(event.target.value);
                                setCustomInstallments((current) => current.map((item) =>
                                  item.id === installment.id ? { ...item, percentage } : item
                                ));
                              }}
                            />
                            {errors?.percentage && <p className="text-xs text-rose-700">{errors.percentage}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`${installment.id}-days`} className="text-xs">Due after (days)</Label>
                            <Input
                              id={`${installment.id}-days`}
                              type="number"
                              min="0"
                              step="1"
                              aria-invalid={Boolean(errors?.dueDays)}
                              value={Number.isFinite(installment.dueDays) ? installment.dueDays : ""}
                              onChange={(event) => {
                                const dueDays = event.target.value === "" ? Number.NaN : Number(event.target.value);
                                setCustomInstallments((current) => current.map((item) =>
                                  item.id === installment.id ? { ...item, dueDays } : item
                                ));
                              }}
                            />
                            {errors?.dueDays && <p className="text-xs text-rose-700">{errors.dueDays}</p>}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="sm:mt-6"
                            disabled={customInstallments.length <= 1}
                            aria-label={`Remove installment ${index + 1}`}
                            onClick={() => setCustomInstallments((current) => current.filter((item) => item.id !== installment.id))}
                          >
                            Remove
                          </Button>
                          <p className="text-xs text-slate-500 sm:col-span-4">
                            Installment amount: {formatCurrency(customAmounts[index] || 0)}
                          </p>
                        </div>
                        );
                      })}
                    </div>
                    <div
                      role="status"
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${customPlanTotalExact ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900 ring-2 ring-rose-300"}`}
                    >
                      <span>Payment allocation</span>
                      <span className="font-semibold">{formatShare(customPlanTotal)}% / 100%</span>
                    </div>
                    {!customPlanTotalExact && (
                      <p role="alert" className="text-sm font-medium text-rose-800">{customPlanTotalMessage}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Label htmlFor="quote-terms">Terms and notes</Label>
                <Textarea id="quote-terms" className="min-h-28 resize-y" maxLength={5000} value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Add optional quotation terms or notes…" />
                <p className="text-right text-[10px] text-slate-400">{terms.length} / 5000</p>
              </div>
            </section>
            <DialogFooter className="border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-700 hover:bg-indigo-800" disabled={projectsLoading || unitsLoading || !selectedUnitId || !paymentPlanValid}>
                Generate Quotation Preview
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quotation Preview</DialogTitle>
            <DialogDescription>Review the details before confirming and saving this quotation.</DialogDescription>
          </DialogHeader>
          <div id="quotation-print-area" className="space-y-5 rounded-md border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
              <div>
                <h2 className="text-xl font-semibold">Quotation</h2>
                <p className="text-sm text-muted-foreground">Prepared for {leadName}</p>
              </div>
              <Badge variant="outline">Preview</Badge>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Project:</span> {selectedProject?.name || "—"}</p>
              <p><span className="text-muted-foreground">Unit:</span> {selectedUnit?.number || "—"} {selectedUnit?.type || ""}</p>
              <p><span className="text-muted-foreground">Area:</span> {area.toLocaleString("en-IN")} sq ft</p>
              <p><span className="text-muted-foreground">Rate:</span> {formatCurrency(Number(pricePerSqFt))} / sq ft</p>
            </div>
            <div className="space-y-2 border-y py-4 text-sm">
              <div className="flex justify-between"><span>Base price</span><span>{formatCurrency(basePrice)}</span></div>
              <div className="flex justify-between"><span>PLC / other charges</span><span>{formatCurrency(plc)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total quotation value</span><span>{formatCurrency(totalPrice)}</span></div>
            </div>
            <div>
              <h3 className="font-semibold">Payment plan: {selectedPlan.name}</h3>
              <div className="mt-2 divide-y rounded-md border">
                {quotationScheduleAmounts(totalPrice, selectedPlan.installments.map((item) => item.percentage)).map((amount, index) => {
                  const installment = selectedPlan.installments[index];
                  return (
                  <div key={`${installment.milestone}-${index}`} className="flex justify-between gap-2 p-2 text-sm">
                    <span>
                      {installment.milestone} ({installment.percentage}%) · {quotationDueLabel(installment)}
                    </span>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                  );
                })}
              </div>
            </div>
            {terms && <p className="whitespace-pre-wrap text-sm"><span className="font-medium">Terms:</span> {terms}</p>}
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">This quotation does not reserve or change the availability of the selected unit.</p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => { setPreviewOpen(false); setBuilderOpen(true); }}>Back to edit</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" />Print
              </Button>
              <Button type="button" onClick={() => void confirmQuotation()} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Confirm Quotation
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PdfDocumentPreview preview={pdfPreview} onClose={closePdfPreview} />
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #quotation-print-area, #quotation-print-area * { visibility: visible !important; }
          #quotation-print-area {
            position: fixed;
            inset: 0;
            width: 100%;
            max-height: none !important;
            overflow: visible !important;
            border: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </Card>
  );
}
