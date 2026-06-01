import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

# import- d
from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    Request,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from gotrue.errors import AuthApiError
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client

from backend.schemas import User, UserCreate, UserLogin, UserResponse, PasswordResetRequest
from backend.utils import (
    create_user_in_supabase,
    get_user_by_email,
    verify_password,
    create_access_token,
    get_current_user,
    send_password_reset_email,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="HelpDesk AI API",
    description="API for HelpDesk AI, a smart solution for customer support.",
    version="1.0.0",
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://helpdesk-ai-alpha.vercel.app",
    "https://helpdesk-ai-git-gssoc-ritesh-1918s-projects.vercel.app",
    "https://helpdesk-ai-t8nyh60f0-ritesh-1918s-projects.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client

def get_supabase_client() -> Client:
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("Supabase URL and Key must be set in environment variables.")
    return create_client(url, key)


# --- User Management --- #


class UserRegistration(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    org_name: str


class LoginData(BaseModel):
    email: str
    password: str


class TokenData(BaseModel):
    access_token: str
    token_type: str
    user: dict


@app.post("/api/v1/register", response_model=UserResponse)
async def register(user_data: UserRegistration, supabase: Client = Depends(get_supabase_client)):
    logger.info(f"Registration attempt for email: {user_data.email}")
    try:
        # Check if user already exists
        existing_user = get_user_by_email(user_data.email, supabase)
        if existing_user:
            logger.warning(f"Registration failed: User already exists with email {user_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists",
            )

        # Create organization
        org_response = (
            supabase.table("organizations")
            .insert({"name": user_data.org_name, "created_at": datetime.now(timezone.utc).isoformat()})
            .execute()
        )
        if not org_response.data:
            logger.error("Organization creation failed.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create organization",
            )
        org_id = org_response.data[0]["id"]

        # Create user
        created_user = create_user_in_supabase(user_data, org_id, supabase)
        if not created_user:
            logger.error(f"User creation failed for email: {user_data.email}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user",
            )

        logger.info(f"User registered successfully: {created_user['email']}")
        return {"status": "success", "user": created_user}
    except AuthApiError as e:
        logger.error(f"Auth API error during registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    except Exception as e:
        logger.error(f"An unexpected error occurred during registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )


@app.post("/api/v1/login", response_model=TokenData)
async def login(login_data: LoginData, supabase: Client = Depends(get_supabase_client)):
    logger.info(f"Login attempt for email: {login_data.email}")
    try:
        user = get_user_by_email(login_data.email, supabase)
        if not user or not verify_password(login_data.password, user["hashed_password"]):
            logger.warning(f"Invalid login credentials for email: {login_data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = create_access_token(data={"sub": user["email"]})
        logger.info(f"User logged in successfully: {user['email']}")

        user_details = {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "org_id": user["org_id"],
        }

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_details,
        }
    except Exception as e:
        logger.error(f"An unexpected error occurred during login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )

@app.post("/api/v1/request-password-reset")
async def request_password_reset(
    request_data: PasswordResetRequest, supabase: Client = Depends(get_supabase_client)
):
    email = request_data.email
    logger.info(f"Password reset requested for email: {email}")
    try:
        user = get_user_by_email(email, supabase)
        if user:
            # Generate a password reset token (this is a simplified example)
            # In a real app, you would generate a secure, short-lived token
            reset_token = create_access_token(data={"sub": email, "type": "reset"})

            # Send the password reset email
            send_password_reset_email(email, reset_token)
            logger.info(f"Password reset email sent to {email}")
        else:
            # Even if user doesn't exist, we don't reveal it for security reasons
            logger.warning(f"Password reset requested for non-existent email: {email}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": "If an account with that email exists, a password reset link has been sent."}
        )
    except Exception as e:
        logger.error(f"Error during password reset request for {email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process password reset request."
        )

# --- Organization Management --- #


class OrgResponse(BaseModel):
    id: str
    name: str


@app.get("/api/v1/organization", response_model=OrgResponse)
async def get_organization(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(
                status_code=403, detail="User not part of an organization"
            )

        response = (
            supabase.table("organizations").select("id, name").eq("id", org_id).single().execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="Organization not found")

        return response.data
    except Exception as e:
        logger.error(f"Error fetching organization for user {user.get('id')}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to fetch organization details"
        )


# --- Team Management --- #

class TeamMemberCreate(BaseModel):
    full_name: str
    email: EmailStr
    role: str # e.g., 'agent', 'admin'

class TeamMemberResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: str

@app.post("/api/v1/team/invite", response_model=UserResponse)
async def invite_team_member(
    member_data: TeamMemberCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    logger.info(f"Invitation attempt for email: {member_data.email} to org_id: {user.get('org_id')}")
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=403, detail="User not part of an organization")

        # Check if user already exists
        existing_user = get_user_by_email(member_data.email, supabase)
        if existing_user:
            logger.warning(f"Invitation failed: User already exists with email {member_data.email}")
            raise HTTPException(
                status_code=400,
                detail="User with this email already exists."
            )

        # For simplicity, we'll use a placeholder password.
        # In a real-world scenario, you'd send an invitation link
        # where the user sets their own password.
        placeholder_password = "Password@123"
        
        new_user_data = UserCreate(
            full_name=member_data.full_name,
            email=member_data.email,
            password=placeholder_password,
            role=member_data.role
        )

        created_user = create_user_in_supabase(new_user_data, org_id, supabase)
        if not created_user:
            logger.error(f"Team member creation failed for email: {member_data.email}")
            raise HTTPException(status_code=500, detail="Failed to create team member")

        # Here you would typically trigger an email to the new user
        # with a link to set their password.

        logger.info(f"Team member invited successfully: {created_user['email']}")
        return {"status": "success", "user": created_user}

    except Exception as e:
        logger.error(f"Error inviting team member: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while inviting team member")


@app.get("/api/v1/team", response_model=List[TeamMemberResponse])
async def get_team_members(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    logger.info(f"Fetching team members for org_id: {user.get('org_id')}")
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=403, detail="User not part of an organization")

        response = supabase.table("users").select("id, full_name, email, role").eq("org_id", org_id).execute()
        
        if not response.data:
            return []

        return response.data
    except Exception as e:
        logger.error(f"Error fetching team members: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch team members")

# --- Knowledge Base Management --- #

class KBArticleCreate(BaseModel):
    title: str
    content: str
    category_id: Optional[str] = None

class KBArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[str] = None

class KBArticleResponse(BaseModel):
    id: str
    title: str
    content: str
    org_id: str
    category_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

@app.post("/api/v1/kb/articles", response_model=KBArticleResponse, status_code=201)
async def create_kb_article(
    article_data: KBArticleCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=403, detail="User not part of an organization")

        article_dict = article_data.model_dump()
        article_dict["org_id"] = org_id
        article_dict["created_at"] = datetime.now(timezone.utc).isoformat()
        article_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = supabase.table("kb_articles").insert(article_dict).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create article")

        return response.data[0]
    except Exception as e:
        logger.error(f"Error creating KB article: {e}")
        raise HTTPException(status_code=500, detail="Failed to create knowledge base article")

@app.get("/api/v1/kb/articles", response_model=List[KBArticleResponse])
async def get_kb_articles(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=403, detail="User not part of an organization")

        response = supabase.table("kb_articles").select("*").eq("org_id", org_id).execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching KB articles: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch knowledge base articles")

@app.get("/api/v1/kb/articles/{article_id}", response_model=KBArticleResponse)
async def get_kb_article(
    article_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        response = supabase.table("kb_articles").select("*").eq("id", article_id).eq("org_id", org_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Article not found")
        return response.data
    except Exception as e:
        logger.error(f"Error fetching KB article {article_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch article")

@app.put("/api/v1/kb/articles/{article_id}", response_model=KBArticleResponse)
async def update_kb_article(
    article_id: str,
    article_data: KBArticleUpdate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        update_dict = article_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = supabase.table("kb_articles").update(update_dict).eq("id", article_id).eq("org_id", org_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Article not found or update failed")
        return response.data[0]
    except Exception as e:
        logger.error(f"Error updating KB article {article_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update article")

@app.delete("/api/v1/kb/articles/{article_id}", status_code=204)
async def delete_kb_article(
    article_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        response = supabase.table("kb_articles").delete().eq("id", article_id).eq("org_id", org_id).execute()
        # We can check response.data to see if a row was deleted if needed
        return
    except Exception as e:
        logger.error(f"Error deleting KB article {article_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete article")


# --- Ticket Management --- #

class TicketCreate(BaseModel):
    subject: str
    description: str
    customer_email: EmailStr
    customer_name: str
    status: Optional[str] = 'new'
    priority: Optional[str] = 'medium'
    assigned_to: Optional[str] = None # User ID of the agent

class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None

class TicketResponse(BaseModel):
    id: str
    subject: str
    description: str
    customer_email: EmailStr
    customer_name: str
    status: str
    priority: str
    org_id: str
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# New Pydantic model for paginated tickets response
class PaginatedTicketsResponse(BaseModel):
    status: str
    data: List[TicketResponse]
    total: int


@app.post("/api/v1/tickets", response_model=TicketResponse, status_code=201)
async def create_ticket(
    ticket_data: TicketCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=403, detail="User not part of an organization")

        ticket_dict = ticket_data.model_dump()
        ticket_dict["org_id"] = org_id
        ticket_dict["created_at"] = datetime.now(timezone.utc).isoformat()
        ticket_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = supabase.table("tickets").insert(ticket_dict).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create ticket")
        
        # Optional: Trigger notification to assigned agent
        
        return response.data[0]
    except Exception as e:
        logger.error(f"Error creating ticket: {e}")
        raise HTTPException(status_code=500, detail="Failed to create ticket")

@app.get("/api/v1/tickets", response_model=PaginatedTicketsResponse)
async def get_tickets(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    limit: int = Query(default=50, ge=1),
    offset: int = Query(default=0, ge=0),
):
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(
                status_code=403, detail="User not part of an organization"
            )

        # Get total count for pagination metadata
        count_query = (
            supabase.table("tickets")
            .select("id", count="exact")
            .eq("org_id", org_id)
        )
        count_response = count_query.execute()
        total_tickets = count_response.count if count_response.count is not None else 0

        # Fetch paginated tickets, ordered for consistency
        query = (
            supabase.table("tickets")
            .select("*")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        response = query.execute()

        # Ensure data returned by Supabase matches TicketResponse structure for Pydantic validation
        # Supabase client typically returns dictionaries. Pydantic will validate them.
        return {"status": "success", "data": response.data, "total": total_tickets}
    except Exception as e:
        logger.error(f"Error fetching tickets: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch tickets")


@app.get("/api/v1/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        response = supabase.table("tickets").select("*").eq("id", ticket_id).eq("org_id", org_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return response.data
    except Exception as e:
        logger.error(f"Error fetching ticket {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch ticket")

@app.put("/api/v1/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    ticket_data: TicketUpdate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        update_dict = ticket_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = supabase.table("tickets").update(update_dict).eq("id", ticket_id).eq("org_id", org_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Ticket not found or update failed")
        
        # Optional: Trigger notification on status change, assignment, etc.

        return response.data[0]
    except Exception as e:
        logger.error(f"Error updating ticket {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update ticket")

# --- Comments/Replies Management --- #

class CommentCreate(BaseModel):
    content: str

class CommentResponse(BaseModel):
    id: str
    content: str
    ticket_id: str
    user_id: str
    created_at: datetime

@app.post("/api/v1/tickets/{ticket_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment_to_ticket(
    ticket_id: str,
    comment_data: CommentCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        user_id = user.get("id")
        org_id = user.get("org_id")

        # First, verify the ticket belongs to the user's organization
        ticket_response = supabase.table("tickets").select("id").eq("id", ticket_id).eq("org_id", org_id).single().execute()
        if not ticket_response.data:
            raise HTTPException(status_code=404, detail="Ticket not found in this organization")

        comment_dict = {
            "content": comment_data.content,
            "ticket_id": ticket_id,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        response = supabase.table("comments").insert(comment_dict).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to add comment")

        return response.data[0]
    except Exception as e:
        logger.error(f"Error adding comment to ticket {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add comment")

@app.get("/api/v1/tickets/{ticket_id}/comments", response_model=List[CommentResponse])
async def get_ticket_comments(
    ticket_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")

        # Verify ticket belongs to the org
        ticket_response = supabase.table("tickets").select("id").eq("id", ticket_id).eq("org_id", org_id).single().execute()
        if not ticket_response.data:
            raise HTTPException(status_code=404, detail="Ticket not found")

        response = supabase.table("comments").select("*").eq("ticket_id", ticket_id).order("created_at").execute()

        return response.data
    except Exception as e:
        logger.error(f"Error fetching comments for ticket {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch comments")


# --- Dashboard/Analytics --- #

class DashboardStats(BaseModel):
    total_tickets: int
    new_tickets: int
    open_tickets: int
    closed_tickets: int

@app.get("/api/v1/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=403, detail="User not part of an organization")

        # This can be optimized by doing this in a single query or a database function
        total_tickets_res = supabase.table("tickets").select("id", count="exact").eq("org_id", org_id).execute()
        new_tickets_res = supabase.table("tickets").select("id", count="exact").eq("org_id", org_id).eq("status", "new").execute()
        open_tickets_res = supabase.table("tickets").select("id", count="exact").eq("org_id", org_id).eq("status", "open").execute()
        closed_tickets_res = supabase.table("tickets").select("id", count="exact").eq("org_id", org_id).eq("status", "closed").execute()

        stats = DashboardStats(
            total_tickets=total_tickets_res.count or 0,
            new_tickets=new_tickets_res.count or 0,
            open_tickets=open_tickets_res.count or 0,
            closed_tickets=closed_tickets_res.count or 0,
        )

        return stats
    except Exception as e:
        logger.error(f"Error fetching dashboard stats for org {org_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")


# --- Root Endpoint --- #
@app.get("/")
async def root():
    return {"message": "Welcome to the HelpDesk AI API"}
