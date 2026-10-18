"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { objectManagerApi, unitApi } from "@/lib/api";
import { subscribeToUnitInventoryUpdates } from "@/lib/unit-inventory-events";
import { useToast } from "@/hooks/use-toast";

type UnitRecord = {
  id: string;
  number: string;
  type?: string | null;
  block?: string | null;
  floor?: number | null;
  area?: number | null;
  price?: number | null;
  status: string;
  customFields?: Record<string, string | number | boolean | null> | null;
  project?: { id: string; name: string } | null;
};

type UnitField = {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  required?: boolean;
  editable?: boolean;
  helpText?: string | null;
  scale?: number | null;
  picklistValues?: { id: string; label: string; value: string; isActive?: boolean }[];
};

type LayoutSection = { name: string; fields: string[] };

export default function UnitDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const [unit, setUnit] = React.useState<UnitRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [fields, setFields] = React.useState<UnitField[]>([]);
  const [sections, setSections] = React.useState<LayoutSection[]>([]);
  const [values, setValues] = React.useState<Record<string, string | number | boolean | null>>({});
  const [saving, setSaving] = React.useState(false);

  const fetchUnit = React.useCallback(async () => {
    try {
      const response = await unitApi.get(params.id as string);
      if (!response.data?.success || !response.data.data) {
        throw new Error(response.data?.error || "Unit not found");
      }
      setUnit(response.data.data);
    } catch (error: any) {
      toast({
        title: "Unable to load unit",
        description: error?.response?.data?.error || error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  React.useEffect(() => {
    void fetchUnit();
  }, [fetchUnit]);

  React.useEffect(() => {
    void Promise.all([
      objectManagerApi.listFields("Unit", { includeInactive: false }),
      objectManagerApi.getDefaultLayout("Unit"),
    ]).then(([fieldResponse, layoutResponse]) => {
      setFields(Array.isArray(fieldResponse.data.data) ? fieldResponse.data.data : []);
      const raw = layoutResponse.data.data?.sections;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      setSections(Array.isArray(parsed) ? parsed : []);
    }).catch(() => {
      setFields([]);
      setSections([]);
    });
  }, []);

  React.useEffect(() => {
    if (!unit) return;
    const stored = unit.customFields && typeof unit.customFields === "object" ? unit.customFields : {};
    setValues({ ...stored, Name: stored.Name ?? unit.number });
  }, [unit]);

  React.useEffect(
    () => subscribeToUnitInventoryUpdates(() => void fetchUnit()),
    [fetchUnit],
  );

  const saveFields = async () => {
    if (!unit) return;
    const payload: Record<string, string | number | boolean | null> = {};
    for (const field of fields) {
      if (field.editable === false || field.name === "Project__c") continue;
      payload[field.name] = values[field.name] ?? null;
    }
    setSaving(true);
    try {
      const response = await unitApi.update(unit.id, { customFields: payload });
      if (!response.data?.success) throw new Error(response.data?.error || "Unable to save unit fields");
      setUnit(response.data.data);
      toast({ title: "Unit fields saved" });
    } catch (error: any) {
      toast({
        title: "Unable to save unit fields",
        description: error?.response?.data?.error || error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-4 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (!unit) return <p className="p-6 text-sm text-muted-foreground">Unit not found or unavailable.</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link href="/units" aria-label="Back to units"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground"><Building className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unit</p>
            <h1 className="text-lg font-semibold">{unit.number}</h1>
            <p className="text-sm text-muted-foreground">{unit.project?.name || "Project"}{unit.type ? ` · ${unit.type}` : ""}</p>
          </div>
        </div>
        <Badge>{unit.status.replace(/_/g, " ")}</Badge>
      </header>

      <Card>
        <CardHeader><CardTitle>Unit Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-sm text-muted-foreground">Project</p><p className="font-medium">{unit.project?.name || "—"}</p></div>
          <div><p className="text-sm text-muted-foreground">Unit Type</p><p className="font-medium">{unit.type || "—"}</p></div>
          <div><p className="text-sm text-muted-foreground">Block</p><p className="font-medium">{unit.block || "—"}</p></div>
          <div><p className="text-sm text-muted-foreground">Floor</p><p className="font-medium">{unit.floor == null ? "—" : unit.block ? `Floor ${unit.floor}` : unit.floor}</p></div>
          <div><p className="text-sm text-muted-foreground">Area</p><p className="font-medium">{unit.area == null ? "—" : `${unit.area} sq.ft`}</p></div>
        </CardContent>
      </Card>

      {fields.length > 0 && (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveFields(); }}>
          {(sections.length ? sections : [{ name: "Unit fields", fields: fields.map((field) => field.name) }]).map((section) => {
            const sectionFields = section.fields
              .map((name) => fields.find((field) => field.name === name))
              .filter((field): field is UnitField => Boolean(field));
            if (!sectionFields.length) return null;
            return (
              <Card key={section.name}>
                <CardHeader><CardTitle>{section.name}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {sectionFields.map((field) => (
                    <UnitFieldInput
                      key={field.id}
                      field={field}
                      value={field.name === "Project__c" ? unit.project?.name || "" : values[field.name] ?? ""}
                      readOnly={field.editable === false || field.name === "Project__c"}
                      onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save unit fields"}</Button>
        </form>
      )}

    </div>
  );
}

function UnitFieldInput({
  field,
  value,
  readOnly,
  onChange,
}: {
  field: UnitField;
  value: string | number | boolean | null;
  readOnly: boolean;
  onChange: (value: string | number | boolean | null) => void;
}) {
  const wide = field.fieldType === "longText";
  const label = (
    <label className="text-xs font-medium text-teal-700" htmlFor={`unit-${field.name}`}>
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </label>
  );
  if (readOnly) {
    return (
      <div className={wide ? "lg:col-span-2" : undefined}>
        {label}
        <p className="mt-1 text-sm font-medium">{value === "" || value == null ? "—" : String(value)}</p>
        {field.helpText?.includes("Formula") && <p className="text-[11px] text-muted-foreground">Formula field. Not calculated.</p>}
      </div>
    );
  }
  if (field.fieldType === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    );
  }
  if (field.fieldType === "longText") {
    return (
      <div className="space-y-1 lg:col-span-2">
        {label}
        <Textarea id={`unit-${field.name}`} rows={3} maxLength={field.name === "Reservation_Comments__c" ? 131072 : 5000} value={value == null ? "" : String(value)} onChange={(event) => onChange(event.target.value || null)} />
      </div>
    );
  }
  if (field.fieldType === "picklist" && field.picklistValues?.length) {
    return (
      <div className="space-y-1">
        {label}
        <select id={`unit-${field.name}`} value={value == null ? "" : String(value)} onChange={(event) => onChange(event.target.value || null)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Select</option>
          {field.picklistValues.filter((option) => option.isActive !== false).map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    );
  }
  const numeric = field.fieldType === "number" || field.fieldType === "currency" || field.fieldType === "percentage";
  return (
    <div className="min-w-0 space-y-1">
      {label}
      <Input
        id={`unit-${field.name}`}
        type={numeric ? "number" : field.fieldType === "date" ? "date" : "text"}
        step={numeric ? (field.scale === 0 ? "1" : "any") : undefined}
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(numeric ? (event.target.value === "" ? null : Number(event.target.value)) : (event.target.value || null))}
      />
    </div>
  );
}
