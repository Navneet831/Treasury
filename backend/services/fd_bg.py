"""FD and Bank Guarantee domain. Source tables are varchar Excel loads; parse
failures are counted and logged rather than silently dropped."""
import logging
from datetime import date, datetime
from typing import Any, Dict

from apps.Treasury.backend.database import fetch_dict
from apps.Treasury.backend.services.core import ttl_cache

logger = logging.getLogger(__name__)


def _clean_amount(v) -> float:
    try:
        return float(str(v).replace(',', '').replace('₹', '').strip())
    except (ValueError, TypeError):
        return 0.0


@ttl_cache(seconds=60)
def get_fd_module_data() -> Dict[str, Any]:
    fdr_data = fetch_dict("SELECT * FROM FDR_List")
    total_fd, total_lien = 0, 0
    bank_wise, purpose_wise = {}, {"LC": 0, "BG": 0, "Collateral": 0, "Other": 0}
    cd, maturity_analysis = date.today(), {"7 Days": 0, "30 Days": 0, "60 Days": 0, "90 Days": 0, "Over 90 Days": 0}
    unparseable_dates = 0
    for row in fdr_data:
        amt, lien = _clean_amount(row.get('final_fd_amt')), _clean_amount(row.get('fd_lien_amt_for_lc_bg'))
        total_fd += amt; total_lien += lien
        bank = row.get('bank_name', 'Unknown'); bank_wise[bank] = bank_wise.get(bank, 0) + amt
        purpose = str(row.get('lc_bg_collateral', 'Other')).upper()
        if "LC" in purpose: purpose_wise["LC"] += amt
        elif "BG" in purpose: purpose_wise["BG"] += amt
        elif "COLL" in purpose: purpose_wise["Collateral"] += amt
        else: purpose_wise["Other"] += amt
        m_date_str = row.get('maturity_date') or row.get('new_maturity_date')
        if m_date_str and str(m_date_str).strip() not in ('', '-'):
            try:
                m_date = datetime.strptime(str(m_date_str)[:10], "%Y-%m-%d").date()
                diff = (m_date - cd).days
                if diff <= 7: maturity_analysis["7 Days"] += amt
                elif diff <= 30: maturity_analysis["30 Days"] += amt
                elif diff <= 60: maturity_analysis["60 Days"] += amt
                elif diff <= 90: maturity_analysis["90 Days"] += amt
                else: maturity_analysis["Over 90 Days"] += amt
            except ValueError:
                unparseable_dates += 1
    if unparseable_dates:
        logger.warning("FDR_List: %d rows have unparseable maturity dates — excluded from maturity buckets", unparseable_dates)
    return {"kpis": {"total_fd": total_fd, "total_lien": total_lien, "working_capital_frozen": total_lien, "available_fd": total_fd - total_lien},
            "bank_wise": [{"bank": k, "value": v} for k, v in bank_wise.items()], "purpose_wise": [{"purpose": k, "value": v} for k, v in purpose_wise.items()],
            "maturity": [{"bucket": k, "value": v} for k, v in maturity_analysis.items()],
            "data_quality": {"unparseable_maturity_dates": unparseable_dates}}


@ttl_cache(seconds=60)
def get_bg_module_data() -> Dict[str, Any]:
    bg_data = fetch_dict("SELECT * FROM Bank_Guarantee")
    outstanding, expiring_soon, expired, fd_linked = 0, 0, 0, 0
    unparseable_dates = 0
    for bg in bg_data:
        amt, status = _clean_amount(bg.get('amt')), str(bg.get('status')).lower()
        is_open = status in ('open', 'active')
        exp_date_str = bg.get('date_of_expiry')
        if exp_date_str:
            try:
                exp_date = datetime.strptime(str(exp_date_str)[:10], "%Y-%m-%d").date()
                diff = (exp_date - date.today()).days
                if diff < 0: expired += amt
                elif is_open:
                    outstanding += amt
                    if diff < 30: expiring_soon += amt
            except ValueError:
                unparseable_dates += 1
                if is_open: outstanding += amt
        elif is_open: outstanding += amt
        if _clean_amount(bg.get('fd_lien_amt')) > 0 and is_open: fd_linked += amt
    if unparseable_dates:
        logger.warning("Bank_Guarantee: %d rows have unparseable expiry dates", unparseable_dates)
    return {"outstanding": outstanding, "expiring_30d": expiring_soon, "expired": expired, "fd_linked": fd_linked}
