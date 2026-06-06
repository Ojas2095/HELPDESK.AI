import re
import os

with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update FastAPI app initialization (Bug 3)
fastapi_app_orig = """app = FastAPI(
    title="AI Helpdesk Backend",
    description="Ticket classification, entity extraction, and duplicate detection",
    version="1.0.0",
    lifespan=lifespan,
)"""

fastapi_app_new = """tags_metadata = [
    {"name": "AI",      "description": "Ticket analysis, image OCR, and troubleshooting endpoints"},
    {"name": "Tickets", "description": "CRUD operations for support tickets"},
    {"name": "Auth",    "description": "User authentication and session management"},
    {"name": "Health",  "description": "Service readiness and liveness probes"},
]

app = FastAPI(
    title="HELPDESK.AI API",
    description="AI-powered helpdesk: ticket classification, NER, duplicate detection, RAG knowledge base.",
    version="3.0.0-PRO",
    contact={"name": "HELPDESK.AI Team", "url": "https://github.com/ritesh-1918/HELPDESK.AI"},
    license_info={"name": "MIT"},
    openapi_tags=tags_metadata,
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,
        "syntaxHighlight.theme": "monokai",
        "docExpansion": "list",
        "filter": True,
        "tryItOutEnabled": True,
    },
    docs_url="/api/docs",
    lifespan=lifespan,
)"""

if fastapi_app_orig in content:
    content = content.replace(fastapi_app_orig, fastapi_app_new)
else:
    print("Could not find FastAPI init")

# 2. Add docstrings to the specified endpoints (Bug 2)
docstrings = {
    "/auth/login": '    """Authenticate user and return JWT token."""\n',
    "/auth/signup": '    """Register a new user account."""\n',
    "/auth/logout": '    """Invalidate current user session."""\n',
    "/auth/me": '    """Get current authenticated user profile."""\n',
    "/health": '    """Service liveness probe and health check."""\n',
    "/ready": '    """Service readiness probe checking all dependencies."""\n',
    "/ai/analyze-v2": '    """Advanced V2 ticket analysis using improved models."""\n',
}

# 3. Add rate limiting to all endpoints (Bug 1)
# and ensure they have a request parameter.
def add_limit_and_request(match):
    # m.group(0) is the entire match
    decorator = match.group(1) # e.g. @app.get("/health", ...)
    method = match.group(2) # get, post, etc
    path = match.group(3) # /health
    func_def = match.group(4) # async def health_check():
    
    # We want to insert limit before async def
    limit_val = '"5/minute"' if path.startswith('/auth') else '"10/minute"'
    new_decorator = decorator + f"\n@limiter.limit({limit_val})"
    
    # ensure request: Request is in args
    # Parse function definition: async def func_name(args):
    # match 4 looks like: async def name(args...):
    func_match = re.match(r'(async def [^\(]+)\((.*)\):', func_def)
    if not func_match:
        return match.group(0)
    
    sig_start = func_match.group(1)
    args_str = func_match.group(2)
    
    # If the function already has 'request: Request', do nothing to args
    if 'request: Request' not in args_str and 'raw_request: Request' not in args_str:
        # If it has request: SomethingElse, let's rename it to request_body
        # Actually it's easier to just add 'request: Request' if 'request:' isn't already there.
        # But wait, we can just name the Request param 'req: Request'. Wait, slowapi requires it to be named 'request' by default, unless key_func extracts it. Actually slowapi extracts it by checking type Request!
        # Actually, let's just always add `request: Request`. If `request:` already exists as another type (e.g. `request: TicketRequest`), let's rename it.
        # This can be tricky with regex, so we'll just handle known cases.
        
        args_list = args_str.split(',') if args_str else []
        new_args = []
        has_request = False
        for arg in args_list:
            if 'request:' in arg and 'Request' not in arg.split(':')[1]:
                # Rename to request_body
                arg = arg.replace('request:', 'request_body:')
            new_args.append(arg)
            
        # Add request: Request
        new_args.append(' request: Request')
        args_str = ','.join(new_args).strip(', ')
        # fix formatting
        if args_str.startswith(' '): args_str = args_str[1:]
        
        func_def = f"{sig_start}({args_str}):"
    
    # Check if we need to add docstring (Bug 2)
    doc_str = docstrings.get(path, "")
    
    # Check if the function already has a limit
    if '@limiter.limit' in decorator:
        new_decorator = decorator # Already has it
    
    return f"{new_decorator}\n{func_def}\n{doc_str}"

# Pattern: match @app.xxx(...) \n [maybe other decorators] \n async def ...
pattern = r'(@app\.(get|post|put|delete|patch)\("([^"]+)"[^\n]*\)(?:\n@[^\n]+)*)\n(async def [^\(]+\([^\)]*\):)'

content = re.sub(pattern, add_limit_and_request, content)

# Also fix the renaming of 'request' to 'request_body' inside function bodies for specific functions
# We renamed `request:` to `request_body:` in the signature, but we need to replace `request.` with `request_body.` inside the function.
# Specifically for troubleshoot and analyze_bug where request: TroubleshootRequest etc were used.
content = re.sub(r'async def troubleshoot\(request_body: TroubleshootRequest, request: Request\):(?:\n\s+"""[^"]+""")?\n(\s+)if not gemini_service', 
                 r'async def troubleshoot(request_body: TroubleshootRequest, request: Request):\n\1if not gemini_service', content)
# actually a simpler replace:
content = content.replace("request.text", "request_body.text")
content = content.replace("request.category", "request_body.category")
content = content.replace("request.history", "request_body.history")
content = content.replace("request.bug_title", "request_body.bug_title")
content = content.replace("request.description", "request_body.description")
content = content.replace("request.steps_to_reproduce", "request_body.steps_to_reproduce")
content = content.replace("request.console_errors", "request_body.console_errors")
content = content.replace("request.client", "request.client") # Revert if we messed up

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patch applied")
