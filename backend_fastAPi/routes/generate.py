from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any
import logging
import json

from models.request_models import GenerateRequest
from models.response_models import GenerateResponse
from services.agent_service import AgentService
from services.llm_service import LLMServiceError

router = APIRouter(tags=["generate"])

agent_service = AgentService()
logger = logging.getLogger(__name__)

@router.post("/generate", response_model=GenerateResponse, status_code=status.HTTP_200_OK)
async def generate_ui(request: GenerateRequest) -> GenerateResponse:
    """
    Generate UI (HTML, CSS, JavaScript) based on the provided requirement
    """
    try:
        if not request.requirement or not request.requirement.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requirement cannot be empty"
            )
            
        # Process the requirement through the agent service
        result = await agent_service.process_requirement(request.requirement)
        
        # Pretty print for debugging
        logger.debug("Generated code:\n" + json.dumps(result, indent=2))
        
        return GenerateResponse(**result)
        
    except LLMServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LLM service error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )
