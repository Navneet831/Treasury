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

