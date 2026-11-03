# ShiftWise MVP v0.1

A mobile-responsive workforce scheduling and labour planning demo built with React, TypeScript, Vite and Tailwind CSS. All demonstration people and workspace details are fictional. No backend, accounts, paid APIs, remote data services or analytics.

## Setup

Requires Node.js 20.19+ (Node 22 recommended) and npm.

```sh
npm install
npm run dev
```

Open the URL Vite prints (normally http://localhost:5173). For an iPhone on the same trusted network, use the host machine's LAN address and port. The development server listens on all interfaces.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

## Features

- Weekly employee/day roster with previous/next week navigation, department filter, name search and add/edit/delete shifts. Demo starts on 2–8 November 2026.
- Employee creation, editing and removal with departments, hourly rates and maximum weekly hours. Removing an employee removes their shifts after confirmation.
- Whole-week scheduled hours, estimated AUD labour costs and budget variance; metrics include all departments regardless of filters.
- Overlapping shifts visibly flagged for the same employee/date. Adjacent shifts are valid. Conflicts are allowed to save for planning and resolution. Weekly hours above the employee maximum also trigger warnings.
- Configurable minimum concurrent staffing per department, daily opening hours and weekly budget. Coverage checks each interval between shift boundaries, counts distinct employees and checks all seven days, including weekends. Zero disables a department requirement.
- Browser localStorage persistence with schema validation and safe demo fallback. Storage write failures show a session-only warning. Reset Demo Data restores all settings, employees and shifts after confirmation.
- CSV export of the entire selected week's roster, with quoted cells and spreadsheet formula prefix protection.
- Desktop dashboard and responsive phone layout. The weekly table scrolls horizontally on narrow screens and keeps employee names visible. Forms use native keyboard-accessible modal dialogs and labelled controls.

## Calculations and limitations

**Labour costs are estimates, not payroll calculations.** Hours equal end minus start, with fractional hours supported. Estimated cost equals scheduled hours multiplied by the employee's current hourly rate; the final total is rounded to cents. Overlapping shifts count toward hours and costs until resolved. Displayed currency totals round to whole AUD; CSV costs retain cents.

No unpaid breaks, overtime multipliers, award interpretation, penalties, leave, availability constraints, taxes, benefits or compliance guarantees. Maximum hours are warnings, not enforced restrictions. Changing an employee's rate/department updates estimates and coverage for all weeks; there is no historical rate tracking.

Only same-day shifts are supported. Split overnight work into separate dates (the time input supports up to 23:59). Dates/times are local calendar values without timezone or daylight-saving conversion. Staffing rules use the same opening hours every day; no public holiday or day-specific exceptions. Warnings summarize affected department/days rather than showing each missing interval.

Data stays in one browser/origin and is not synchronized or backed up. Clearing browser storage loses changes. Invalid saved data falls back to the demo. Do not enter real or confidential employee information. No authentication or concurrent multi-tab editing guarantees. CSV is an export, not a restorable backup.

## Review and validation

`src/domain.test.ts` covers partial/contained/equal overlaps, adjacent shifts, employee/date isolation, fractional hours, employee totals, cost rounding, intra-day coverage gaps, unique staffing counts, date boundaries, CSV escaping and persisted data validation. UI behavior can be reviewed with `npm run dev`: edit a shift into an overlap, change coverage settings, refresh to verify persistence, export a CSV and reset the demo. No deployment configuration or backend is included.

Optional browser smoke test (with `npm run dev` running in another terminal):

```sh
npx playwright install chromium
npm run test:browser
# Or use an existing Chromium installation:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

The browser check exercises shift creation/editing, overlap flags, invalid time validation, persistence after reload, employee creation, budget changes, CSV download, demo reset and a 390 × 844 iPhone viewport without page overflow. It saves local screenshots in ignored `work/`. Chromium device emulation is not a substitute for testing on physical iPhone/Safari.
