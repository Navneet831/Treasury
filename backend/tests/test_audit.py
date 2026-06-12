"""Tests for the audit catalog — the methodology register behind the Audit tab.

The catalog must be live where it can be (config values, row counts) and
complete where it's static (every tab documented, every config key explained).
"""
import pytest


@pytest.fixture(scope="module")
def catalog(datalogic):
    return datalogic.get_audit_catalog()


def test_catalog_sections(catalog):
    assert {"config", "data_sources", "conventions", "metrics"} <= set(catalog.keys())


def test_config_section_is_live_and_complete(catalog, db, datalogic):
    rows = {r[0]: r[1] for r in db.execute("SELECT key, value FROM APP_CONFIG").fetchall()}
    entries = {c["key"]: c for c in catalog["config"]}
    # Every documented default is present…
    for key in datalogic.CONFIG_DEFAULTS:
        assert key in entries, f"config key {key} missing from audit catalog"
        assert entries[key]["description"]
    # …and live DB overrides are reflected with their current values
    for key, value in rows.items():
        if key in entries:
            assert entries[key]["value"] == pytest.approx(float(value))
            assert entries[key]["overridden"] is True


def test_data_sources_row_counts_are_live(catalog, db):
    sources = {s["table"]: s for s in catalog["data_sources"]}
    assert "LC" in sources and "bank_limit" in sources
    for name, src in sources.items():
        expected = db.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        assert src["row_count"] == expected, f"{name} row count must be live"
        assert src["purpose"]


def test_metrics_cover_every_tab(catalog):
    tabs = {m["tab"] for m in catalog["metrics"]}
    assert {"Command Center", "Executive Overview", "Calendar", "Cash Flow",
            "FX & Hedging", "Operations", "Intelligence", "Insights"} <= tabs


def test_metric_entries_complete_and_unique(catalog):
    ids = [m["id"] for m in catalog["metrics"]]
    assert len(ids) == len(set(ids)), "metric ids must be unique"
    assert len(ids) >= 25, "catalog should document the app's main numbers"
    for m in catalog["metrics"]:
        for key in ("id", "name", "tab", "formula", "source"):
            assert m.get(key), f"metric {m.get('id')} missing {key}"


def test_conventions_documented(catalog):
    topics = " ".join(c["topic"].lower() for c in catalog["conventions"])
    assert "unpaid" in topics
    assert "fiscal" in topics or "fy" in topics
    for c in catalog["conventions"]:
        assert c["topic"] and c["rule"]
