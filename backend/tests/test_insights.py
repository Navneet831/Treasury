"""Tests for the insights engine, FY list, and TTL cache."""
import re
import time

import pytest

PAGES = ["command", "overview", "cashflow", "fx", "operations"]
SEVERITIES = {"critical", "warning", "positive", "info"}


@pytest.mark.parametrize("page", PAGES)
def test_insights_contract(datalogic, page):
    insights = datalogic.get_page_insights(page)
    assert isinstance(insights, list) and len(insights) > 0, f"{page} must always surface at least one insight"
    for ins in insights:
        assert {"id", "severity", "headline", "detail"} <= set(ins.keys())
        assert ins["severity"] in SEVERITIES
        assert isinstance(ins["headline"], str) and ins["headline"]
        assert isinstance(ins["detail"], str) and ins["detail"]


def test_insights_unknown_page_rejected(datalogic):
    with pytest.raises(ValueError):
        datalogic.get_page_insights("nonexistent-page")


def test_fx_insight_unhedged_matches_db(datalogic, db):
    unhedged = db.execute("""
        SELECT COALESCE(SUM("LC Amt (in INR)"), 0) FROM LC
        WHERE "LC Status" = 'Open' AND "Type" = 'Unhedged' AND "Currency" != 'INR'
    """).fetchone()[0]
    open_inr = db.execute("""
        SELECT COALESCE(SUM("LC Amt (in INR)"), 0) FROM LC WHERE "LC Status" = 'Open'
    """).fetchone()[0]
    if open_inr > 0 and unhedged > 0:
        pct = unhedged / open_inr * 100
        fx_insights = datalogic.get_page_insights("fx")
        hedge_ins = [i for i in fx_insights if "unhedged" in (i["headline"] + i["detail"]).lower()]
        assert hedge_ins, "FX page must report on unhedged exposure when it exists"
        assert any(f"{pct:.0f}" in (i["headline"] + i["detail"]) or f"{pct:.1f}" in (i["headline"] + i["detail"])
                   for i in hedge_ins)


def test_command_insight_flags_high_utilization(datalogic, db):
    # Mirrors the app's business rule: utilization counts Open LCs at 10% margin only
    rows = db.execute("""
        SELECT TRIM(UPPER(bl.Element)) as bank,
               CAST(NULLIF(REPLACE(bl."LC", ',', ''), '') AS DOUBLE) as lim,
               (SELECT COALESCE(SUM("LC Amt (in INR)"), 0) FROM LC
                WHERE TRIM(UPPER("Bank Name")) = TRIM(UPPER(bl.Element))
                  AND "LC Status" = 'Open' AND Margin = 0.1) as used
        FROM bank_limit bl WHERE bl.Bank_Table = 'Bank' AND bl.Element != ''
    """).fetchall()
    hot = [b for b, lim, used in rows if lim and used / lim * 100 >= 85]
    if hot:
        insights = datalogic.get_page_insights("command")
        text = " ".join(i["headline"] + i["detail"] for i in insights)
        assert any(b.title() in text or b in text.upper() for b in hot), \
            "Banks above the utilization threshold must be named in command insights"


# ── FY list ──────────────────────────────────────────────────────────────────

def test_fy_list_derived_from_lc_dates(datalogic, db):
    fys = datalogic.get_fy_list()
    assert isinstance(fys, list) and len(fys) > 0
    assert all(re.fullmatch(r"FY\d{2}-\d{2}", f) for f in fys)

    def fy_of(d):
        y = d.year if d.month >= 4 else d.year - 1
        return f"FY{y % 100:02d}-{(y + 1) % 100:02d}"

    min_op = db.execute('SELECT MIN("LC Op. Date") FROM LC').fetchone()[0]
    max_due = db.execute(
        'SELECT MAX(COALESCE("LC Payment Due Date", "LC Op. Date")) FROM LC'
    ).fetchone()[0]
    assert fy_of(min_op) in fys
    assert fy_of(max_due) in fys
    assert fys == sorted(fys)  # chronological


# ── TTL cache ────────────────────────────────────────────────────────────────

def test_ttl_cache_serves_cached_value(datalogic):
    calls = {"n": 0}

    @datalogic.ttl_cache(seconds=60)
    def expensive(x):
        calls["n"] += 1
        return x * 2

    assert expensive(21) == 42
    assert expensive(21) == 42
    assert calls["n"] == 1, "second call must come from cache"
    assert expensive(10) == 20
    assert calls["n"] == 2, "different args must miss the cache"


def test_ttl_cache_expires(datalogic):
    calls = {"n": 0}

    @datalogic.ttl_cache(seconds=0.05)
    def expensive():
        calls["n"] += 1
        return calls["n"]

    assert expensive() == 1
    time.sleep(0.08)
    assert expensive() == 2, "expired entry must be recomputed"


# ── PE treasury removed (seeded synthetic data must not be served) ───────────

def test_pe_treasury_function_removed(datalogic):
    assert not hasattr(datalogic, "get_pe_treasury_data"), \
        "PE treasury served seeded synthetic data and must not exist"
