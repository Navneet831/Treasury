NO mock Data should have fetch all the data from the DB only.
I want to see LC limits available, LC, SBLC, and cash. Total current NFB limit, FB limit, utilisation, (LC outstanding, LC in process) total LC exposure, SBLC utilisation,  (SBLC outstanding), Available balance, (existing balance - LC outstanding), limit utilisation %, working capital frozen in FD, bank wise, margin wise bifurcation. BOE status wise bifurcation, Outstanding payables, total unpaid bills, hedged vs unhedged bifurcation. in calendar show the payment to be made in each respective date. when select the bank wise, instrument wise outstanding and paid in the calendar, instead of mentioning in the calendar open and close with each transaction mention amount only in the calendar as it clearly visible and colour indicates its status. and bank wise and other relevant filter on the very top of the calendar. also want the daily Reco. of LC opening, Closing , open and closed in each respective day. show all the data as its presentable and insightful and actionable.

Run the app, and add a .bat to run the app also it should show the URL where the app is running. fix the bug if any, and also implement the

&#x20;  requirement in the gemini.md. anything which is less significant don't show that in the KPI, and can show some relevant as micro KPIs.

&#x20;  presentation insights based on the insights importance and hierarchy exposure, trend \& cohort, Limit utilisation should tab is blank currently

&#x20;  fix the same. and i want each tab to be modular and sandboxed when even if i delete the one tab folder from the code it will just remove the

&#x20;  feature from the app, as it was never there, each tab should be sandboxed. export to CSV button is dead and not working. remove the word CFO

&#x20;  from the decision box, in each tab also sandbox the each insights deleting one element from the tab will have no effect on the whole tab, or

&#x20;  app.

NO MOCK DATA AT ANY COST, in calendar command it says due, opened no need to mention this every time, this is to be indicative with the colours.
every assumption Skills, and methodologies will have to save in the skill.md and that skill.md will be used as the user verification tool and audit to understand each element how derived in the app. 

First make each tab, sandboxed in separate and then sandbox each sub element in each tab.
i want Micro-frontend + domain isolation architecture. Monorepo, Each section of the page should responsible for its own data, its own load, its own error, its own loading state.


Also i want Architecture map document, mermaid diagram, call graph, folder responsibility map, dependency graph. add agentation (npm install agentation), load Claude mem, graphipyy, claude graph.Search should be elastic search if any.


Can refer this DB schema for you reference.

Microsoft Windows \[Version 10.0.26200.8524]

(c) Microsoft Corporation. All rights reserved.



C:\\Users\\navneet.chaudhary>"D:\\GrewAnalytics\\duckdb.exe" "D:\\GrewAnalytics\\warehouse.duckdb"

DuckDB v1.5.2 (Variegata)

Enter ".help" for usage hints.

warehouse D show tables;

┌──────────────────────────┐

│           name           │

│         varchar          │

├──────────────────────────┤

│ APP\_CONFIG               │

│ Bank\_Guarantee           │

│ CAPITAL\_STACK            │

│ COOIS                    │

│ DD                       │

│ DEBT\_MATURITY            │

│ FDR\_List                 │

│ FX\_RATES                 │

│ J3                       │

│ LC                       │

│ Mb51                     │

│ Mb5b                     │

│ SBLC                     │

│ SYSTEM\_METADATA          │

│ TREASURY\_INSIGHTS        │

│ YIELD\_CURVE              │

│ mb5bd                    │

│ meta\_industry\_benchmarks │

│ meta\_risk\_thresholds     │

│ revenue                  │

│ salesgl                  │

│ supplier\_Bank\_Guarantee  │

└──────────────────────────┘

&#x20;         22 rows

warehouse D describe LC;

┌────────────────────────────────────────────────────────────────────────────────────────────────────┐

│                                                 LC                                                 │

│                                                                                                    │

│ Sr No                                   bigint     PO NO                                   varchar │

│ LC no.                                  varchar    LC Op. Date                             date    │

│ Bank Name                               varchar    Margin                                  double  │

│ Supplier Name                           varchar    Currency                                varchar │

│ LC Amt without Tolerance                double     Tolerance Amt /Reduction Amt            double  │

│ Final LC Amt (in FC)                    double     RATE                                    double  │

│ LC Amt (in INR)                         double     Type                                    varchar │

│ USANCE NO OF DAYS                       bigint     DOCUMENTS RECEIVED                      varchar │

│ Bill Invoice No                         varchar    Bill Lodge date                         date    │

│ Bill Acceptance date                    date       Shipment Date for LC due date           date    │

│ BOE Bill Amt (in FC)                    double     Pending BOE Amt (in FC)                 double  │

│ BOE Bill Amt (in INR)                   double     Pending BOE Amt (in INR)                double  │

│ LC Payment Due Date                     date       Limit Available date                    varchar │

│ LC Limit Available                      double     Material Receipt Date                   date    │

│ LC Payment Due Month                    varchar    BOE Status/LC OUTSTANDING               varchar │

│ Payment Status                          varchar    BOE Status                              varchar │

│ LC Close date                           date       LC Status                               varchar │

│ SBLC Status                             varchar    FD Number                               bigint  │

│ Margin FD Made                          double     LC SHIPMENT DATE                        date    │

│ LC EXPIRY DATE                          date       Bill of Entry No.                       varchar │

│ Date of Bill of Entry Submitted to Bank date       Product Name                            varchar │

└────────────────────────────────────────────────────────────────────────────────────────────────────┘

warehouse D describe FDR list;

Parser Error:

syntax error at or near "list"



LINE 1: describe FDR list;

&#x20;                    ^

warehouse D describe FDR\_List;

┌──────────────────────────────────────────────────────────────────────┐

│                               FDR\_List                               │

│                                                                      │

│ SR NO                    varchar    Bank Name                varchar │

│ Opening date             varchar    FD Account Number        varchar │

│ LC/BG/COLLETRAL          varchar    MARGIN                   varchar │

│ PARTY NAME               varchar    TYPE                     varchar │

│ DESCRIPTION              varchar    Original  Principal Rate varchar │

│ OLD MATURITY AMT         varchar    FD LIEN AMT for LC/BG    varchar │

│ New Prin. Amt            varchar    Int. Amt                 varchar │

│ New Maturity Amt.        varchar    Maturity Period          varchar │

│ Maturity Date            varchar    New Deposit Value        varchar │

│ New Maturity Value       varchar    New Maturity Date        varchar │

│ New Interest Rates       varchar    FINAL FD  AMT            varchar │

│ STATUS                   varchar    Account Type             varchar │

│ Unnamed: 24              varchar    Unnamed: 25              varchar │

└──────────────────────────────────────────────────────────────────────┘

warehouse D describe Bank\_Guarantee;

┌─────────────────────────┐

│     Bank\_Guarantee      │

│                         │

│ Sr.no           varchar │

│ Bank Name       varchar │

│ Supplier        varchar │

│ BG no.          varchar │

│ Type            varchar │

│ Amt.            varchar │

│ Tag             varchar │

│ Date of opening varchar │

│ Date of expiry  varchar │

│ FD No           varchar │

│ FD Lien Amt     varchar │

│ FD Amt          varchar │

│ status          varchar │

│ Unnamed: 13     varchar │

│ Unnamed: 14     varchar │

└─────────────────────────┘

warehouse D describe SBLC;

┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐

│                                                 SBLC                                                 │

│                                                                                                      │

│ SBLC REF NO                         varchar         BANK                                varchar      │

│ SBLC ISSUE DATE                     timestamp\_ns    PO NO                               bigint       │

│  LC no.                             varchar         BILL REF NO                         varchar      │

│ LC Op. Date                         timestamp\_ns    Percentage                          double       │

│ Supplier Name                       varchar         Currency                            varchar      │

│ DOCUMENTS RECEIVED                  varchar         Bill Invoice No                     varchar      │

│ Bill Lodge date                     timestamp\_ns    Bill Acceptance date                timestamp\_ns │

│ SBLC Bill Amt

(in FC)                             double          Rate                                double       │

│ BOE Bill Amt

(in INR)                            double          SBLC LC Payment Due Date            timestamp\_ns │

│ MONTH                               varchar         Payment Status                      varchar      │

│ Notional Int Amt (USD)              double          Final Int Amt (USD)                 double       │

│ PAYMENT AMT \[USD] BILL AMT +INT AMT double          Final PAYMENT AMT INR               double       │

│ FD NO                               double          LIEN AMT                            varchar      │

│ FD NO.1                             varchar         LIEN AMT.1                          double       │

│ FD NO.2                             varchar         LIEN AMT.2                          double       │

│ Unnamed: 30                         double          Unnamed: 31                         double       │

│ Unnamed: 32                         double          Unnamed: 33                         double       │

└──────────────────────────────────────────────────────────────────────────────────────────────────────┘

warehouse D Describe supplier\_Bank\_Guarantee;

┌─────────────────────────┐

│ supplier\_Bank\_Guarantee │

│                         │

│ Sr.no           varchar │

│ Supplier        varchar │

│ Type            varchar │

│ Bank            varchar │

│ Amt.            varchar │

│ Date of opening varchar │

│ Date of expiry  varchar │

│ PO NO           varchar │

│ Unnamed: 8      varchar │

└─────────────────────────┘

warehouse D describe CAPITAL\_STACK;

┌───────────────────┐

│   CAPITAL\_STACK   │

│                   │

│ component varchar │

│ amount\_cr double  │

└───────────────────┘

warehouse D

