from pydantic import BaseModel, Field # type: ignore

class GenerateRequest(BaseModel):
    requirement: str = Field(..., description="Description of the UI the user wants to create")

class PRDRequest(BaseModel):
    requirement: str = Field(..., description="User's product requirement")

class PRDApprovalRequest(BaseModel):
    requirement: str = Field(..., description="Original user requirement")
    prd: str = Field(..., description="PRD that was generated and approved by the user")
    approved: bool = Field(..., description="Whether the user approved the PRD")
