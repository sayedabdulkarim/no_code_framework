from fastapi import APIRouter, HTTPException, status
from models.request_models import PRDRequest, PRDApprovalRequest
from models.response_models import PRDResponse, GenerateResponse
from services.prd_service import PRDService
from services.agent_service import AgentService
from services.llm_service import LLMServiceError
import logging

router = APIRouter(tags=["prd"])
prd_service = PRDService()
agent_service = AgentService()
logger = logging.getLogger(__name__)

@router.post("/generate-prd", response_model=PRDResponse)
async def generate_prd(request: PRDRequest):
    try:
        prd = await prd_service.generate_prd(request.requirement)
        return PRDResponse(prd=prd)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve-prd", response_model=GenerateResponse)
async def approve_prd(request: PRDApprovalRequest):
    try:
        if not request.approved:
            raise HTTPException(status_code=400, detail="PRD was not approved")
        
        # Process the requirement through the agent service
        result = await agent_service.process_requirement(request.requirement)
        logger.debug(f"Generated UI result: {result}")
        return GenerateResponse(**result)
        
    except LLMServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error in approve_prd: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))