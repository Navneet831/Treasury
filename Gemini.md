Headers:

How would you make a dashboard for these?



I need to know the LC by date wise Status of the LC, how many values of LC open each day in which bank, with inr and USD toggle view., LC status etc.

what else you think a dashboard should have?



User should be able to see the Calendar view of the data, each day net value when clicked it shows open close further shows further details when clicked.

# LC Analytics Command Center



\## Objective



Build an enterprise-grade Letter of Credit (LC) Analytics Platform for Treasury, Finance, Procurement, Supply Chain, and CFO users.



The platform must provide complete visibility into:



\* Open LC exposure

\* Bank-wise utilization

\* Upcoming payment obligations

\* BOE status

\* Shipment tracking

\* Supplier exposure

\* LC lifecycle monitoring

\* Cash forecasting

\* Exception management

\* Calendar-based operational monitoring



The application should function as a real-time Treasury Operations Command Center rather than a reporting dashboard.



\---



\# Data Source

DuckDB, Postgres



\# Available Fields



Sr No



PO NO



LC no.



LC Op. Date



Bank Name



Margin



Supplier Name



Currency



LC Amt without Tolerance



Tolerance Amt / Reduction Amt



Final LC Amt (in FC)



RATE



LC Amt (in INR)



Type



USANCE NO OF DAYS



DOCUMENTS RECEIVED



Bill Invoice No



Bill Lodge date



Bill Acceptance date



Shipment Date for LC due date



BOE Bill Amt (in FC)



Pending BOE Amt (in FC)



BOE Bill Amt (in INR)



Pending BOE Amt (in INR)



LC Payment Due Date



Limit Available date



LC Limit Available



Material Receipt Date



LC Payment Due Month



BOE Status / LC OUTSTANDING



Payment Status



BOE Status



LC Close date



LC Status



SBLC Status



FD Number



Margin FD Made



LC SHIPMENT DATE



LC EXPIRY DATE



Bill of Entry No.



Date of Bill of Entry Submitted to Bank



Product Name



\---



\# Currency Toggle



Global Currency Selector



Options:



\* INR

\* FC



Every KPI, chart, table, and metric must automatically update based on selected currency.



The toggle should persist across all pages.







\# Dashboard Architecture



\## Page 1 – Executive Overview



\### KPI Cards



Open LC Value



Open LC Count



Active Banks



Active Suppliers



Upcoming Due (7 Days)



Upcoming Due (30 Days)



Overdue Payments



Pending BOE Value



Available LC Limit



Limit Utilization %



Expired LCs



LCs Closing This Month



\---



\### Executive Insights



Generate AI-powered observations.



Examples:



\* ICICI contributes 42% of total LC exposure.

\* ₹25.40 Cr payments due in next 7 days.

\* 14 LCs expiring within 30 days.

\* BOE pending value increased by 18%.



\---



\# Page 2 – Calendar Command Center



Monthly Calendar View



Each day should display:



\* LC Opened Value

\* LC Closed Value

\* Payment Due Value

\* Shipment Value



Color Rules:



Green:

No critical activity



Yellow:

Moderate value



Orange:

High value



Red:

Critical exposure



\---



\### Calendar Drill Down



Level 1



Daily Summary



\* LC Opened

\* LC Closed

\* Payment Due

\* BOE Created



Level 2



LC List



LC Number



Supplier



Bank



Amount



Status



Level 3



Full Transaction View



Display every available field.



\---



\# Page 3 – LC Lifecycle Tracker



Visual Funnel



Open LC



↓



Shipment Completed



↓



Documents Received



↓



Bill Lodged



↓



Bill Accepted



↓



Payment Due



↓



Payment Completed



↓



LC Closed



Show:



Count



Value



Average Days in Stage



Bottlenecks



\---



\# Page 4 – Cash Flow Forecast



Purpose:



Treasury Planning



Visuals:



\### Payment Timeline



Next 7 Days



Next 30 Days



Next 90 Days



Next 180 Days



\---



\### Running Cash Requirement



Cumulative payment curve.



\---



\### Monthly Forecast



Month



Expected LC Payment



Expected BOE Payment



Total Requirement



\---



\# Page 5 – Bank Exposure Analytics



Bank-wise exposure analysis.



Metrics:



Open LC Count



Open LC Value



Outstanding BOE



Utilized Limit



Available Limit



Average LC Size



\---



Visuals



Stacked Bar



Treemap



Trend Analysis



Heatmap



\---



\# Page 6 – Supplier Analytics



Supplier-wise concentration analysis.



Metrics:



Supplier Exposure



Open LC Count



Pending BOE



Average Payment Cycle



Average Shipment Delay



\---



Visuals



Top Suppliers



Pareto Analysis



Supplier Dependency Chart



\---



\# Page 7 – BOE Monitoring



Metrics



Pending BOE



Accepted BOE



Overdue BOE



Paid BOE



\---



Aging Buckets



0–30 Days



31–60 Days



61–90 Days



90+ Days



\---



Visuals



Heatmap



Aging Waterfall



Monthly Trend



\---



\# Page 8 – Shipment Monitoring



Using:



LC SHIPMENT DATE



Material Receipt Date



LC EXPIRY DATE



\---



Metrics



Shipment Pending



Shipment Completed



Shipment Delayed



Expired Shipment



LC Near Expiry



\---



Rules



Shipment Delay



Material Receipt Date > Shipment Date



LC Expiry Risk



Expiry Date within next 15 days



\---



\# Page 9 – Limit Utilization



Metrics



Available Limit



Used Limit



Blocked Limit



Remaining Capacity



Utilization %



\---



Bank-wise Utilization



Visuals



Progress Bars



Gauge Charts



Trend Charts



\---



\# Page 10 – Risk \& Alerts Center



Generate alerts automatically.



High Priority



LC expiring within 15 days



Payment due within 7 days



BOE overdue



Limit utilization above 90%



Shipment delayed



FD pending



\---



Medium Priority



LC inactive for 30+ days



Document pending



Supplier concentration risk



\---



Low Priority



Information notices



\---



\# Advanced Analytics



\## Aging Analysis



LC Age



0-30



31-60



61-90



90+



\---



\## Cohort Analysis



Track LC performance by opening month.



\---



\## Trend Analysis



Monthly LC Opening Trend



Monthly Closure Trend



Monthly Exposure Trend



\---



\## Variance Analysis



Planned Payment



Actual Payment



Variance



Variance %



\---



\# Search \& Filters



Global Search



Search by:



LC Number



PO Number



Supplier



Bank



Invoice Number



BOE Number



FD Number



Product



\---



Global Filters



Date Range



Bank



Supplier



Currency



LC Status



BOE Status



Payment Status



Product



Type



\---



\# Tables



All tables must support:



Column Sorting



Column Filtering



Column Reordering



Export CSV



Export Excel



Export PDF



Pagination



Sticky Headers



\---



\# User Roles



Admin



Treasury



Finance



Procurement



Management



Auditor



\---



\# AI Copilot



Natural language queries.



Examples:



"Show all LCs expiring next week."



"Which bank has highest utilization?"



"How much payment is due in July?"



"Show pending BOE above ₹50 Lakhs."



"Which suppliers have delayed shipments?"



\---



\# Technology Requirements



Frontend



\* React

\* TypeScript

\* Tailwind CSS

\* ShadCN UI

\* Recharts

\* AG Grid



Backend



\* FastAPI



Database



\* PostgreSQL



Authentication



\* Role Based Access Control



Hosting



\* Docker

\* Kubernetes Ready



\---



\# Performance Requirements



Support:



100,000+ LC records



Sub-second filtering



Lazy loading



Server-side pagination



Incremental aggregation



\---



\# Success Criteria



The CFO should be able to answer within 30 seconds:



\* Total LC exposure?

\* Which bank has maximum exposure?

\* What payments are due next week?

\* Which LCs are expiring?

\* Which suppliers carry concentration risk?

\* How much limit remains available?

\* Which BOEs are overdue?

\* What is the expected cash requirement for the next 90 days?



