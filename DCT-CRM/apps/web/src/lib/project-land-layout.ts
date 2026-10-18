import type { SampleLandPlot, SamplePlotStatus } from "@/lib/mock-land-layout";
import { createMasterPlanPlotSlots } from "@/lib/land-layout-geometry";

export interface ProjectLayoutUnit {
  id: string;
  unitNumber: string;
  type: string;
  area: number;
  price: number;
  status: string;
}

export const projectUnitStatusColors: Record<SamplePlotStatus, string> = {
  Available: "#00EE00",
  Blocked: "#FFFF00",
  Booked: "#FF0000",
  Reserved: "#FF7F27",
  Sold: "#9874ED",
  Hold: "#269CFF",
  Investor: "#FF7F27",
  Registered: "#9874ED",
  "Not Released": "#269CFF",
};

export const projectUnitStatuses: SamplePlotStatus[] = [
  "Available",
  "Blocked",
  "Booked",
  "Reserved",
  "Sold",
  "Hold",
];

function displayUnitStatus(status: string): SamplePlotStatus {
  switch (status.toUpperCase()) {
    case "AVAILABLE": return "Available";
    case "BLOCKED": return "Blocked";
    case "BOOKED": return "Booked";
    case "RESERVED": return "Reserved";
    case "SOLD": return "Sold";
    case "HOLD": return "Hold";
    default: return "Not Released";
  }
}

export function createIllustrativeProjectPlots(
  projectId: string,
  units: ProjectLayoutUnit[],
): SampleLandPlot[] {
  const slots = createMasterPlanPlotSlots(units.length);

  return units.map((unit, index) => {
    const slot = slots[index];
    return {
      id: unit.id,
      plotNumber: unit.unitNumber,
      projectId,
      ...slot,
      area: unit.area,
      unitType: unit.type,
      price: unit.price,
      facing: "Not configured",
      status: displayUnitStatus(unit.status),
    };
  });
}
