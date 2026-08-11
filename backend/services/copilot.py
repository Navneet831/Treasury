"""GrewGpt: Autonomous Treasury Intelligence Copilot powered by OpenRouter.
Combines comprehensive warehouse snapshots with multi-model LLM reasoning 
to generate proactive, deep treasury insights.
"""
import os
import json
import logging
import time
from typing import Any, Dict, List, Optional
from openai import OpenAI

from apps.Treasury.backend.llm_metrics import (
    observe_llm_call, observe_retrieval_time, observe_fallback_depth
)

from apps.Treasury.backend.database import fetch_dict
from apps.Treasury.backend.services.core import (
    COL_MAP, _UNPAID, _due_amount_expr, _fmt_cr, _limit_exposure_snapshot, get_current_date
)

logger = logging.getLogger(__name__)

# Fallback chain prioritizing free models on OpenRouter
MODELS = [
    "deepseek/deepseek-r1:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "meta-llama/llama-3-8b-instruct:free"
]

def _get_client() -> Optional[OpenAI]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None
    
    # Construct frontend URL for HTTP-Referer header from env
    frontend_host = os.getenv("FRONTEND_HOST", "127.0.0.1")
    if frontend_host == "0.0.0.0":
        frontend_host = "127.0.0.1"
    frontend_port = os.getenv("FRONTEND_PORT", "8000")
    referer = f"http://{frontend_host}:{frontend_port}"

    # OpenRouter free tier requires these specific headers to avoid 403s
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": referer,
            "X-Title": "GrewAnalytics"
        }
    )


def _get_comprehensive_snapshot() -> Dict[str, Any]:
    """Generates a full daily treasury snapshot so the AI can act autonomously."""
    due, st = COL_MAP["due_date"], COL_MAP["lc_status"]
    due_amt = _due_amount_expr("INR")
    
    limits = _limit_exposure_snapshot()
    
    # Overdue summary
    overdue_rows = fetch_dict(f"""
        SELECT COUNT(*) as count, SUM({due_amt}) as amount 
        FROM lc 
        WHERE CAST({due} AS DATE) < CURRENT_DATE AND {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled')
    """)
    overdue_summary = overdue_rows[0] if overdue_rows else {"count": 0, "amount": 0}

    # Upcoming 30 days
    upcoming_rows = fetch_dict(f"""
        SELECT COUNT(*) as count, SUM({due_amt}) as amount 
        FROM lc 
        WHERE CAST({due} AS DATE) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 30 DAY
          AND {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled')
    """)
    upcoming_summary = upcoming_rows[0] if upcoming_rows else {"count": 0, "amount": 0}

    # Bank-wise unpaid
    bank_rows = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as bank, SUM({due_amt}) as unpaid_amount
        FROM lc WHERE {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled')
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3
    """)
    
    # Recent highest-value unpaid records
    base_cols = (f"{COL_MAP['lc_no']} as lc_no, {COL_MAP['bank']} as bank, "
                 f"{COL_MAP['supplier']} as supplier, {due} as due_date, {due_amt} as amount")
    top_unpaid = fetch_dict(f"""
        SELECT {base_cols} FROM lc
        WHERE {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled') AND {due} IS NOT NULL
        ORDER BY {due_amt} DESC LIMIT 5
    """)

    return {
        "limit_snapshot": limits,
        "overdue_summary": overdue_summary,
        "upcoming_30_days": upcoming_summary,
        "top_3_banks_unpaid": bank_rows,
        "top_5_largest_unpaid_bills": top_unpaid
    }

def process_ai_query(query: str) -> Dict[str, Any]:
    """Provides the DB snapshot to the AI and attempts multiple fallback models."""
    q = query.lower()
    
    # Always fetch a comprehensive snapshot for the AI to reason over, timed
    _retrieval_start = time.time()
    snapshot = _get_comprehensive_snapshot()
    observe_retrieval_time(time.time() - _retrieval_start)
    
    client = _get_client()
    if not client:
        fallback = f"GrewGpt API key is missing. System snapshot: Limit Utilisation is {snapshot['limit_snapshot']['utilization_pct']:.1f}%. You have {snapshot['overdue_summary']['count']} overdue bills."
        return {"answer": fallback, "data": snapshot["top_5_largest_unpaid_bills"]}

    system_prompt = (
        "You are GrewGpt, an autonomous Treasury Intelligence Copilot for Grew Energy. "
        "You have direct access to the live Treasury database snapshot. "
        "Your goal is to proactively generate deep insights that the standard UI dashboards might miss. "
        "Analyze the provided data snapshot (limits, overdues, upcoming payments, top banks). "
        "Identify critical risks, suggest areas the treasury team should focus on today, and recommend actions. "
        "Use a highly professional, executive tone. Always reference specific numbers in Crores (e.g., ₹12.5 Cr) from the data. "
        "Do not apologize or use filler words."
    )
    
    user_context = f"User Query: {query}\n\nLive Database Snapshot:\n{json.dumps(snapshot, default=str)}"

    last_error = None
    attempts = 0
    for model in MODELS:
        attempts += 1
        _model_start = time.time()
        try:
            logger.info(f"Attempting GrewGpt response with model: {model}")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_context}
                ],
                timeout=45.0
            )
            
            elapsed = time.time() - _model_start
            answer = response.choices[0].message.content
            
            # Extract token usage if available (OpenAI response.usage may be None on OpenRouter free tier)
            usage = getattr(response, "usage", None)
            prompt_tokens = usage.prompt_tokens if usage else None
            completion_tokens = usage.completion_tokens if usage else None
            
            # Record success metrics
            observe_llm_call(
                model, "success", elapsed,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )
            observe_fallback_depth(attempts)
            
            # Clean up <think> tags from Deepseek R1 for a cleaner UI presentation
            if "<think>" in answer and "</think>" in answer:
                answer = answer.split("</think>")[-1].strip()
                
            return {"answer": answer, "data": snapshot["top_5_largest_unpaid_bills"]}

        except Exception as e:
            elapsed = time.time() - _model_start
            error_type = type(e).__name__
            logger.warning(f"Model {model} failed after {elapsed:.1f}s: {e}")
            observe_llm_call(model, "error", elapsed, error_type=error_type)
            last_error = str(e)
            continue
    
    # All models failed — record the full fallback depth
    observe_fallback_depth(attempts)
    error_msg = f"I am currently experiencing connectivity issues with the AI providers ({last_error}). However, based on your data, your limit utilisation is {snapshot['limit_snapshot']['utilization_pct']:.1f}% and you have {snapshot['overdue_summary']['count']} overdue bills."
    return {"answer": error_msg, "data": snapshot["top_5_largest_unpaid_bills"]}
