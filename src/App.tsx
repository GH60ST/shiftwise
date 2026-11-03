import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Users,
  SlidersHorizontal,
  ArrowDownToLine,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Wallet,
  TrendingUp,
  Check,
  X,
  Leaf,
  TriangleAlert,
  RotateCcw,
} from "lucide-react";
import {
  demo,
  isData,
  departments,
  datesForWeek,
  hours,
  employeeHours,
  labourCost,
  overlaps,
  coverageGaps,
  csv,
  type Data,
  type Employee,
  type Shift,
} from "./domain";
const KEY = "shiftwise-v01";
const money = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
const shortDate = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
type Editor =
  | { kind: "shift"; value: Shift }
  | { kind: "employee"; value: Employee }
  | { kind: "settings" }
  | null;
export default function App() {
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<Data>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isData(parsed)) return parsed;
      }
    } catch {
      /* Fall back to safe fictional data. */
    }
    return demo();
  });
  const [page, setPage] = useState("Roster");
  const [week, setWeek] = useState("2026-11-02");
  const [filter, setFilter] = useState("All departments");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      setNotice(
        "Browser storage is unavailable. Changes will only last for this session.",
      );
    }
  }, [data]);
  useEffect(() => {
    if (editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor]);
  const days = datesForWeek(week),
    shifts = data.shifts.filter((s) => days.includes(s.date)),
    cost = labourCost(shifts, data.employees),
    total = shifts.reduce((n, s) => n + hours(s), 0);
  const conflicts = shifts.filter((s) => shifts.some((t) => overlaps(s, t)));
  const gaps = days.flatMap((date) =>
    departments
      .filter(
        (dep) =>
          coverageGaps(date, dep, shifts, data.employees, data.settings).length,
      )
      .map((dep) => `${shortDate(date)} · ${dep}`),
  );
  const over = data.employees.filter(
    (e) => employeeHours(e.id, shifts) > e.maxHours,
  );
  const employees = data.employees.filter(
    (e) =>
      (filter === "All departments" || e.department === filter) &&
      e.name.toLowerCase().includes(search.toLowerCase()),
  );
  function open(v: Editor) {
    setError("");
    setEditor(v);
  }
  function newShift(employeeId = data.employees[0]?.id, date = days[0]) {
    if (!employeeId) {
      setPage("Employees");
      setNotice("Add an employee before creating a shift.");
      return;
    }
    open({
      kind: "shift",
      value: {
        id: crypto.randomUUID(),
        employeeId,
        date,
        start: "09:00",
        end: "17:00",
      },
    });
  }
  function moveWeek(n: number) {
    const d = new Date(days[0] + "T12:00:00");
    d.setDate(d.getDate() + n * 7);
    setWeek(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (!editor) return;
    if (editor.kind === "shift") {
      const s: Shift = {
        id: editor.value.id,
        employeeId: String(f.get("employeeId")),
        date: String(f.get("date")),
        start: String(f.get("start")),
        end: String(f.get("end")),
      };
      if (s.end <= s.start) {
        setError(
          "End time must be after start time. Split overnight shifts across dates.",
        );
        return;
      }
      setData((d) => ({
        ...d,
        shifts: [...d.shifts.filter((x) => x.id !== s.id), s],
      }));
    }
    if (editor.kind === "employee") {
      const e: Employee = {
        id: editor.value.id,
        name: String(f.get("name")).trim(),
        department: String(f.get("department")) as Employee["department"],
        rate: Number(f.get("rate")),
        maxHours: Number(f.get("maxHours")),
      };
      if (!e.name) {
        setError("Enter an employee name.");
        return;
      }
      setData((d) => ({
        ...d,
        employees: [...d.employees.filter((x) => x.id !== e.id), e],
      }));
    }
    if (editor.kind === "settings") {
      const settings = {
        budget: Number(f.get("budget")),
        open: String(f.get("open")),
        close: String(f.get("close")),
        minimums: Object.fromEntries(
          departments.map((dep) => [dep, Number(f.get(dep))]),
        ) as Data["settings"]["minimums"],
      };
      if (settings.close <= settings.open) {
        setError("Closing time must be after opening time.");
        return;
      }
      setData((d) => ({ ...d, settings }));
    }
    setEditor(null);
    setNotice("Changes saved.");
  }
  function remove() {
    if (!editor || editor.kind === "settings") return;
    if (
      !window.confirm(
        editor.kind === "employee"
          ? "Delete this employee and all their shifts?"
          : "Delete this shift?",
      )
    )
      return;
    const item = editor;
    setData((d) =>
      item.kind === "shift"
        ? { ...d, shifts: d.shifts.filter((s) => s.id !== item.value.id) }
        : {
            ...d,
            employees: d.employees.filter((e) => e.id !== item.value.id),
            shifts: d.shifts.filter((s) => s.employeeId !== item.value.id),
          },
    );
    setEditor(null);
  }
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob(
        [
          "\uFEFF" +
            csv(
              [...shifts].sort(
                (a, b) =>
                  a.date.localeCompare(b.date) ||
                  a.start.localeCompare(b.start),
              ),
              data.employees,
            ),
        ],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `shiftwise-${days[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Weekly roster exported.");
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Roster");
          }}
        >
          <span className="brand-icon">
            <Leaf size={23} />
          </span>
          shiftwise<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            Studio Collective<small>Demo workspace</small>
          </div>
          <span className="demo-tag">DEMO</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            ["Roster", CalendarDays],
            ["Employees", Users],
            ["Settings", SlidersHorizontal],
          ].map(([label, Icon]) => (
            <button
              key={String(label)}
              aria-label={String(label)}
              aria-current={page === label ? "page" : undefined}
              className={page === label ? "active" : ""}
              onClick={() => setPage(String(label))}
            >
              <Icon size={19} />
              {String(label)}
              {label === "Roster" && <span className="nav-count">7</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <span className="live-dot" /> Your planning playground
            <p>
              Fictional team. Real possibilities.
              <br />
              All changes stay in this browser.
            </p>
          </div>
          <button
            className="reset"
            onClick={() => {
              if (
                window.confirm(
                  "Reset all employees, shifts and settings to fictional demo data?",
                )
              ) {
                setData(demo());
                setWeek("2026-11-02");
                setNotice("Demo data restored.");
              }
            }}
          >
            <RotateCcw size={15} />
            Reset Demo Data
          </button>
          <div className="profile">
            <span className="avatar">DM</span>
            <div>
              Demo Manager<small>Workspace admin</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <span>
            Workspace <span className="crumb">/</span> <b>{page}</b>
          </span>
          <span className="local-status">
            <span className="live-dot" /> Saved in this browser
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR TEAM, IN SYNC</div>
              <h1>
                {page === "Roster"
                  ? "A better week starts here."
                  : page === "Employees"
                    ? "People behind the plan."
                    : "Make the plan yours."}
              </h1>
              <p>
                {page === "Roster"
                  ? "Build a balanced roster. Keep your team and budget on track."
                  : page === "Employees"
                    ? "Manage your fictional team, rates and weekly availability."
                    : "Set your budget and the coverage your team needs."}
              </p>
            </div>
            <div className="heading-actions">
              {page === "Roster" ? (
                <>
                  <button className="button" onClick={exportCsv}>
                    <ArrowDownToLine size={16} />
                    Export CSV
                  </button>
                  <button className="button primary" onClick={() => newShift()}>
                    <Plus size={17} />
                    Add shift
                  </button>
                </>
              ) : page === "Employees" ? (
                <button
                  className="button primary"
                  onClick={() =>
                    open({
                      kind: "employee",
                      value: {
                        id: crypto.randomUUID(),
                        name: "",
                        department: "Front desk",
                        rate: 28,
                        maxHours: 38,
                      },
                    })
                  }
                >
                  <Plus size={17} />
                  Add employee
                </button>
              ) : null}
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <section className="metrics" aria-label="Weekly metrics">
            <div className="metric">
              <div>
                Scheduled hours
                <Clock3 size={18} />
              </div>
              <strong>
                {total.toFixed(1)}
                <small> hrs</small>
              </strong>
              <span>
                {shifts.length} shifts across {days.length} days
              </span>
            </div>
            <div className="metric">
              <div>
                Estimated labour cost
                <Wallet size={18} />
              </div>
              <strong>
                {money(cost)}
                <small> AUD</small>
              </strong>
              <span>Hourly rates × scheduled hours</span>
            </div>
            <div className="metric">
              <div>
                Weekly budget variance
                <TrendingUp size={18} />
              </div>
              <strong className={cost > data.settings.budget ? "red" : "green"}>
                {money(Math.abs(data.settings.budget - cost))}
                <small> {cost > data.settings.budget ? "over" : "under"}</small>
              </strong>
              <span>of {money(data.settings.budget)} weekly budget</span>
              <div className="progress">
                <i
                  style={{
                    width: `${Math.min(100, data.settings.budget ? (cost / data.settings.budget) * 100 : 100)}%`,
                  }}
                />
              </div>
            </div>
          </section>
          {page === "Roster" && (
            <>
              <section className="roster-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      Weekly roster <span className="pill">Draft</span>
                    </h2>
                    <p>A little clarity for everyone's week.</p>
                  </div>
                  <div className="week-picker">
                    <button
                      aria-label="Previous week"
                      onClick={() => moveWeek(-1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <span>
                      {shortDate(days[0])} – {shortDate(days[6])},{" "}
                      {days[0].slice(0, 4)}
                    </span>
                    <button aria-label="Next week" onClick={() => moveWeek(1)}>
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
                <div className="roster-tools">
                  <div className="filters">
                    <select
                      aria-label="Filter department"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option>All departments</option>
                      {departments.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                    <input
                      aria-label="Search employees"
                      placeholder="Search your team…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <span className="employee-count">
                    {employees.length} team members
                  </span>
                </div>
                <div className="table-scroll">
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>Team member</th>
                        {days.map((d, i) => (
                          <th key={d} className={i >= 5 ? "weekend" : ""}>
                            <span>
                              {
                                [
                                  "MON",
                                  "TUE",
                                  "WED",
                                  "THU",
                                  "FRI",
                                  "SAT",
                                  "SUN",
                                ][i]
                              }
                            </span>
                            <b>{new Date(d + "T12:00:00").getDate()}</b>
                          </th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((e) => (
                        <tr key={e.id}>
                          <th>
                            <div className="employee-identity">
                              <span
                                className={`avatar color-${departments.indexOf(e.department)}`}
                              >
                                {e.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              <div>
                                {e.name}
                                <small>{e.department}</small>
                              </div>
                            </div>
                          </th>
                          {days.map((d, i) => {
                            const cell = shifts.filter(
                              (s) => s.employeeId === e.id && s.date === d,
                            );
                            return (
                              <td key={d} className={i >= 5 ? "weekend" : ""}>
                                {cell.map((s) => (
                                  <button
                                    key={s.id}
                                    className={`shift dep-${departments.indexOf(e.department)} ${conflicts.includes(s) ? "conflict" : ""}`}
                                    onClick={() =>
                                      open({ kind: "shift", value: s })
                                    }
                                  >
                                    <b>
                                      {s.start} – {s.end}
                                    </b>
                                    <span>
                                      {hours(s)} hrs{" "}
                                      {conflicts.includes(s) && "· Conflict"}
                                    </span>
                                  </button>
                                ))}
                                <button
                                  className={`add-cell ${cell.length ? "has-shifts" : ""}`}
                                  aria-label={`Add shift for ${e.name} on ${d}`}
                                  onClick={() => newShift(e.id, d)}
                                >
                                  {cell.length ? (
                                    <Plus size={12} />
                                  ) : (
                                    <span>＋</span>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                          <td className="hours-total">
                            <b
                              className={
                                employeeHours(e.id, shifts) > e.maxHours
                                  ? "red"
                                  : ""
                              }
                            >
                              {employeeHours(e.id, shifts)}h
                            </b>
                            <small>/ {e.maxHours}h max</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!employees.length && (
                    <div className="empty">
                      No team members found. Add an employee or adjust your
                      filters.
                    </div>
                  )}
                </div>
                <div className="roster-footer">
                  <div className="legend">
                    {departments.map((d, i) => (
                      <span key={d}>
                        <i className={`dot-${i}`} />
                        {d}
                      </span>
                    ))}
                  </div>
                  <span>Click a shift to edit · + to add</span>
                </div>
              </section>
              <div className="bottom-grid">
                <section className="insight">
                  <div className="insight-icon">
                    <TriangleAlert size={20} />
                  </div>
                  <div>
                    <h3>
                      Coverage & scheduling checks{" "}
                      <span className="pill amber">
                        {gaps.length + conflicts.length + over.length} alerts
                      </span>
                    </h3>
                    <p>
                      Minimum coverage checked from {data.settings.open} to{" "}
                      {data.settings.close}, every day.
                    </p>
                    <div className="warnings">
                      {conflicts.length > 0 && (
                        <p className="red">
                          {conflicts.length} shifts overlap. Open the marked
                          shifts to resolve.
                        </p>
                      )}
                      {over.map((e) => (
                        <p className="red" key={e.id}>
                          {e.name} exceeds their weekly maximum.
                        </p>
                      ))}
                      {gaps.length ? (
                        <>
                          <p>
                            Below minimum staffing:{" "}
                            {gaps.slice(0, 5).join(" · ")}
                            {gaps.length > 5
                              ? ` · +${gaps.length - 5} more`
                              : ""}
                          </p>
                          <button
                            className="text-button"
                            onClick={() => setPage("Settings")}
                          >
                            Review staffing requirements →
                          </button>
                        </>
                      ) : (
                        <p className="green">
                          Minimum staffing covered throughout opening hours.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
                <section className="planning-note">
                  <span className="eyebrow">PLAN WITH CONFIDENCE</span>
                  <h3>A clearer view of your labour.</h3>
                  <p>
                    Costs are planning estimates only. They exclude breaks,
                    overtime, penalties, tax and benefits.
                  </p>
                  <span>
                    <Check size={14} /> Fictional demo data only
                  </span>
                </section>
              </div>
            </>
          )}
          {page === "Employees" && (
            <section className="employee-grid">
              {data.employees.map((e) => (
                <button
                  className="employee-card"
                  key={e.id}
                  onClick={() => open({ kind: "employee", value: e })}
                >
                  <span
                    className={`avatar color-${departments.indexOf(e.department)}`}
                  >
                    {e.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <h2>{e.name}</h2>
                  <p>{e.department}</p>
                  <div>
                    <span>
                      {money(e.rate)}/hr<small>Estimated rate</small>
                    </span>
                    <span>
                      {e.maxHours} hrs<small>Weekly maximum</small>
                    </span>
                  </div>
                  <span className="text-button">Edit employee →</span>
                </button>
              ))}
            </section>
          )}
          {page === "Settings" && (
            <section className="settings-panel">
              <h2>Planning preferences</h2>
              <p>
                Coverage applies to every day, including weekends. Set a minimum
                to zero to disable that department's warning.
              </p>
              <dl>
                <dt>Weekly budget</dt>
                <dd>{money(data.settings.budget)} AUD</dd>
                <dt>Opening hours</dt>
                <dd>
                  {data.settings.open} – {data.settings.close}
                </dd>
                {departments.map((d) => (
                  <div key={d}>
                    <dt>{d}</dt>
                    <dd>
                      {data.settings.minimums[d]} minimum concurrent staff
                    </dd>
                  </div>
                ))}
              </dl>
              <button
                className="button primary"
                onClick={() => open({ kind: "settings" })}
              >
                Edit preferences
              </button>
            </section>
          )}
          <footer className="page-footer">
            <span>
              ShiftWise <b>v0.1</b>
            </span>
            <span>Thoughtful schedules. Better workdays.</span>
            <span>Demo workspace · Local only</span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setEditor(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setEditor(null);
        }}
      >
        {editor && (
          <form
            onSubmit={save}
            key={editor.kind === "settings" ? "settings" : editor.value.id}
          >
            <div className="modal-heading">
              <h2>
                {editor.kind === "settings"
                  ? "Planning preferences"
                  : editor.kind === "shift"
                    ? "Shift details"
                    : "Employee details"}
              </h2>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setEditor(null)}
              >
                <X size={20} />
              </button>
            </div>
            {editor.kind === "shift" ? (
              <>
                <label>
                  Employee
                  <select
                    name="employeeId"
                    defaultValue={editor.value.employeeId}
                  >
                    {data.employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={editor.value.date}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Start
                    <input
                      type="time"
                      name="start"
                      required
                      defaultValue={editor.value.start}
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="time"
                      name="end"
                      required
                      defaultValue={editor.value.end}
                    />
                  </label>
                </div>
                <p className="form-help">
                  Same-day shifts only. Overlaps are saved and flagged for
                  review.
                </p>
              </>
            ) : editor.kind === "employee" ? (
              <>
                <label>
                  Full name
                  <input
                    name="name"
                    maxLength={60}
                    required
                    defaultValue={editor.value.name}
                  />
                </label>
                <label>
                  Department
                  <select
                    name="department"
                    defaultValue={editor.value.department}
                  >
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <div className="form-row">
                  <label>
                    Hourly rate (AUD)
                    <input
                      name="rate"
                      type="number"
                      min="0"
                      max="10000"
                      step="0.01"
                      required
                      defaultValue={editor.value.rate}
                    />
                  </label>
                  <label>
                    Maximum weekly hours
                    <input
                      name="maxHours"
                      type="number"
                      min="0.5"
                      max="168"
                      step="0.5"
                      required
                      defaultValue={editor.value.maxHours}
                    />
                  </label>
                </div>
                <p className="form-help">
                  Use fictional details only. Rate changes update all cost
                  estimates.
                </p>
              </>
            ) : (
              <>
                <label>
                  Weekly budget (AUD)
                  <input
                    type="number"
                    name="budget"
                    min="0"
                    max="10000000"
                    step="0.01"
                    required
                    defaultValue={data.settings.budget}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Opens
                    <input
                      type="time"
                      name="open"
                      required
                      defaultValue={data.settings.open}
                    />
                  </label>
                  <label>
                    Closes
                    <input
                      type="time"
                      name="close"
                      required
                      defaultValue={data.settings.close}
                    />
                  </label>
                </div>
                {departments.map((d) => (
                  <label key={d}>
                    {d} · minimum staff
                    <input
                      type="number"
                      name={d}
                      min="0"
                      max="100"
                      step="1"
                      required
                      defaultValue={data.settings.minimums[d]}
                    />
                  </label>
                ))}
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {editor.kind !== "settings" &&
                (editor.kind === "shift" ? data.shifts : data.employees).some(
                  (x) => x.id === editor.value.id,
                ) && (
                  <button
                    className="button danger"
                    type="button"
                    onClick={remove}
                  >
                    Delete
                  </button>
                )}
              <button
                className="button"
                type="button"
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                Save changes
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
