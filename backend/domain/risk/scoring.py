from dataclasses import dataclass

@dataclass
class HealthScoreInput:
    utilization_pct: float
    overdue_payments: float
    open_lc_value: float
    expired_lcs: int
    upcoming_7d: float
    fx_exposure_pct: float

class TreasuryHealthScoreService:
    """
    Domain Service for calculating the Treasury Health Score.
    Follows the Single Responsibility Principle (SRP).
    """
    
    # 60-30-10 cognitive weighting approach for financial stability
    WEIGHTS = {
        'utilization':  0.25,
        'liquidity':    0.20,
        'overdue':      0.20,
        'bank_conc':    0.15,
        'supplier_conc':0.10,
        'forecast_acc': 0.10,
    }
    
    def compute(self, inp: HealthScoreInput) -> float:
        score = 100.0
        
        # 1. Utilization Penalties (High weight)
        if inp.utilization_pct > 90:
            score -= 25
        elif inp.utilization_pct > 80:
            score -= 15
        elif inp.utilization_pct > 70:
            score -= 5
            
        # 2. Overdue Penalties (Critical immediate risk)
        if inp.overdue_payments > 5_000_000:
            score -= 20
        elif inp.overdue_payments > 1_000_000:
            score -= 10
        elif inp.overdue_payments > 0:
            score -= 5
            
        # 3. Upcoming Liquidity Pressure
        if inp.upcoming_7d > 10_000_000:
            score -= 15
        elif inp.upcoming_7d > 5_000_000:
            score -= 10
            
        # 4. FX Exposure Risk
        if inp.fx_exposure_pct > 70:
            score -= 10
        elif inp.fx_exposure_pct > 50:
            score -= 5
            
        # 5. Operational Risk (Expired LCs)
        if inp.expired_lcs > 10:
            score -= 10
        elif inp.expired_lcs > 0:
            score -= 5
            
        # Ensure score stays bounded between 0 and 100
        return max(0.0, min(100.0, score))
