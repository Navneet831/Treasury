When FC selected it should show all FC Wether its USD or Euro whatever is except INR, with all currency one below another.
Also the instead of bank drill down show the bank wise and show all banks one below another.
rename the tab "Payment calendar" as "Calendar", in calender i want the amount in absolute currency, not in crores or lack etc. show the absolute amount.
choose text colour other that white as the background is white already so the text should not be white either.
bank i want as Metric Card Carousel or Horizontal KPI Card Strip on top.



lc DUE DATE IS "LC Payment Due Date"
LC Opening Date is "LC Op. Date"
each LC opens again a "Bank name"
LC Payment Due Date= Shipment Date for LC due date+USANCE NO OF DAYS
Limit Available date= LC Payment Due Date+2
Margin FD Made= LC Amt (in INR)*Margin
LC Amt (in INR) =(Final LC Amt (in FC)* RATE)
LC amount : (sum of BOE amount)
Total pending BOE= sum of BOE-sum of BOE Received.
Amount to be paid is "BOE Bill Amt (in INR)"

LC status: If All respective LC's BOE Status = Received and or Cancelled then LC is closed and if it shows "not received" then LC is Open.

IF BOE received it must have the Bill "Bill Invoice No", "Bill Lodge date", "Bill Acceptance date"
Note: Single LC has many BOE each BOE need to be closed for LC to be closed.
if SBLC status yes then the LC must be closed, IF SBLC status planning: then the LC must be open.
if LC closed it must have the LC closed date.
each LC is again must have a "product name", each product name will have a "Type".
if Documents received, yes or soft copy then the Bill Invoice no. must to have.
if Documents received yes then the bill lodged date must have, bill acceptance date must have.
Each LC is against a "PO", One LC can have many "Bill Invoice No", and until the last BOE is not received the LC remain Open and vice versa.
if LC is closed the LC closed date must to have.

LC status BOE status	Payment Status
Close	  Received	Paid
Close	  Cancelled	Cancelled
Open	  Received	Unpaid
Open	  Not received	Unpaid
NA	  Not received	Paid

User want to know the LC status, BOE status, how much pending to be paid date wise, and daily Limit status. 

load claude mem, graphify, and agentation in the code.in calender the colours refrence and the actual colours user are inconsistent. is AI   copilot is the best place where it is place? also take care of neuro science and consumer psycology where each element should be placed for   maximum product utlisation satisfaction? also mention all you rules and improvment in the relavant file so it harder to reverse by the weeker   models. in calender the top has taken too much of wast space reduce the space and git it to the calender, the CFO should not have to scroll as   curently the most imporatant space is wasted. Treasury Control Tower is unprofessional word, use enterprise terminilogy.avoid all kind of  overlap always show values in crores upto two decimal. choose colours wisely.in claender also show a when and how much of FD margin expected to   get released, calender shows not just payment but how much of LC each day, how much of BOE, LC open LC closed any thing daily view of the same. you think yourself what insights you can add into it?
──────────────────────────────────────────────────────────


\## What the Final Product Really Is

Not a dashboard.
It is a \*\*Treasury Control Tower + Trade Finance Command Center\*\*.
\# 1. Executive Overview (Page 1)
This is the most important page.
\### Primary KPIs (Large Cards)
Only show:
1\. Available Cash
2\. Available LC Limit
3\. Available SBLC Limit
4\. Total NFB Limit
5\. Total FB Limit
6\. Total Utilisation %
7\. Total LC Exposure
8\. Total SBLC Exposure
9\. Working Capital Frozen in FD
10\. Hedged %
11\. Unhedged %
12\. Upcoming 30 Day Payments
Anything else becomes Micro KPI.



\# 2. LC Exposure Module



From LC table.



\### Required Metrics



\#### Exposure



```text

LC Outstanding

LC In Process

LC Closed

LC Cancelled

LC Limit Available

Total LC Exposure

```



Formula:



```text

Total LC Exposure

=

LC Outstanding

\+

LC In Process

```



\---



\### Bank Wise



SBI

IDBI

BOI

Others



Show:



```text

Bank

Limit

Utilized

Available

Utilization %

```



Heatmap.



\---



\### Margin Wise Bifurcation



Exactly like screenshot.



```text

10%

100%

110%

```



Show:



```text

Exposure

Count

Limit Consumed

```



\---



\# 3. SBLC Module



From SBLC table.



\### Metrics



```text

SBLC Outstanding

SBLC Paid

SBLC Due

SBLC Exposure

```



\---



\### Bank Wise



```text

SBI

IDBI

BOI

```



Show:



```text

Outstanding

Due in 7 Days

Due in 30 Days

```



\---



\# 4. BOE Analytics



Most dashboards miss this.



From LC + SBLC.



Exactly as screenshot.



\---



\## BOE Status Bifurcation



Show:



```text

BOE Received \& Paid

BOE Received \& Unpaid

BOE Not Received

Cancelled

```



Metrics:



```text

Count

Amount

%

```



\---



\# 5. Payables Risk Module



This should become a dedicated page.



\### Outstanding Payables



From:



```text

Pending BOE Amt (in INR)

```



and



```text

BOE Bill Amt (in INR)

```



\---



\### Categories



```text

0-7 days

8-15 days

16-30 days

30+ days

```



\---



\### Risk Flags



Red



```text

Unhedged FX exposure

```



Amber



```text

BOE not received

```



Green



```text

Paid

```



\---



\# 6. FX Risk Module



From:



```text

FX\_RATES

LC

SBLC

```



\---



\### Exposure



USD



EUR



AED



Others



\---



\### Hedged vs Unhedged



Exactly like screenshot.



Show:



```text

Currency

Exposure

Hedged

Unhedged

Hedge %

```



\---



\### Treasury Insight



```text

If unhedged > 30%



Show alert.

```



\---



\# 7. Payment Calendar (Most Important Screen)



The screenshot is correct.



The implementation should be different.



\---



\## Filters Above Calendar



```text

Bank

Instrument

Currency

Supplier

Status

```



\---



\## Calendar Events



Show only:



```text

₹ Amount

```



Do NOT show:



```text

Due

Opened

Closed

Outstanding

```



Color should indicate status.



\---



\### Colors



Red



```text

Payment Due

```



Green



```text

Paid

```



Blue



```text

LC Opened

```



Orange



```text

LC Closed

```



Purple



```text

SBLC Due

```



\---



\### Daily Reco Section



Each day show:



```text

LC Opened

LC Closed

SBLC Opened

SBLC Closed

Payments Due

Payments Completed

```



\---



\# 8. FD \& Working Capital Freeze Module



From:



```text

FDR\_List

```



\---



\### KPIs



```text

Total FD

Total FD under Lien

Working Capital Frozen

Available FD

```



\---



\### Breakdown



Bank Wise



Purpose Wise



```text

LC

BG

Collateral

```



\---



\### Maturity Analysis



7 Days



30 Days



60 Days



90 Days



\---



\# 9. BG Module



From:



```text

Bank\_Guarantee

supplier\_Bank\_Guarantee

```



\---



\### KPIs



```text

Outstanding BG

Expiring BG

FD Linked

Expired BG

```



\---



\### Alert



```text

Expiry < 30 days

```



Red flag.



\---



\# 10. Limit Utilisation Page



This page is currently blank.



Must build.



\---



\### Bank Wise



Show:



```text

Limit

Used

Available

Utilization %

```



\---



\### Exposure Waterfall



```text

Total NFB Limit



Less:

LC



Less:

SBLC



Less:

BG



=

Available Limit

```



This should be a waterfall chart.



\---



\# 11. Treasury Decision Center



Replace the current CFO wording.



Rename:



```text

Treasury Action Centre

```



\---



\### Priority Logic



Priority 1



```text

Limit Breach Risk

```



Priority 2



```text

Payment Due

```



Priority 3



```text

FD Maturity

```



Priority 4



```text

FX Exposure

```



\---



\# 12. Cohort \& Trend Analysis



You specifically requested trend/cohort.



Add:



\### Exposure Trend



```text

30 days

90 days

180 days

```



\---



\### Utilisation Trend



```text

Bank wise

```



\---



\### Margin Trend



```text

10%

100%

110%

```



\---



\### Supplier Cohort



```text

Top 10 suppliers

```



by:



```text

Exposure

Payments

Overdues

```



\---



\# 13. Micro Frontend Architecture



Gemini should build:



```text

apps/

&#x20;   treasury-dashboard



domains/

&#x20;   executive

&#x20;   lc

&#x20;   sblc

&#x20;   bg

&#x20;   fx

&#x20;   payables

&#x20;   calendar

&#x20;   fd

&#x20;   utilization



shared/

```



Each domain owns:



```text

API

UI

Queries

Charts

Insights

```



Delete domain folder = feature disappears.



Nothing else breaks.



\---



\# 14. Component Isolation



Each widget:



```text

Widget

&#x20;├ Data

&#x20;├ Error

&#x20;├ Loading

&#x20;├ Insight

```



independent.



Failure of one card must not crash page.



\---



\# 15. Documentation Gemini Must Generate



Mandatory outputs:



\### Architecture Map



```text

ARCHITECTURE.md

```



\### Mermaid



```text

architecture.mmd

```



\### Call Graph



```text

CALL\_GRAPH.md

```



\### Dependency Graph



```text

DEPENDENCY\_GRAPH.md

```



\### Folder Responsibility



```text

FOLDER\_OWNERSHIP.md

```



\### Skill Audit



```text

skill.md

```



Every KPI:



```text

Formula

Source Table

Source Column

Assumptions

Validation

```



\---



\# Final Information Hierarchy

The screenshot is already telling you the correct hierarchy:

\### Tier 1 (Top)

Executive KPIs

\### Tier 2

Exposure + Limits

\### Tier 3

Payment Calendar

\### Tier 4

BOE + Payables

\### Tier 5

FD + BG + FX

\### Tier 6

Historical Trends

If Gemini builds exactly this, it will resemble a professional treasury control tower used by large infrastructure, EPC, renewable energy, and manufacturing companies rather than a generic BI dashboard.

