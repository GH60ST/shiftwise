import { describe, it, expect } from "vitest";
import {
  overlaps,
  hours,
  employeeHours,
  labourCost,
  coverageGaps,
  datesForWeek,
  csv,
  demo,
  isData,
  type Shift,
} from "./domain";
const shift = (
  id: string,
  start: string,
  end: string,
  employeeId = "e0",
  date = "2026-11-02",
): Shift => ({ id, start, end, employeeId, date });
describe("scheduling conflicts", () => {
  it("detects partial, contained and identical intervals", () => {
    for (const b of [
      shift("b", "10:00", "18:00"),
      shift("b", "10:00", "11:00"),
      shift("b", "09:00", "17:00"),
    ])
      expect(overlaps(shift("a", "09:00", "17:00"), b)).toBe(true);
  });
  it("allows adjacent shifts and excludes self, other employees and dates", () => {
    const a = shift("a", "09:00", "17:00");
    for (const b of [
      a,
      shift("b", "17:00", "18:00"),
      shift("b", "08:00", "09:00"),
      shift("b", "09:00", "17:00", "e1"),
      shift("b", "09:00", "17:00", "e0", "2026-11-03"),
    ])
      expect(overlaps(a, b)).toBe(false);
  });
});
describe("hours and labour estimates", () => {
  it("calculates fractional hours and totals by employee", () => {
    const s = [
      shift("a", "09:15", "12:45"),
      shift("b", "13:00", "17:15"),
      shift("c", "09:00", "17:00", "e1"),
    ];
    expect(hours(s[0])).toBe(3.5);
    expect(employeeHours("e0", s)).toBe(7.75);
    expect(employeeHours("missing", s)).toBe(0);
  });
  it("applies each employee rate and rounds the final estimate to cents", () => {
    const employees = demo().employees;
    employees[0].rate = 28.37;
    employees[1].rate = 32;
    expect(
      labourCost(
        [shift("a", "09:00", "10:30"), shift("b", "10:00", "12:00", "e1")],
        employees,
      ),
    ).toBe(106.56);
    expect(labourCost([], employees)).toBe(0);
  });
});
describe("coverage and export", () => {
  it("finds intra-day gaps and counts overlapping employees only once", () => {
    const d = demo();
    d.settings.minimums["Front desk"] = 2;
    const s = [
      shift("a", "09:00", "17:00"),
      shift("b", "10:00", "17:00"),
      shift("c", "12:00", "17:00", "e3"),
    ];
    expect(
      coverageGaps("2026-11-02", "Front desk", s, d.employees, d.settings),
    ).toEqual([
      { start: 540, end: 600 },
      { start: 600, end: 720 },
    ]);
  });
  it("accepts exact boundary coverage and disabled requirements", () => {
    const d = demo();
    expect(
      coverageGaps(
        "2026-11-02",
        "Front desk",
        [shift("a", "09:00", "17:00")],
        d.employees,
        d.settings,
      ),
    ).toEqual([]);
    d.settings.minimums["Front desk"] = 0;
    expect(
      coverageGaps("2026-11-02", "Front desk", [], d.employees, d.settings),
    ).toEqual([]);
  });
  it("handles weeks across year boundaries", () =>
    expect(datesForWeek("2027-01-01")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]));
  it("quotes CSV and neutralizes spreadsheet formula prefixes", () => {
    const d = demo();
    d.employees[0].name = "=SUM(1,2)";
    expect(csv([shift("a", "09:00", "17:00")], d.employees)).toContain(
      '"\'=SUM(1,2)"',
    );
    d.employees[0].name = 'A "Name"';
    expect(csv([shift("a", "09:00", "17:00")], d.employees)).toContain(
      '"A ""Name"""',
    );
  });
  it("validates persisted data and rejects corrupt references", () => {
    expect(isData(demo())).toBe(true);
    expect(isData({})).toBe(false);
    const d = demo();
    d.shifts[0].employeeId = "missing";
    expect(isData(d)).toBe(false);
  });
});
