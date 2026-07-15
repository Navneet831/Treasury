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
