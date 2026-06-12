import urllib.request
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

CACHE_DURATION = timedelta(hours=1)
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

# Frankfurter supports multi-currency in one call
_MULTI_URL = "https://api.frankfurter.app/latest?from=USD&to=INR,EUR,CNY"

# Fallback: open.er-api (free, no key)
_FALLBACK_URL = "https://open.er-api.com/v6/latest/USD"

# RBI repo rate — updated manually when RBI changes it
RBI_REPO_RATE = 6.25

_rates_cache: Dict[str, Any] = {
    "usd_inr": None,
    "eur_inr": None,
    "cny_inr": None,
    "expiry": None,
}


def _fetch_rates() -> bool:
    """Fetches USD, EUR, CNY → INR in one shot. Returns True on success."""
    now = datetime.now()

    # Primary: Frankfurter (one call, three pairs)
    for url, usd_key, eur_key, cny_key in [
        (_MULTI_URL,      lambda d: d["rates"]["INR"],    lambda d: d["rates"].get("EUR"), lambda d: d["rates"].get("CNY")),
        (_FALLBACK_URL,   lambda d: d["rates"]["INR"],    lambda d: d["rates"].get("EUR"), lambda d: d["rates"].get("CNY")),
    ]:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": _UA})
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    usd_inr = usd_key(data)
                    if not usd_inr:
                        continue
                    eur_raw = eur_key(data)
                    cny_raw = cny_key(data)

                    # base=USD: rates["INR"]=84.x, rates["EUR"]=0.9x (EUR per USD), rates["CNY"]=7.x (CNY per USD)
                    # EUR/INR = USD/INR ÷ (EUR/USD) = rates["INR"] / rates["EUR"]
                    _rates_cache["usd_inr"] = float(usd_inr)
                    if eur_raw:
                        _rates_cache["eur_inr"] = round(float(usd_inr) / float(eur_raw), 4)
                    if cny_raw:
                        _rates_cache["cny_inr"] = round(float(usd_inr) / float(cny_raw), 4)
                    _rates_cache["expiry"] = now + CACHE_DURATION
                    return True
        except Exception as e:
            logger.warning(f"FX provider {url} failed: {e}")

    return False


def get_usd_inr_rate() -> Optional[float]:
    now = datetime.now()
    if _rates_cache["usd_inr"] and _rates_cache["expiry"] and now < _rates_cache["expiry"]:
        return _rates_cache["usd_inr"]
    _fetch_rates()
    return _rates_cache["usd_inr"]


def get_all_rates() -> Dict[str, Any]:
    """Returns USD/INR, EUR/INR, CNY/INR and RBI repo rate in one response."""
    now = datetime.now()
    if not (_rates_cache["usd_inr"] and _rates_cache["expiry"] and now < _rates_cache["expiry"]):
        _fetch_rates()
    return {
        "usd_inr": _rates_cache["usd_inr"],
        "eur_inr": _rates_cache["eur_inr"],
        "cny_inr": _rates_cache["cny_inr"],
        "repo_rate": RBI_REPO_RATE,
    }
