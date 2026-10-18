import { describe, expect, it } from "vitest";
import {
  sampleLandPlots,
  sampleLandProject,
  samplePlotStatuses,
  samplePlotStatusColors,
} from "./mock-land-layout";
import {
  createMasterPlanPlotSlots,
  masterPlanGeometry,
  masterPlanInternalRoads,
} from "./land-layout-geometry";
import { createIllustrativeProjectPlots, projectUnitStatusColors } from "./project-land-layout";

describe("sample land layout data", () => {
  it("contains 80 to 100 uniquely identified fictional plots across four blocks", () => {
    expect(sampleLandPlots.length).toBeGreaterThanOrEqual(80);
    expect(sampleLandPlots.length).toBeLessThanOrEqual(100);
    expect(sampleLandPlots).toHaveLength(100);
    expect(new Set(sampleLandPlots.map((plot) => plot.id)).size).toBe(sampleLandPlots.length);
    expect(new Set(sampleLandPlots.map((plot) => plot.plotNumber)).size).toBe(sampleLandPlots.length);
    expect(new Set(sampleLandPlots.map((plot) => plot.block))).toEqual(new Set(["Block A", "Block B", "Block C", "Block D"]));
    expect(["Block A", "Block B", "Block C", "Block D"].map(
      (block) => sampleLandPlots.filter((plot) => plot.block === block).length,
    )).toEqual([25, 25, 25, 25]);
    expect(sampleLandPlots.filter((plot) => plot.status === "Available")).toHaveLength(80);
  });

  it("covers all sample statuses and gives every plot a clear non-overlapping slot", () => {
    expect(new Set(sampleLandPlots.map((plot) => plot.status))).toEqual(new Set(samplePlotStatuses));
    expect(samplePlotStatuses.every((status) => Boolean(samplePlotStatusColors[status]))).toBe(true);
    expect(samplePlotStatusColors).toMatchObject({
      Available: "#00EE00",
      Blocked: "#FFFF00",
      Booked: "#FF0000",
      Investor: "#FF7F27",
      Registered: "#9874ED",
      "Not Released": "#269CFF",
    });
    expect(sampleLandPlots.every((plot) => (
      plot.projectId === sampleLandProject.id
      && plot.width > 0
      && plot.height > 0
      && plot.area > 0
      && Number.isFinite(plot.rotation)
    ))).toBe(true);
    for (let first = 0; first < sampleLandPlots.length; first += 1) {
      for (let second = first + 1; second < sampleLandPlots.length; second += 1) {
        const left = sampleLandPlots[first];
        const right = sampleLandPlots[second];
        if (left.block !== right.block) continue;
        expect(
          left.x + left.width <= right.x
          || right.x + right.width <= left.x
          || left.y + left.height <= right.y
          || right.y + right.height <= left.y,
        ).toBe(true);
      }
    }
    expect(masterPlanGeometry.roads.length).toBeGreaterThan(2);
    expect(masterPlanGeometry.parks.length).toBeGreaterThan(0);
    expect(new Set(masterPlanInternalRoads.map((road) => road.id)).size).toBe(masterPlanInternalRoads.length);
    expect(sampleLandPlots.some((plot) => plot.rotation !== 0)).toBe(true);
    expect(sampleLandPlots.some((plot) => plot.block === "Block D" && plot.rotation === 90)).toBe(true);
  });

  it("maps live project units to illustrative positions without changing their inventory data", () => {
    const units = [
      { id: "unit-1", unitNumber: "DCTValley-U001", type: "Villa", area: 1800, price: 9000000, status: "available" },
      { id: "unit-2", unitNumber: "DCTValley-U002", type: "2BHK", area: 1900, price: 9500000, status: "reserved" },
      { id: "unit-3", unitNumber: "DCTValley-U003", type: "2BHK", area: 2000, price: 10000000, status: "BOOKED" },
    ];
    const plots = createIllustrativeProjectPlots("dct-valley", units);

    expect(plots).toHaveLength(3);
    expect(plots.map((plot) => plot.id)).toEqual(["unit-1", "unit-2", "unit-3"]);
    expect(plots.map((plot) => plot.plotNumber)).toEqual(["DCTValley-U001", "DCTValley-U002", "DCTValley-U003"]);
    expect(plots.map((plot) => plot.status)).toEqual(["Available", "Reserved", "Booked"]);
    expect(plots.map((plot) => plot.area)).toEqual([1800, 1900, 2000]);
    expect(projectUnitStatusColors.Reserved).toBe("#FF7F27");
    expect(projectUnitStatusColors.Booked).toBe("#FF0000");
    expect(plots[0].facing).toBe("Not configured");
    expect(new Set(plots.map((plot) => plot.block)).size).toBe(3);
    expect(plots[0].x).not.toBe(plots[1].x);
  });

  it("keeps additional live units in the plan when inventory exceeds the sample block capacity", () => {
    const slots = createMasterPlanPlotSlots(350);
    expect(slots).toHaveLength(350);
    expect(new Set(slots.map((slot) => slot.block))).toEqual(new Set(["Block A", "Block B", "Block C", "Block D"]));
  });
});
