"""FX domain: currency exposure and hedge coverage."""
from typing import Any, Dict

from apps.Treasury.backend.database import fetch_dict
from apps.Treasury.backend.services.core import COL_MAP, _app_config, get_fy_clause


def get_fx_risk_data(fy: str = "All") -> Dict[str, Any]:
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    threshold = _app_config()["unhedged_threshold_pct"]
    exposure = fetch_dict(f"""
        SELECT
            {COL_MAP['currency']} as currency,
            SUM({COL_MAP['amt_fc']}) as exposure_fc,
            SUM({COL_MAP['amt_inr']}) as exposure_inr,
            SUM(CASE WHEN "Type" != 'Unhedged' THEN {COL_MAP['amt_inr']} ELSE 0 END) as hedged,
            SUM(CASE WHEN "Type" = 'Unhedged' THEN {COL_MAP['amt_inr']} ELSE 0 END) as unhedged
        FROM LC
        WHERE {COL_MAP['currency']} IS NOT NULL AND {COL_MAP['currency']} != 'INR' {fy_filter}
        GROUP BY 1
    """)
    for e in exposure:
        total = (e['hedged'] or 0) + (e['unhedged'] or 0)
        e['hedge_pct'] = (e['hedged'] / total * 100) if total > 0 else 0
    total_unhedged = sum(e['unhedged'] or 0 for e in exposure)
    total_exposure = sum((e['hedged'] or 0) + (e['unhedged'] or 0) for e in exposure)
    unhedged_pct = (total_unhedged / total_exposure * 100) if total_exposure > 0 else 0
    alert = (f"Unhedged exposure is {unhedged_pct:.1f}%, which is above the {threshold:.0f}% threshold."
             if unhedged_pct > threshold else None)
    return {"exposure": exposure, "total_unhedged_pct": unhedged_pct, "alert": alert}


def get_hedge_coverage_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    ps = COL_MAP['payment_status']
    boe_inr = COL_MAP['boe_bill_inr']
    lc_inr = COL_MAP['amt_inr']
    boe_fc = COL_MAP['boe_bill_fc']
    lc_fc = COL_MAP['amt_fc']
    amt_inr = f"CASE WHEN {boe_inr} > 0 THEN {boe_inr} ELSE {lc_inr} END"
    amt_fc = f"CASE WHEN {boe_fc}  > 0 THEN {boe_fc}  ELSE {lc_fc}  END"
    rows = fetch_dict(f"""
        SELECT COALESCE(TRIM("Product Name"), 'Unknown') AS product, COALESCE("Type", 'Unknown') AS type,
            CASE WHEN COALESCE("Type",'') = 'CAPEX' THEN 'Hedged' ELSE 'Unhedged' END AS hedge_status,
            COUNT(*) AS lc_count, SUM({amt_inr}) AS unpaid_inr, SUM({amt_fc}) AS unpaid_fc, MAX(COALESCE("Currency", 'USD')) AS currency
        FROM LC WHERE ({ps} = 'Unpaid' OR {ps} IS NULL) {fy_filter} GROUP BY 1, 2, 3 HAVING SUM({amt_inr}) > 0 OR SUM({amt_fc}) > 0 ORDER BY SUM({amt_inr}) DESC
    """)
    products = [{'product': r['product'], 'type': r['type'], 'hedge_status': r['hedge_status'], 'lc_count': int(r['lc_count'] or 0),
                'unpaid_inr': round(float(r['unpaid_inr'] or 0), 2), 'unpaid_fc': round(float(r['unpaid_fc'] or 0), 2),
                'currency': r['currency'] or 'USD'} for r in rows]
    total = sum(p['unpaid_inr'] for p in products)
    hedged = sum(p['unpaid_inr'] for p in products if p['hedge_status'] == 'Hedged')
    return {'summary': {'total_unpaid': round(total, 2), 'hedged': round(hedged, 2), 'unhedged': round(total - hedged, 2),
                      'hedge_pct': round(hedged / total * 100, 1) if total > 0 else 0,
                      'unhedged_pct': round((total - hedged) / total * 100, 1) if total > 0 else 0}, 'products': products}
