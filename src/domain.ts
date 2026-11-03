export const departments = [
  "Front desk",
  "Operations",
  "Customer care",
] as const;
export type Department = (typeof departments)[number];
export interface Employee {
  id: string;
  name: string;
  department: Department;
  rate: number;
  maxHours: number;
}
export interface Shift {
  id: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
}
export interface Settings {
  budget: number;
  minimums: Record<Department, number>;
  open: string;
  close: string;
}
export interface Data {
  version: 1;
  employees: Employee[];
  shifts: Shift[];
  settings: Settings;
}
export const minutes = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const hours = (s: Shift) => (minutes(s.end) - minutes(s.start)) / 60;
export const overlaps = (a: Shift, b: Shift) =>
  a.id !== b.id &&
  a.employeeId === b.employeeId &&
  a.date === b.date &&
  minutes(a.start) < minutes(b.end) &&
  minutes(b.start) < minutes(a.end);
export const employeeHours = (id: string, shifts: Shift[]) =>
  shifts.filter((s) => s.employeeId === id).reduce((n, s) => n + hours(s), 0);
export const labourCost = (shifts: Shift[], employees: Employee[]) =>
  Math.round(
    shifts.reduce(
      (n, s) =>
        n +
        hours(s) * (employees.find((e) => e.id === s.employeeId)?.rate ?? 0),
      0,
    ) * 100,
  ) / 100;
export function datesForWeek(date: string) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(x.getDate() + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
}
export function coverageGaps(
  date: string,
  department: Department,
  shifts: Shift[],
  employees: Employee[],
  settings: Settings,
) {
  const relevant = shifts.filter(
    (s) =>
      s.date === date &&
      employees.some(
        (e) => e.id === s.employeeId && e.department === department,
      ),
  );
  const start = minutes(settings.open),
    end = minutes(settings.close);
  const points = [
    ...new Set([
      start,
      end,
      ...relevant.flatMap((s) => [
        Math.max(start, Math.min(end, minutes(s.start))),
        Math.max(start, Math.min(end, minutes(s.end))),
      ]),
    ]),
  ].sort((a, b) => a - b);
  return points
    .slice(0, -1)
    .filter(
      (p, i) =>
        points[i + 1] > p &&
        new Set(
          relevant
            .filter((s) => minutes(s.start) <= p && minutes(s.end) > p)
            .map((s) => s.employeeId),
        ).size < settings.minimums[department],
    )
    .map((p) => ({ start: p, end: points[points.indexOf(p) + 1] }));
}
export function csv(shifts: Shift[], employees: Employee[]) {
  const cell = (v: unknown) =>
    '"' +
    String(v)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    [
      "Employee",
      "Department",
      "Date",
      "Start",
      "End",
      "Hours",
      "Estimated cost (AUD)",
    ],
    ...shifts.map((s) => {
      const e = employees.find((e) => e.id === s.employeeId)!;
      return [
        e.name,
        e.department,
        s.date,
        s.start,
        s.end,
        hours(s).toFixed(2),
        (hours(s) * e.rate).toFixed(2),
      ];
    }),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
export function demo(): Data {
  const employees: Employee[] = [
    ["Avery Morgan", "Front desk", 28, 38],
    ["Jordan Ellis", "Operations", 32, 38],
    ["Riley Chen", "Customer care", 30, 32],
    ["Casey Brooks", "Front desk", 27, 30],
    ["Taylor Reed", "Operations", 31, 38],
    ["Samira Lane", "Customer care", 29, 32],
  ].map(([name, department, rate, maxHours], i) => ({
    id: `e${i}`,
    name: String(name),
    department: department as Department,
    rate: Number(rate),
    maxHours: Number(maxHours),
  }));
  const dates = datesForWeek("2026-11-02");
  return {
    version: 1,
    employees,
    shifts: employees.flatMap((e, i) =>
      dates
        .slice(0, 5)
        .filter((_, day) => (day + i) % 5 !== 4)
        .map((date, j) => ({
          id: `s${i}-${j}`,
          employeeId: e.id,
          date,
          start: i < 3 ? "09:00" : "10:00",
          end: i < 3 ? "17:00" : "16:00",
        })),
    ),
    settings: {
      budget: 6000,
      minimums: { "Front desk": 1, Operations: 1, "Customer care": 1 },
      open: "09:00",
      close: "17:00",
    },
  };
}
const timeValid = (v: unknown): v is string =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function isData(v: unknown): v is Data {
  if (!v || typeof v !== "object") return false;
  const d = v as Data;
  return (
    d.version === 1 &&
    Array.isArray(d.employees) &&
    Array.isArray(d.shifts) &&
    d.employees.every(
      (e) =>
        typeof e.id === "string" &&
        typeof e.name === "string" &&
        e.name.trim().length > 0 &&
        departments.includes(e.department) &&
        Number.isFinite(e.rate) &&
        e.rate >= 0 &&
        Number.isFinite(e.maxHours) &&
        e.maxHours > 0,
    ) &&
    new Set(d.employees.map((e) => e.id)).size === d.employees.length &&
    d.shifts.every(
      (s) =>
        typeof s.id === "string" &&
        d.employees.some((e) => e.id === s.employeeId) &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
        timeValid(s.start) &&
        timeValid(s.end) &&
        s.end > s.start,
    ) &&
    new Set(d.shifts.map((s) => s.id)).size === d.shifts.length &&
    !!d.settings &&
    Number.isFinite(d.settings.budget) &&
    d.settings.budget >= 0 &&
    timeValid(d.settings.open) &&
    timeValid(d.settings.close) &&
    d.settings.close > d.settings.open &&
    departments.every(
      (dep) =>
        Number.isInteger(d.settings.minimums?.[dep]) &&
        d.settings.minimums[dep] >= 0,
    )
  );
}
