import pytest

def test_interest_summary_structure(datalogic):
    res = datalogic.get_interest_summary_data()
    assert isinstance(res, dict)
    assert {"rows", "months", "monthLabels", "fyList"} <= set(res.keys())
    assert isinstance(res["rows"], list)
    assert isinstance(res["months"], list)
    assert isinstance(res["monthLabels"], dict)
    assert isinstance(res["fyList"], list)
    
    if len(res["rows"]) > 0:
        row = res["rows"][0]
        required_keys = {
            "account", "type", "bank", "month", "monthKey", "fy",
            "openingBal", "closingBal", "roi", "intRecovered",
            "intCalculated", "variance", "variancePct", "tableFound", "tableName"
        }
        assert required_keys <= set(row.keys())

def test_interest_summary_filter_fy(datalogic):
    res = datalogic.get_interest_summary_data()
    if res["fyList"]:
        selected_fy = res["fyList"][0]
        filtered_res = datalogic.get_interest_summary_data(fy=selected_fy)
        assert isinstance(filtered_res, dict)
        assert len(filtered_res["rows"]) > 0
        for r in filtered_res["rows"]:
            assert r["fy"] == selected_fy

def test_closing_balance_excludes_interest(datalogic):
    res = datalogic.get_interest_summary_data()
    for row in res["rows"]:
        account = row["account"]
        month_key = row["monthKey"]
        tbl_name = row["tableName"]
        if not tbl_name:
            continue
        
        # Query raw table to find last transaction balance of this month
        from apps.Treasury.backend.database import fetch_dict
        from apps.Treasury.backend.services.interest import parse_date_flexible
        stmt_rows = fetch_dict(f'SELECT txn_date, description, COALESCE(debit, 0) as debit, COALESCE(credit, 0) as credit, balance FROM "{tbl_name}"')
        
        # Filter statement rows for this month
        from datetime import datetime
        month_dt = datetime.strptime(month_key, "%b_%y")
        month_rows = []
        for r in stmt_rows:
            parsed_d = parse_date_flexible(r["txn_date"])
            if parsed_d and parsed_d.year == month_dt.year and parsed_d.month == month_dt.month:
                month_rows.append(r)
                
        if not month_rows:
            continue
            
        # Sort by date
        month_rows.sort(key=lambda x: parse_date_flexible(x["txn_date"]))
        raw_closing = float(month_rows[-1]["balance"])
        
        # Calculate interest effect for this month
        from apps.Treasury.backend.services.interest import is_interest_charged, is_interest_recovered
        actual_charged = sum(float(r["debit"] or 0) for r in month_rows if is_interest_charged(r["description"]))
        actual_recovered = sum(float(r["credit"] or 0) for r in month_rows if is_interest_recovered(r["description"]))
        
        adjusted_closing = raw_closing + actual_charged
        assert abs(row["closingBal"] - adjusted_closing) < 1e-2

def test_closing_bal_matches_calc_breakdown(datalogic):
    """Verify closingBal == adjustedClosingBal (excludes interest effect)"""
    res = datalogic.get_interest_summary_data()
    mismatches = []
    for row in res["rows"]:
        cb = row.get("calcBreakdown")
        if not cb or cb.get("adjustedClosingBal") is None:
            continue
        expected = cb["adjustedClosingBal"]
        actual = row["closingBal"]
        if abs(actual - expected) > 1e-2:
            mismatches.append(f"{row['account']} {row['monthKey']}: closingBal={actual} != adjustedClosingBal={expected}")
    assert not mismatches, "\n".join(mismatches)

