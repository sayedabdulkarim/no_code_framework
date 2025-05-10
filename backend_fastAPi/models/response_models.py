from pydantic import BaseModel, Field
from typing import Dict, Optional

class GenerateResponse(BaseModel):
    files: Dict[str, str] = Field(..., description="Generated code files")
    analysis: Optional[str] = Field(default=None, description="Analysis of the requirement")
    plan: Optional[str] = Field(default=None, description="Plan for implementing the UI")
    feedback: Optional[str] = Field(default=None, description="Feedback or suggestions if the requirement isn't clear")

class PRDResponse(BaseModel):
    prd: str = Field(..., description="Generated Product Requirements Document")
