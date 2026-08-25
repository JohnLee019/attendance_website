# Senior Center Cafeteria Attendance (js_attendance)

A **seat-map based attendance tracker** for a senior center cafeteria (경로식당).
Staff tap seats on a tablet to mark attendance, and the records are turned into a monthly
Excel workbook that is emailed to the person in charge automatically.

- Server: Node.js + Express 5 (ESM)
- Database: PostgreSQL (Supabase)
- Frontend: plain ES modules + CSS, no build step (`public/`)
- Mail: Brevo HTTP API
- Hosting: Render (free plan)

> The UI is entirely in Korean. Korean strings quoted below (`본인 수령`, `성명`, …) are literal
> values that exist in the code or database, so they are kept as-is with an English gloss.

---

## Features

### 1. Seat map — today (`/index.html`)
- 60 seats drawn in the real cafeteria layout. Tapping a seat toggles today's attendance.
- Header shows today's date, present count / attendance rate, and the "direct delivery" count.
- **Memo mode**: leave a note on any seat; "show memos" expands them all at once.
- Toolbar: send today's Excel, send last month's report, create a seat sheet.

### 2. Monthly attendance table (`/monthAttendance.html`)
- One month of attendance as a name × day grid, with year/month pickers and search-by-name.
- Clicking a day cell jumps to **that day's seat map** (`/history.html`) to edit it there.
  Editing is deliberately not done in the grid: the cells are tiny, so a mis-tap would silently
  change the wrong person's attendance and ride along into the monthly report email.
- **Download as Excel** — produces exactly the same file that goes out by mail
  (both share `buildMonthlyWorkbook`).

### 3. Attendance history (`/history.html`)
- Pick any date to see that day's seat map, and edit it in "출석 수정" (edit attendance) mode.
- That day's Excel can also be emailed from here.

### 4. Seat sheets (`/seatSheet.html`)
A per-seat checklist kept **completely separate from attendance** — for example, handing out side dishes.

- Each sheet has its own **marks** (buttons). New sheets start with
  `본인 수령` (picked up in person, green) and `대리 수령` (picked up by proxy, purple).
- Every mark carries a color and whether it asks for a note (`needsNote`) — `대리 수령` asks who
  took it instead.
- **No mark ever writes to attendance.** Stamping, clearing, or deleting a mark leaves the
  attendance record untouched, and editing attendance leaves the sheet untouched. Attendance is
  marked only on the seat map.
- Creating a sheet with `copyAttendance` pre-fills the first mark from that day's attendance. That
  is a one-way read at creation time; the two stay independent afterwards.

> Earlier versions had a `marksAttendance` flag that let `본인 수령` also mark attendance. Pressing one
> button changed two records, which made it impossible to tell which one was authoritative, so the
> link was removed. The column is left in place on existing databases (harmless, and dropping it
> cannot be undone) and is no longer created on new ones.

### 5. Seat details (`/editSeats.html`)
- Edit the name and color (direct-delivery flag) for each seat.

### 6. Excel format (`/orderEdit.html`)
Everything that decides **what the monthly workbook looks like**, on one screen. Column layout and
name order live together because both shape the same file — split across screens, you cannot check
them in one place.

**Columns** — the name column (`성명`) and the day columns (1 … last day) are always present.

| Option | Default | Notes |
|---|---|---|
| Seat number column | off | Adds the seat number left of the name. Off by default because it is easily confused with the day-cell numbers. |
| Total days column | on | How many days each person attended that month. |
| Attendance rate column | on | Share of *operating days* (days at least one person attended). |
| Present marker | `0` | The value stamped into an attended day. One of `O` · `V` · `0` · `1`. |

- A **preview** table shows the resulting columns before you save.
- Applies to both the download in the monthly table and the automatic report on the 1st
  (the daily Excel is unaffected).
- The defaults reproduce exactly the workbook that existed before this feature — until someone
  changes them, the report looks identical.

**Name order** — drag the `≡` handle to set the order names appear in (`Person.sortOrder`).

- Newly added people are backfilled in seat-number order (`backfillPersonOrder`); an order that has
  already been set is never overwritten.
- The number on the left is the **position in the Excel file**. It belongs to the slot, so it stays
  1, 2, 3 … from the top no matter how rows are moved.
- Columns and name order have **separate save buttons** and do not affect each other.

### 7. Settings (`/settings.html`)
- Navigation cards to the other screens, report-recipient email management (add / activate / delete),
  and the seat-sheet list with delete.
- A warning banner appears when no address is active — in that state no Excel goes anywhere.

### 8. Login (`/login.html`)
- A single admin password (`ADMIN_PASSWORD`) plus an `express-session` session.
- Every path except `/login.html`, `/api/login`, and `/api/ping` requires a session; API requests get
  401 and page requests are redirected to the login screen.

---

## Automation (cron / mail)

| When | What happens |
|---|---|
| Daily 09:00 KST | Create today's attendance rows (`ensureTodayAttendanceRows`) |
| 1st of month 09:00 KST | Email last month's report (`sendMonthlyReportOnce`) |
| 2 s after server boot | **Catch-up pass** for any month the cron missed |

- Render's free plan sleeps and restarts constantly, so the monthly cron alone cannot be trusted —
  hence the boot catch-up.
- `MailLog` prevents duplicate sends. `sent | empty | baseline` count as done and are skipped;
  only `failed` is retried on the next boot.
- **One mail goes out every month even when there is no attendance data** (a notice with no
  attachment). It tells the user nothing was recorded, and it keeps the Brevo API key from expiring
  after 90 days of inactivity.
- `ensureMailLogBaseline` stamps last month as `baseline` once when the log is empty, so introducing
  the feature does not retroactively send old months.

### `/api/ping`
Called periodically by UptimeRobot. Besides waking Render, it touches the database with `SELECT 1` —
Supabase's free plan pauses a project after a week without access.
The response is sent first and the query runs behind it: waiting on a slow database would make the
ping look slow and get the server mistaken for dead. Failures are logged only.

---

## Running it

```bash
npm install
```

Create a `.env` file in the project root:

```
DATABASE_URL=postgres://...        # PostgreSQL connection string (required)
ADMIN_PASSWORD=...                 # login password (required)
SESSION_SECRET=...                 # session signing key (required)
BREVO_API_KEY=...                  # mail delivery (sending throws without it)
MAIL_FROM=sender@example.com       # sender address
PORT=3000                          # optional, defaults to 3000
NODE_ENV=production                # optional; "production" makes the session cookie secure
```

```bash
npm start
```

> ⚠️ **Running locally hits the production database.** `DATABASE_URL` points at the live database, so
> tapping a seat on a local server changes real attendance data — and the cron jobs and the boot
> catch-up run too.

---

## Layout

```
src/server/
  app.js                 Express app, routes, cron, boot catch-up
  dbInit.js              runs schema/seed/migrations exactly once (ensureDbReady)
  mailer.js              Brevo HTTP delivery, monthly/daily workbook building
  seedSeats.js           initial 60-seat layout data
  utils/date.js          KST-based date and month-range helpers
  db/
    connection.js        pg Pool (statement/query timeout 15s)
    schema.js            CREATE TABLE + migrations
    seed.js              seeds seats only when the table is empty
    seatRepo.js          seats by date
    attendanceRepo.js    attendance read/toggle/monthly rollup, name·color·memo edits
    emailRepo.js         report recipients
    mailLogRepo.js       monthly send history
    personOrderRepo.js   name order in the Excel file
    excelFormatRepo.js   monthly Excel column layout
    seatSheetRepo.js     seat sheets, marks, entries

public/
  index.html             seat map (today)
  history.html           attendance by date
  monthAttendance.html   monthly table
  seatSheet.html         seat sheet
  editSeats.html         seat details
  orderEdit.html         Excel format (columns + name order)
  settings.html          settings
  login.html             login
  index.css              all styles
  shared/
    seatLayout.js        seat block layout — single source shared by every screen
    date.js              date formatting helpers
  client/
    api.js               fetch wrappers for seats/attendance/memo
    main.js              today's screen
    history.js           by-date screen
    monthAttendance.js   monthly table, Excel download, day jump
    seatSheet.js         seat sheet screen
    seatRenderer.js      shared seat block/button rendering
    seatSearch.js        find a seat by name
    orderEdit.js         drag-to-reorder names
    excelFormat.js       column layout panel (lives inside orderEdit)
    settings.js          settings screen
    sendButton.js        shared mail-send button (locks while sending, shows the failure reason)
    toast.js             result notices (success fades, failure waits for a tap)
    login.js             login
```

---

## Database

| Table | Contents |
|---|---|
| `Person` | name, `color` (1 = direct delivery), memo, `sortOrder` (Excel order) |
| `Seat` | seat number, owning `personId`, grid coordinates (`r,c,rs,cs`) |
| `Attendance` | unique on `(date, seatId)`, `present` 0/1 |
| `ReportEmails` | report recipients, `isActive` |
| `MailLog` | `period` (YYYY-MM), `status` (sent/empty/baseline/failed), detail |
| `ExcelFormat` | monthly Excel column layout; exactly one row, `id = 1` |
| `SeatSheet` | a sheet: `title`, `sheetDate` (creation day, KST) |
| `SeatSheetMark` | per-sheet marks: `label`, `color`, `needsNote` |
| `SeatSheetEntry` | unique on `(sheetId, seatId)`; no row means "not picked up" |

The schema is applied once, when the server handles its first request, by `ensureDbReady()`
(`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + data migrations).

### Migration notes
- `migrateSheetEntriesToMarks` — moves the first version's `state` (0/1/2) onto `markId`.
  `CREATE TABLE IF NOT EXISTS` will not alter an existing table, so without this the old table keeps
  its missing `markId` column and every sheet query fails outright.
- `seedMissingSheetMarks` — fills in default marks for sheets created before marks existed.
- `backfillSheetDates` — derives `sheetDate` from `createdAt`, converted to KST, for older sheets.

---

## API

Auth: every `/api/*` route except `/api/login` and `/api/ping` needs a session (401 without one).

### Auth · health
| Method | Path | Description |
|---|---|---|
| POST | `/api/login` | `{ password }` → issues a session |
| ALL | `/api/ping` | immediate 200, database touched in the background |

### Seats · attendance
| Method | Path | Description |
|---|---|---|
| GET | `/api/seats` | today's (KST) seats + attendance |
| PATCH | `/api/seatattendance/:id` | toggle today's attendance |
| GET | `/api/attendance?date=` | seats + attendance for a date |
| PATCH | `/api/attendance` | `{ seatId, date }` toggle |
| GET | `/api/todayAttendanceStats` | total / present / direct-delivery / rate |
| GET | `/api/monthAttendance?year=&month=` | monthly attendance (current month if omitted) |
| GET | `/api/attendanceYears` | years that actually have records |
| GET | `/api/monthExcel?year=&month=` | monthly workbook as an xlsx download |

### People
| Method | Path | Description |
|---|---|---|
| PATCH | `/api/person/:id/name` | name |
| PATCH | `/api/person/:id/color` | color (direct delivery) |
| PATCH | `/api/person/:id/memo` | memo |
| GET | `/api/person-order` | name order list |
| PUT | `/api/person-order` | `{ order: [personId...] }` |

### Excel format
| Method | Path | Description |
|---|---|---|
| GET | `/api/excel-format` | current column layout |
| PUT | `/api/excel-format` | `{ showSeatNo, showTotal, showRate, presentMark }` |

### Mail
| Method | Path | Description |
|---|---|---|
| GET | `/api/report-emails` | recipient list |
| POST | `/api/report-emails` | `{ email }` |
| POST | `/api/report-emails/activate` | `{ id }` |
| DELETE | `/api/report-emails/:id` | remove |
| POST | `/api/sendTodayExcel` | email today's attendance |
| POST | `/api/sendDateExcel` | `{ date }` email that day's attendance |
| POST | `/api/sendLastMonthReport` | force-send last month's report (ignores history, still records the result) |

### Seat sheets
| Method | Path | Description |
|---|---|---|
| GET | `/api/seat-sheets` | sheet list |
| POST | `/api/seat-sheets` | `{ title, copyAttendance }` |
| GET | `/api/seat-sheets/:id` | sheet + marks + seats |
| DELETE | `/api/seat-sheets/:id` | delete |
| POST | `/api/seat-sheets/:id/marks` | `{ label, needsNote }` |
| PATCH | `/api/seat-sheets/:id/marks/:markId` | edit a mark (`color` must be `#rrggbb`) |
| DELETE | `/api/seat-sheets/:id/marks/:markId` | delete a mark (its stamped seats are cleared too) |
| PATCH | `/api/seat-sheets/:id/entry` | `{ seatId, markId, note }` — `markId: null` clears the mark |

---

## Design notes

- **Everything is KST.** Today's date, month ranges, and the cron schedules
  (`timezone: "Asia/Seoul"`) are all decided by the server. Defaults are never taken from the
  browser clock — a device in another time zone would land on the wrong month.
- **The workbook is built in one place.** The screen download and the mail attachment both call
  `buildMonthlyWorkbook`. It is a pure function, separate from the database and mail, so the layout
  can be checked without actually sending anything. The format argument defaults to
  `DEFAULT_EXCEL_FORMAT`, so a call that omits it still produces the original workbook.
- **The present marker comes from a fixed list** (`PRESENT_MARKS`). Free text would let a value
  starting with `=` become an Excel formula, and a long string would stretch one of the 31 day
  columns and wreck the table. Numeric markers (`0`, `1`) are written as numbers — as text they
  break sums and filters.
- **Seat layout lives only in `public/shared/seatLayout.js`.** It used to be copy-pasted per screen,
  where fixing one and forgetting the other was a real risk.
- **`query_timeout` is 15 s.** The heaviest measured query (monthly attendance, 1,860 rows) runs in
  30–380 ms, but at 5 s every hiccup on Supabase's free tier failed a whole screen. It is a
  circuit breaker for runaway queries, not a way to hurry slow ones along.
- **Reorder dragging does not rely on hit testing.** It used to put `pointer-events: none` on the
  dragged row and pick the row underneath with `elementFromPoint`, which also depended on pointer
  capture holding; if any one of those assumptions broke, dragging did nothing at all. It now finds
  the nearest slot from each row's `getBoundingClientRect` and listens for `pointermove`/`pointerup`
  on `window`, so the drag survives the pointer leaving the list.
- **`EADDRINUSE` is not swallowed — the process exits.** Otherwise a zombie process keeps serving
  requests with stale environment variables after a restart.
- **Korean attachment filenames** are sent via `filename*` (RFC 5987); the plain `filename=` in front
  is an ASCII fallback for browsers that cannot read it.

---

## Deployment

- **Render (free plan)** — outbound SMTP is blocked, so mail must go through the Brevo **HTTP API**.
  (`nodemailer` and `resend` are still in `package.json` as leftovers from earlier attempts.)
- **Supabase** — PostgreSQL. The free plan's one-week idle sleep is held off by the database touch
  in `/api/ping`.
- **UptimeRobot** — calls `/api/ping` on a schedule to wake the instance so the cron jobs can run.
