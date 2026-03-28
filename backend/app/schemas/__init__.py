"""schemas/__init__.py — re-export all Pydantic schemas for convenience."""
from app.schemas.auth import (              # noqa: F401
    RegisterRequest, VerifyEmailRequest, LoginRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
    UpdateProfileRequest, AdminDecisionRequest,
    TokenResponse, RegisterResponse, RefreshResponse, UserResponse,
)
from app.schemas.company import (           # noqa: F401
    OnboardingUpdateRequest, CompanyProfileUpdateRequest,
    SwitchCompanyRequest, CompanyResponse, OnboardingStatusResponse,
)
from app.schemas.document import (          # noqa: F401
    DocumentResponse, DocumentListResponse, AdminDocumentUpdateRequest,
)
from app.schemas.tender import (            # noqa: F401
    TenderCreateRequest, TenderResponse,
    ApplicationCreateRequest, ApplicationResponse, ApplicationReviewRequest,
)
from app.schemas.score import (             # noqa: F401
    ScoreResponse, ScoreHistoryResponse, ScoreHistoryPoint, ReadinessBandResponse,
)
from app.schemas.common import OkResponse, ErrorResponse, PaginatedResponse  # noqa: F401
