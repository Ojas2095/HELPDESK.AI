"""
Response Time Estimator API Routes — AI-Powered SLA Breach Prediction
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from backend.services.rate_limit_config import limiter



from backend.services.response_time_estimator import (
    estimate_response_time,
    generate_estimation_summary,
)

router = APIRouter(prefix="/api/estimator", tags=["estimator"])


class EstimateRequest(BaseModel):
    priority: str = Field(default="medium", pattern="^(critical|high|medium|low)$")
    team_workload: int = Field(..., ge=0)
    team_size: int = Field(default=1, ge=1)
    category: Optional[str] = None
    historical_avg_hours: Optional[float] = Field(default=None, gt=0)


@router.post("/estimate")
@limiter.limit("20/minute")
async def estimate(request: Request, body: EstimateRequest):
    """Estimate response time and predict SLA breach risk."""
    try:
        estimation = estimate_response_time(
            priority=body.priority,
            team_workload=body.team_workload,
            team_size=body.team_size,
            category=body.category,
            historical_avg_hours=body.historical_avg_hours,
        )
        summary = generate_estimation_summary(estimation)

        return {
            "success": True,
            "data": {
                "estimation": estimation,
                "summary": summary,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Estimation failed: {str(e)}")


@router.get("/sla-targets")
async def get_sla_targets():
    """Get SLA targets for all priority levels."""
    from backend.services.response_time_estimator import SLA_TARGETS

    return {"success": True, "data": SLA_TARGETS}
