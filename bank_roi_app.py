import streamlit as st
import pandas as pd
import psycopg2
from psycopg2 import OperationalError, InterfaceError
from datetime import datetime, timedelta
import calendar
import time

# Page config
st.set_page_config(page_title="Bank Statement ROI Analysis", layout="wide")
st.title("Bank Statement ROI Analysis")
st.markdown("---")

# Database connection
DB_CONFIG = {
    "host": "80.225.203.238",
    "port": 5432,
    "user": "navneet",
    "password": "Navn@98765",
    "dbname": "Grewdb"
}

MAX_RETRIES = 3
RETRY_DELAY = 2


# ── DB Connection ────────────────────────────────────────────────────────────

def is_connection_alive(conn):
    if conn is None or conn.closed:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return True
    except (OperationalError, InterfaceError):
        return False

@st.cache_resource
def get_connection():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    return conn

def get_fresh_connection():
    get_connection.clear()
    return get_connection()

def execute_query_with_retry(query, params=None, retries=MAX_RETRIES):
    last_error = None
    for attempt in range(retries):
        try:
            conn = get_connection()
            if not is_connection_alive(conn):
                conn = get_fresh_connection()
            df = pd.read_sql(query, conn, params=params)
            return df
        except (OperationalError, InterfaceError) as e:
            last_error = e
            get_connection.clear()
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
            continue
        except Exception as e:
            last_error = e
            raise
    raise ConnectionError(
        f"Database connection failed after {retries} attempts. "
        f"Last error: {last_error}"
    )


# ── Dynamic Month Discovery from DB ─────────────────────────────────────────

def make_month_key(dt):
    """Create 'apr_24' style key from a datetime."""
    return dt.strftime("%b_%y").lower()

def make_month_label(dt):
    """Create 'Apr-24' style label from a datetime."""
    return dt.strftime("%b-%y").capitalize()

def month_key_to_date(mk):
    """Convert 'apr_24' back to first-of-month datetime."""
    return datetime.strptime(mk, "%b_%y")

def days_in_month_for_key(mk):
    """Compute actual calendar days from the month key."""
    dt = month_key_to_date(mk)
    return calendar.monthrange(dt.year, dt.month)[1]

def get_fy_label(mk):
    """Indian FY label: Apr-xx to Mar-xx+1 => '20xx-xx+1'. E.g. apr_24 => '2024-25'."""
    dt = month_key_to_date(mk)
    if dt.month >= 4:
        return f"{dt.year}-{dt.year + 1 - 2000:02d}"
    else:
        return f"{dt.year - 1}-{dt.year - 2000:02d}"

def month_sort_key(mk):
    """Sort key for month keys — returns (year, month)."""
    dt = month_key_to_date(mk)
    return (dt.year, dt.month)


@st.cache_data(ttl=600)
def discover_month_range():
    """
    Query all bank statement tables, parse all dates in Python,
    then generate the full ordered list of month keys.
    """
    # Get list of bank statement tables (numeric names or starting with 4)
    tables_query = """
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND (tablename ~ '^[0-9]{6,}' OR tablename ~ '^4[0-9]{5,}')
    """
    tables_df = execute_query_with_retry(tables_query)
    table_names = tables_df["tablename"].tolist()

    if not table_names:
        return [], {}, {}

    # UNION ALL to get all dates across ALL tables
    union_parts = []
    for t in table_names:
        union_parts.append(f'SELECT DISTINCT txn_date as d FROM "{t}"')
    union_sql = " UNION ALL ".join(union_parts)
    dates_query = f"SELECT DISTINCT d FROM ({union_sql}) all_dates"
    dates_df = execute_query_with_retry(dates_query)

    # Parse all dates in Python (handles mixed formats)
    parsed_dates = []
    for val in dates_df["d"].dropna():
        dt = parse_date_any(val)
        if dt is not None:
            parsed_dates.append(dt)

    if not parsed_dates:
        return [], {}, {}

    min_dt = min(parsed_dates)
    max_dt = max(parsed_dates)

    # Generate all month keys from min to max
    months_order = []
    month_ranges = {}
    month_labels = {}

    current = min_dt.replace(day=1)
    end = max_dt

    while current <= end:
        mk = make_month_key(current)
        dt_last = calendar.monthrange(current.year, current.month)[1]
        month_start = current.replace(day=1)
        month_end = current.replace(day=dt_last)

        if mk not in month_ranges:
            months_order.append(mk)
            month_ranges[mk] = (month_start.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d"))
            month_labels[mk] = make_month_label(current)

        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1, day=1)
        else:
            current = current.replace(month=current.month + 1, day=1)

    return months_order, month_labels, month_ranges


def parse_date_any(date_str):
    """Parse dates in any common format."""
    if pd.isna(date_str) or date_str is None or str(date_str).strip() == '':
        return None
    date_str = str(date_str).strip()
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


# ── Data Loading ─────────────────────────────────────────────────────────────

@st.cache_data(ttl=600)
def load_bank_summary():
    query = """
        SELECT account_no, table_type, bank_name, description, name, roi
        FROM Bank_summary
        ORDER BY table_type, account_no
    """
    try:
        return execute_query_with_retry(query)
    except Exception as e:
        st.error(f"Failed to load Bank Summary: {e}")
        st.info("Check that the database server at 80.225.203.238 is running and accessible.")
        return pd.DataFrame()


@st.cache_data(ttl=600)
def load_statement_data(account_no):
    table_candidates = [f'"{account_no}"']
    if account_no.startswith("000000"):
        stripped = account_no.lstrip("0")
        if stripped:
            table_candidates.append(f'"{stripped}"')
    if not account_no.startswith("000000"):
        padded = account_no.zfill(15)
        table_candidates.append(f'"{padded}"')

    for table_name in table_candidates:
        try:
            query = f"""
                SELECT txn_date, value_date, description,
                       COALESCE(debit, 0) as debit,
                       COALESCE(credit, 0) as credit,
                       balance
                FROM {table_name}
                ORDER BY txn_date, value_date
            """
            df = execute_query_with_retry(query)
            if len(df) > 0:
                return df, table_name
        except ConnectionError:
            raise
        except Exception:
            continue
    return None, None


# ── Interest Logic ───────────────────────────────────────────────────────────

def parse_date_flexible(date_str):
    if pd.isna(date_str) or date_str is None or str(date_str).strip() == '':
        return None
    date_str = str(date_str).strip()
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def get_month_key(date_obj):
    """Map a date to its month key using dynamic ranges."""
    if date_obj is None:
        return None
    return make_month_key(date_obj)


def is_interest_entry(description):
    desc = str(description).upper()
    keywords = ["INTEREST", " PART PERIOD INTER", "DEBIT INTEREST",
                "INT TRF", "TL INT", "INT REP"]
    return any(kw in desc for kw in keywords)

def is_interest_charged(description):
    desc = str(description).upper()
    return any(kw in desc for kw in ["PART PERIOD INTER", "DEBIT INTEREST"])

def is_interest_recovered(description):
    desc = str(description).upper()
    return any(kw in desc for kw in ["O.S. INTEREST REP", "INT TRF FRM",
                                      "TL INT FOR", "TL INT ", "INT REP",
                                      "INTEREST RECOVERY"])


def compute_monthly_metrics(account_no, statement_df, roi_value, months_order, month_ranges):
    """Compute opening, closing, interest metrics per month dynamically."""
    if statement_df is None or len(statement_df) == 0:
        return {}

    # Build a quick lookup for month ranges
    range_lookup = {}
    for mk in months_order:
        start_str, end_str = month_ranges[mk]
        range_lookup[mk] = (datetime.strptime(start_str, "%Y-%m-%d"),
                            datetime.strptime(end_str, "%Y-%m-%d"))

    # Parse dates
    df = statement_df.copy()
    df["parsed_date"] = df["txn_date"].apply(parse_date_flexible)
    df["month_key"] = df["parsed_date"].apply(get_month_key)

    # Classify interest
    df["is_interest"] = df["description"].apply(is_interest_entry)
    df["is_interest_charged"] = df["description"].apply(is_interest_charged)
    df["is_interest_recovered"] = df["description"].apply(is_interest_recovered)

    def get_interest_month(row):
        date_obj = row["parsed_date"]
        if date_obj is None:
            return row["month_key"]
        day = date_obj.day
        if day == 1 and row.get("is_interest", False):
            prev_month = date_obj.replace(day=1) - timedelta(days=1)
            return get_month_key(prev_month)
        return row["month_key"]

    df["interest_month"] = df.apply(get_interest_month, axis=1)

    results = {}
    for mk in months_order:
        month_data = df[df["month_key"] == mk]
        if len(month_data) == 0:
            results[mk] = {
                "opening": None, "closing": None, "int_recovered": 0,
                "roi": roi_value if pd.notna(roi_value) else None, "has_data": False
            }
            continue

        int_recovered = df[
            (df["is_interest_recovered"]) &
            (df["interest_month"] == mk)
        ]["credit"].sum()

        opening = month_data.iloc[0]["balance"]
        closing = month_data.iloc[-1]["balance"]

        actual_charged = month_data[month_data["is_interest_charged"]]["debit"].sum()
        if closing is not None and actual_charged > 0:
            closing = closing + actual_charged

        results[mk] = {
            "opening": opening,
            "closing": closing,
            "int_recovered": round(int_recovered, 2),
            "roi": roi_value if pd.notna(roi_value) else None,
            "has_data": True
        }

    return results


def calculate_interest(opening_balance, roi, days_in_month=30, days_in_year=365):
    if opening_balance is None or roi is None or pd.isna(roi):
        return None
    principal = abs(opening_balance)
    rate = float(roi)
    interest = principal * rate / 100 * days_in_month / days_in_year
    return round(interest, 2)


# ── Main App ─────────────────────────────────────────────────────────────────

st.sidebar.header("Filters")

# Load Bank_summary
with st.spinner("Loading Bank Summary..."):
    summary_df = load_bank_summary()

if len(summary_df) == 0:
    st.error("No data loaded from database. Cannot continue.")
    st.info("Check that the database server at 80.225.203.238 is running and accessible.")
    st.stop()

# Discover months from DB
with st.spinner("Discovering date range from statement tables..."):
    months_order, month_labels, month_ranges = discover_month_range()

if not months_order:
    st.warning("No transaction data found in any bank statement table.")
    st.stop()

# Sidebar: Account Type filter
table_types = ["All"] + sorted(summary_df["table_type"].unique().tolist())
selected_type = st.sidebar.selectbox("Account Type", table_types)

# Sidebar: Bank filter
banks = ["All"] + sorted(summary_df["bank_name"].unique().tolist())
selected_bank = st.sidebar.selectbox("Bank", banks)

# Apply filters
filtered = summary_df.copy()
if selected_type != "All":
    filtered = filtered[filtered["table_type"] == selected_type]
if selected_bank != "All":
    filtered = filtered[filtered["bank_name"] == selected_bank]

# Sidebar: Account filter
account_options = ["All"] + sorted(filtered["account_no"].unique().tolist())
selected_account = st.sidebar.selectbox("Filter by Account No.", account_options)
if selected_account != "All":
    filtered = filtered[filtered["account_no"] == selected_account]

st.sidebar.markdown(f"**Accounts: {len(filtered)}**")

# Sidebar: FY filter (derived from months_order)
fy_list = sorted(set(get_fy_label(mk) for mk in months_order), reverse=True)
fy_options = ["All FYs"] + fy_list
selected_fy = st.sidebar.selectbox("Fiscal Year", fy_options, index=0)

if selected_fy != "All FYs":
    fy_months = [mk for mk in months_order if get_fy_label(mk) == selected_fy]
else:
    fy_months = months_order

# Sidebar: Month filter
all_months_label = "All Months"
month_display_options = [all_months_label] + [month_labels[mk] for mk in fy_months]
selected_months_display = st.sidebar.multiselect(
    "Filter by Month",
    options=month_display_options,
    default=[all_months_label],
    placeholder="Select months..."
)

if all_months_label in selected_months_display or len(selected_months_display) == 0:
    active_months = fy_months
else:
    reverse_map = {v: k for k, v in month_labels.items()}
    active_months = [reverse_map[m] for m in selected_months_display if m in reverse_map]

show_all = st.sidebar.checkbox("Show accounts without statement data", value=False)

# Sidebar: DB info
st.sidebar.markdown("---")
st.sidebar.caption(f"Months in DB: {len(months_order)}")
st.sidebar.caption(f"Date range: {month_labels[months_order[0]]} to {month_labels[months_order[-1]]}")


# ── Process ──────────────────────────────────────────────────────────────────

if st.button("Compute ROI Analysis", type="primary", use_container_width=True):
    progress_bar = st.progress(0, text="Processing accounts...")
    all_rows = []

    try:
        for idx, (_, row) in enumerate(filtered.iterrows()):
            acct = row["account_no"]
            progress_bar.progress((idx + 1) / len(filtered), text=f"Processing {acct}...")

            stmt_df, table_found = load_statement_data(acct)

            if stmt_df is None and not show_all:
                continue

            for mk in active_months:
                roi_val = row.get("roi")

                if stmt_df is not None:
                    metrics = compute_monthly_metrics(acct, stmt_df, roi_val, months_order, month_ranges)
                    m = metrics.get(mk, {})
                else:
                    m = {"opening": None, "closing": None, "int_charged": 0,
                         "int_recovered": 0, "roi": roi_val, "has_data": False}

                opening = m.get("opening")
                roi_val_m = m.get("roi")

                days = days_in_month_for_key(mk)
                int_calculated = calculate_interest(opening, roi_val_m, days)

                if int_calculated is not None and int_calculated != 0:
                    variance = round(m.get("int_recovered", 0) - int_calculated, 2)
                    variance_pct = round((variance / int_calculated) * 100, 2)
                else:
                    variance = m.get("int_recovered", 0)
                    variance_pct = 0 if m.get("int_recovered", 0) == 0 else None

                all_rows.append({
                    "Account": acct,
                    "Type": row["table_type"],
                    "Bank": row["bank_name"],
                    "Month": month_labels[mk],
                    "Opening Bal": opening,
                    "Closing Bal": m.get("closing"),
                    "ROI (%)": roi_val_m,
                    "Int Recovered": m.get("int_recovered"),
                    "Int Calculated": int_calculated,
                    "Variance": variance,
                    "Var %": variance_pct,
                    "Table Found": "Yes" if table_found else "No"
                })
    except ConnectionError as e:
        progress_bar.empty()
        st.error(f"Database connection lost: {e}")
        st.info("Click 'Compute ROI Analysis' again to retry.")
        st.stop()

    progress_bar.empty()

    if not all_rows:
        st.warning("No data found for the selected filters.")
    else:
        result_df = pd.DataFrame(all_rows)

        total_recovered = result_df["Int Recovered"].sum()
        total_calculated = result_df["Int Calculated"].sum()
        total_variance = result_df["Variance"].sum()

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Accounts", result_df["Account"].nunique())
        col2.metric("Total Int (Recovered)", f"{total_recovered:,.2f}")
        col3.metric("Total Int (Calculated)", f"{total_calculated:,.2f}")
        col4.metric("Total Variance", f"{total_variance:,.2f}", delta_color="inverse")

        st.markdown("---")

        view_mode = st.radio("View Mode",
                             ["All Rows (Month-wise)",
                              "Opening/Closing Summary",
                              "Pivot by Account (Wide)"],
                             horizontal=True)

        if view_mode == "All Rows (Month-wise)":
            display_cols = ["Account", "Type", "Bank", "Month", "Opening Bal",
                           "Closing Bal", "ROI (%)", "Int Recovered",
                           "Int Calculated", "Variance", "Var %"]
            fmt_df = result_df[display_cols].copy()

            for col in ["Opening Bal", "Closing Bal", "Int Recovered", "Int Calculated", "Variance"]:
                fmt_df[col] = fmt_df[col].apply(
                    lambda x: f"{x:,.2f}" if pd.notna(x) and x != 0 else ("-" if pd.isna(x) else f"{x:,.2f}")
                )
            fmt_df["ROI (%)"] = fmt_df["ROI (%)"].apply(
                lambda x: f"{x:.2f}%" if pd.notna(x) else "-"
            )
            fmt_df["Var %"] = fmt_df["Var %"].apply(
                lambda x: f"{x:.2f}%" if pd.notna(x) else "-"
            )
            st.dataframe(fmt_df, use_container_width=True, height=600)

        elif view_mode == "Opening/Closing Summary":
            st.subheader("Opening & Closing Balance Summary")
            all_months_in_results = sorted(result_df["Month"].unique())

            oc_data = []
            for acct in sorted(result_df["Account"].unique()):
                acct_data = result_df[result_df["Account"] == acct]
                r0 = {"Account": acct, "Type": acct_data["Type"].iloc[0], "Bank": acct_data["Bank"].iloc[0]}
                for ml in all_months_in_results:
                    m_row = acct_data[acct_data["Month"] == ml]
                    if len(m_row) > 0:
                        r = m_row.iloc[0]
                        r0[f"Open ({ml})"] = r["Opening Bal"]
                        r0[f"Close ({ml})"] = r["Closing Bal"]
                    else:
                        r0[f"Open ({ml})"] = None
                        r0[f"Close ({ml})"] = None
                oc_data.append(r0)

            oc_df = pd.DataFrame(oc_data)
            for col in oc_df.columns:
                if col not in ["Account", "Type", "Bank"]:
                    oc_df[col] = oc_df[col].apply(
                        lambda x: f"{x:,.2f}" if pd.notna(x) and x != 0 else ("-" if pd.isna(x) else f"{x:,.2f}")
                    )
            st.dataframe(oc_df, use_container_width=True, height=600)

        else:
            pivot_data = []
            for acct in result_df["Account"].unique():
                acct_data = result_df[result_df["Account"] == acct]
                rd = {"Account": acct, "Type": acct_data["Type"].iloc[0], "Bank": acct_data["Bank"].iloc[0]}
                for mk in active_months:
                    ml = month_labels[mk]
                    m_row = acct_data[acct_data["Month"] == ml]
                    if len(m_row) > 0:
                        r = m_row.iloc[0]
                        rd[f"ROI_{ml}"] = r["ROI (%)"]
                        rd[f"Open_{ml}"] = r["Opening Bal"]
                        rd[f"Close_{ml}"] = r["Closing Bal"]
                        rd[f"Int_Rec_{ml}"] = r["Int Recovered"]
                        rd[f"Int_Calc_{ml}"] = r["Int Calculated"]
                        rd[f"Var_{ml}"] = r["Variance"]
                    else:
                        for suf in ["ROI", "Open", "Close", "Int_Rec", "Int_Calc", "Var"]:
                            rd[f"{suf}_{ml}"] = None
                pivot_data.append(rd)

            pivot_df = pd.DataFrame(pivot_data)
            st.dataframe(pivot_df, use_container_width=True, height=600)

        csv = result_df.to_csv(index=False)
        st.download_button("Download CSV", csv, "bank_roi_analysis.csv", "text/csv")

        st.markdown("---")
        st.subheader("Account Details")
        selected_acct = st.selectbox("Select Account", sorted(result_df["Account"].unique()))

        if selected_acct:
            acct_detail = result_df[result_df["Account"] == selected_acct]
            stmt_df, _ = load_statement_data(selected_acct)

            col_a, col_b = st.columns(2)
            with col_a:
                st.markdown(f"**Account:** {selected_acct}")
                detail_row = acct_detail.iloc[0]
                st.markdown(f"**Type:** {detail_row['Type']} | **Bank:** {detail_row['Bank']}")
                st.dataframe(
                    acct_detail[["Month", "Opening Bal", "Closing Bal", "ROI (%)",
                                 "Int Recovered", "Int Calculated", "Variance"]],
                    use_container_width=True
                )
            with col_b:
                if stmt_df is not None and len(stmt_df) > 0:
                    st.markdown(f"**Statement Transactions ({len(stmt_df)} rows)**")
                    show_trans = stmt_df[["txn_date", "description", "debit", "credit", "balance"]].copy()
                    show_trans["debit"] = show_trans["debit"].apply(
                        lambda x: f"{x:,.2f}" if x > 0 else "-"
                    )
                    show_trans["credit"] = show_trans["credit"].apply(
                        lambda x: f"{x:,.2f}" if x > 0 else "-"
                    )
                    show_trans["balance"] = show_trans["balance"].apply(
                        lambda x: f"{x:,.2f}" if pd.notna(x) else "-"
                    )
                    st.dataframe(show_trans, use_container_width=True, height=400)
                else:
                    st.info("No statement data available for this account.")

else:
    st.info("Select filters and click **'Compute ROI Analysis'** to start.")

    with st.expander("About this App"):
        st.markdown("""
        **Data Sources:**
        - **Bank_summary** table: Account master with ROI
        - **Bank Statement tables**: Individual account transaction data (auto-discovered)

        **How it works:**
        - All months, fiscal years, and date ranges are **auto-discovered from the DB**
        - No hardcoded values — just add new `.xls` files and re-run the import script
        - Filters update automatically based on what data exists

        **Calculations:**
        - **Opening Balance**: First balance entry of the month
        - **Closing Balance**: Last balance entry of the month
        - **Interest Recovered**: Sum of credit entries labeled as interest recovery
        - **Interest Calculated**: Simple interest = |Opening Balance| x ROI% / 100 x (days/365)
        - **Variance**: Interest Recovered - Calculated Interest
        """)
