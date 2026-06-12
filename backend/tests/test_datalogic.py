"""Golden-invariant tests for Treasury datalogic.

Every value the UI shows must be derivable from the warehouse. Expected values
are computed here with independent SQL so a regression to hardcoded/mock data
fails loudly.
"""
import math
from datetime import date

import pytest

AMT = '"LC Amt (in INR)"'


# ── Restored endpoint functions ──────────────────────────────────────────────

def test_banks_list_matches_distinct_lc_banks(datalogic, db):
    expected = sorted(
        r[0] for r in db.execute(
            'SELECT DISTINCT "Bank Name" FROM LC WHERE "Bank Name" IS NOT NULL'
        ).fetchall()
    )
    assert datalogic.get_banks_list() == expected


def test_cash_flow_forecast_shape_and_cumulative(datalogic):
    rows = datalogic.get_cash_flow_forecast_data("INR", "All")
    assert isinstance(rows, list) and len(rows) > 0
    required = {"month", "monthly_value", "confidence_upper", "confidence_lower", "cumulative_value"}
    running = 0.0
    for r in rows:
        assert required <= set(r.keys())
        assert r["confidence_upper"] >= r["monthly_value"] >= r["confidence_lower"] >= 0
        running += r["monthly_value"]
        assert r["cumulative_value"] == pytest.approx(running, rel=1e-6)


def test_cash_flow_forecast_totals_match_unpaid_dues(datalogic, db):
    rows = datalogic.get_cash_flow_forecast_data("INR", "All")
    expected_total = db.execute(f"""
        SELECT COALESCE(SUM(CASE WHEN "BOE Bill Amt (in INR)" > 0
                                 THEN "BOE Bill Amt (in INR)" ELSE {AMT} END), 0)
        FROM LC
        WHERE "LC Payment Due Date" >= date_trunc('month', CURRENT_DATE)
          AND ("Payment Status" IS NULL OR "Payment Status" != 'Paid')
          AND "LC Status" NOT IN ('Closed', 'Cancelled')
    """).fetchone()[0]
    assert sum(r["monthly_value"] for r in rows) == pytest.approx(expected_total, rel=1e-6)


def test_trend_analysis_contract_and_open_totals(datalogic, db):
    data = datalogic.get_trend_analysis_data("INR", "All")
    assert set(data.keys()) >= {"monthly_opening_trend", "monthly_due_trend"}
    opening = data["monthly_opening_trend"]
    assert len(opening) > 0
    for row in opening:
        assert {"month", "opened_value", "opened_count", "closed_value", "net_exposure"} <= set(row.keys())
    expected_count = db.execute(
        'SELECT COUNT(*) FROM LC WHERE "LC Op. Date" IS NOT NULL'
    ).fetchone()[0]
    assert sum(r["opened_count"] for r in opening) == expected_count
    for row in data["monthly_due_trend"]:
        assert {"month", "due_value", "due_count"} <= set(row.keys())


def test_cohort_analysis_contract_and_rates(datalogic, db):
    rows = datalogic.get_cohort_analysis_data("INR", "All")
    assert len(rows) > 0
    required = {"cohort_month", "total_lcs", "total_value", "closed_count",
                "closure_rate_pct", "paid_count", "payment_rate_pct",
                "pending_boe_value", "avg_age_days"}
    for r in rows:
        assert required <= set(r.keys())
        assert 0 <= r["closure_rate_pct"] <= 100
        assert 0 <= r["payment_rate_pct"] <= 100
    expected_count = db.execute(
        'SELECT COUNT(*) FROM LC WHERE "LC Op. Date" IS NOT NULL'
    ).fetchone()[0]
    assert sum(r["total_lcs"] for r in rows) == expected_count


def test_ai_copilot_answers_with_data(datalogic):
    res = datalogic.process_ai_query("Bank-wise unpaid totals")
    assert isinstance(res["answer"], str) and res["answer"]
    assert isinstance(res["data"], list) and len(res["data"]) > 0
    assert "bank" in res["data"][0]

    res = datalogic.process_ai_query("show unpaid bills")
    assert isinstance(res["data"], list)

    res = datalogic.process_ai_query("gibberish quark blorp")
    assert isinstance(res["answer"], str) and res["answer"]


# ── Strategic intelligence: real numbers, not mock ───────────────────────────

@pytest.fixture(scope="module")
def intel(datalogic):
    return datalogic.get_strategic_intelligence_data("INR", "All")


def test_intel_health_score_bounded(intel):
    assert 0 <= intel["health_score"] <= 100


def test_intel_remaining_limit_is_real(intel, db):
    nfb = db.execute("""
        SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("LC", ',', ''), '') AS DOUBLE)), 0)
        FROM bank_limit WHERE Bank_Table = 'Bank' AND Element != ''
    """).fetchone()[0]
    exposure = db.execute(f"""
        SELECT COALESCE(SUM({AMT}), 0) FROM LC WHERE "LC Status" IN ('Open', 'In Process')
    """).fetchone()[0]
    assert intel["remaining_limit"] == pytest.approx(max(0, nfb - exposure), rel=1e-6)


def test_intel_yield_uses_app_config(intel, db):
    yield_rate = db.execute(
        "SELECT value FROM APP_CONFIG WHERE key = 'yield_rate'"
    ).fetchone()[0]
    locked = db.execute(
        'SELECT COALESCE(SUM("Margin FD Made"), 0) FROM LC WHERE "LC Status" = \'Open\''
    ).fetchone()[0]
    yo = intel["yield_optimization"]
    assert yo["locked_fd"] == pytest.approx(locked, rel=1e-6)
    assert yo["est_yield_lost_annual"] == pytest.approx(locked * yield_rate, rel=1e-6)


def test_intel_exposes_config_rates_for_labels(intel, db):
    """UI labels must reflect the configured rates, never hardcode them."""
    fx_var = db.execute(
        "SELECT value FROM APP_CONFIG WHERE key = 'fx_var_rate'"
    ).fetchone()[0]
    yo = intel["yield_optimization"]
    assert yo["fx_var_rate_pct"] == pytest.approx(fx_var * 100, rel=1e-6)
    assert "yield_rate_pct" in yo


def test_intel_supplier_reliability_from_lc_dates(intel, db):
    pairs = db.execute("""
        SELECT COUNT(*) FROM LC
        WHERE "LC SHIPMENT DATE" IS NOT NULL
          AND "Date of Bill of Entry Submitted to Bank" IS NOT NULL
    """).fetchone()[0]
    if pairs > 0:
        assert len(intel["supplier_reliability"]) > 0
        first = intel["supplier_reliability"][0]
        assert {"supplier", "avg_delay_days", "tx_count"} <= set(first.keys())


def test_intel_bank_utilization_real(intel):
    assert len(intel["bank_utilization"]) > 0
    for b in intel["bank_utilization"]:
        assert {"bank", "used_limit", "max_limit"} <= set(b.keys())


def test_intel_quant_models_real(intel, db):
    qm = intel["quant_models"]
    expected_close = db.execute("""
        SELECT AVG(date_diff('day', "LC Op. Date", "LC Close date"))
        FROM LC WHERE "LC Close date" IS NOT NULL AND "LC Op. Date" IS NOT NULL
    """).fetchone()[0]
    assert qm["lc_closure_avg_days"] == pytest.approx(expected_close, abs=1.0)
    assert 0 <= qm["bank_dependency_risk_pct"] <= 100
    assert qm["lc_demand_forecast_30d"] >= 0
    # stress window must be a real date string when future dues exist
    future = db.execute("""
        SELECT COUNT(*) FROM LC
        WHERE "LC Payment Due Date" >= CURRENT_DATE
          AND ("Payment Status" IS NULL OR "Payment Status" != 'Paid')
    """).fetchone()[0]
    if future > 0:
        date.fromisoformat(str(qm["stress_window_start"]))
        assert qm["stress_window_val"] > 0


def test_intel_runway_positive(intel):
    assert intel["cash_runway_days"] >= 0


# ── Advanced quant: real numbers, not mock ───────────────────────────────────

@pytest.fixture(scope="module")
def quant(datalogic):
    return datalogic.get_advanced_quant_data("INR", "All")


def test_quant_lar_is_mean_plus_165_sigma(quant):
    assert quant["liquidity_at_risk"] == pytest.approx(
        quant["lar_mean"] + 1.645 * quant["lar_stddev"], rel=1e-6
    )
    assert 0 <= quant["early_warning_index"] <= 100


def test_quant_stress_tests_real(quant):
    assert len(quant["stress_tests"]) > 0
    for s in quant["stress_tests"]:
        assert {"scenario", "utilization", "stressed_exposure"} <= set(s.keys())
        assert s["utilization"] >= 0


def test_quant_network_top_bank_supplier_links(quant, db):
    links = db.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT "Bank Name", "Supplier Name" FROM LC
            WHERE "Bank Name" IS NOT NULL AND "Supplier Name" IS NOT NULL
              AND "LC Status" = 'Open'
            GROUP BY 1, 2
        )
    """).fetchone()[0]
    if links > 0:
        assert len(quant["network"]) > 0
        assert {"source", "target", "value"} <= set(quant["network"][0].keys())


# ── Radar: each axis computed, bounded ───────────────────────────────────────

def test_radar_axes_real_and_bounded(datalogic, db):
    radar = datalogic.get_treasury_radar_data("INR", "All")
    assert len(radar) == 6
    for axis in radar:
        assert {"subject", "A", "fullMark"} <= set(axis.keys())
        assert 0 <= axis["A"] <= 100
        assert axis["fullMark"] == 100
    # Limit Exhaustion axis must equal real utilization (capped at 100)
    nfb = db.execute("""
        SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("LC", ',', ''), '') AS DOUBLE)), 0)
        FROM bank_limit WHERE Bank_Table = 'Bank' AND Element != ''
    """).fetchone()[0]
    exposure = db.execute(f"""
        SELECT COALESCE(SUM({AMT}), 0) FROM LC WHERE "LC Status" IN ('Open', 'In Process')
    """).fetchone()[0]
    expected = min(100.0, exposure / nfb * 100) if nfb > 0 else 0
    exhaustion = next(a for a in radar if a["subject"] == "Limit Exhaustion")
    assert exhaustion["A"] == pytest.approx(expected, abs=0.5)


# ── Shipment tracking: delayed receipts computed ─────────────────────────────

def test_shipment_delayed_count_real(datalogic, db):
    expected = db.execute("""
        SELECT COUNT(*) FROM LC
        WHERE "Material Receipt Date" IS NOT NULL
          AND "LC SHIPMENT DATE" IS NOT NULL
          AND "Material Receipt Date" > "LC SHIPMENT DATE"
    """).fetchone()[0]
    data = datalogic.get_shipment_tracking_data("All")
    assert data["delayed_count"] == expected


# ── FY clause: dynamic, not a frozen 3-year map ──────────────────────────────

def test_fy_clause_handles_future_years(datalogic):
    clause = datalogic.get_fy_clause("FY27-28", '"LC Op. Date"')
    assert "2027-04-01" in clause and "2028-03-31" in clause
    assert datalogic.get_fy_clause("All", '"LC Op. Date"') == ""
    assert datalogic.get_fy_clause("garbage", '"LC Op. Date"') == ""
