# app/core/swagger_config.py

import logging
from typing import Any, Dict, Optional, List, Union
from fastapi import FastAPI, HTTPException
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel, Field, ValidationError, validator
from enum import Enum
import json
import re
from datetime import datetime
from pathlib import Path

# Configure logging with proper format and handlers
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('swagger_config.log')
    ]
)
logger = logging.getLogger(__name__)

class EnvironmentType(str, Enum):
    """Enum for supported environment types."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class SecuritySchemeType(str, Enum):
    """Enum for security scheme types."""
    BEARER = "BearerAuth"
    API_KEY = "ApiKeyAuth"
    OAUTH2 = "OAuth2"

class OpenAPIConfig(BaseModel):
    """Configuration model for OpenAPI schema customization with validation."""
    
    title: str = Field(
        default="HELPDESK.AI API",
        description="API title displayed in documentation",
        min_length=1,
        max_length=100
    )
    version: str = Field(
        default="2.0.0",
        description="API version number following semantic versioning",
        regex=r"^\d+\.\d+\.\d+$"
    )
    description: str = Field(
        default="",
        description="API description in markdown format",
        max_length=5000
    )
    contact: Optional[Dict[str, str]] = Field(
        default=None,
        description="Contact information for API support"
    )
    license_info: Optional[Dict[str, str]] = Field(
        default=None,
        description="License information for the API"
    )
    environment: EnvironmentType = Field(
        default=EnvironmentType.DEVELOPMENT,
        description="Current environment type"
    )
    servers: List[Dict[str, str]] = Field(
        default=[],
        description="List of server URLs for different environments"
    )

    @validator('contact')
    def validate_contact(cls, v: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
        """Validate contact information structure."""
        if v is not None:
            if not isinstance(v, dict):
                raise ValueError("Contact information must be a dictionary")
            if "email" in v and not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v["email"]):
                raise ValueError("Invalid email format in contact information")
            if "url" in v and not v["url"].startswith(("http://", "https://")):
                raise ValueError("Contact URL must start with http:// or https://")
        return v

    @validator('servers')
    def validate_servers(cls, v: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Validate server configurations."""
        for server in v:
            if "url" not in server:
                raise ValueError("Each server must have a 'url' field")
            if not server["url"].startswith(("http://", "https://")):
                raise ValueError("Server URL must start with http:// or https://")
        return v

class SwaggerThemeConfig(BaseModel):
    """Configuration model for Swagger UI theme customization with validation."""
    
    primary_color: str = Field(
        default="#1a73e8",
        description="Primary color for theme (hex format)"
    )
    secondary_color: str = Field(
        default="#34a853",
        description="Secondary color for theme (hex format)"
    )
    background_color: str = Field(
        default="#ffffff",
        description="Background color for theme (hex format)"
    )
    font_family: str = Field(
        default="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        description="Font family for documentation"
    )
    border_radius: str = Field(
        default="4px",
        description="Border radius for UI elements"
    )
    box_shadow: str = Field(
        default="0 2px 4px rgba(0,0,0,0.1)",
        description="Box shadow for UI elements"
    )

    @validator('primary_color', 'secondary_color', 'background_color')
    def validate_color(cls, v: str) -> str:
        """Validate hex color format."""
        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError(f"Invalid color format: {v}. Must be hex format (e.g., #1a73e8)")
        return v

class PostmanCollectionGenerator:
    """Generator for Postman collection with standardized variables and configurations."""
    
    def __init__(self, config: OpenAPIConfig):
        """
        Initialize Postman collection generator.
        
        Args:
            config: OpenAPIConfig instance for API configuration
        """
        self.config = config
        self.collection: Dict[str, Any] = {
            "info": {
                "name": f"{config.title} - Postman Collection",
                "description": f"Postman collection for {config.title} API v{config.version}",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
                "_exporter_id": "helpdesk-ai"
            },
            "variable": self._generate_variables(),
            "item": []
        }
        logger.info(f"Postman collection generator initialized for {config.title}")

    def _generate_variables(self) -> List[Dict[str, Any]]:
        """
        Generate standardized Postman variables.
        
        Returns:
            List[Dict[str, Any]]: List of Postman variables
        """
        try:
            variables = [
                {
                    "key": "base_url",
                    "value": self._get_base_url(),
                    "type": "string",
                    "description": "Base URL for the API"
                },
                {
                    "key": "api_version",
                    "value": self.config.version,
                    "type": "string",
                    "description": "API version"
                },
                {
                    "key": "auth_token",
                    "value": "",
                    "type": "string",
                    "description": "Authentication token for API access"
                },
                {
                    "key": "content_type",
                    "value": "application/json",
                    "type": "string",
                    "description": "Content type for requests"
                },
                {
                    "key": "accept_header",
                    "value": "application/json",
                    "type": "string",
                    "description": "Accept header for responses"
                }
            ]
            
            logger.debug(f"Generated {len(variables)} Postman variables")
            return variables
            
        except Exception as e:
            logger.error(f"Failed to generate Postman variables: {str(e)}")
            raise

    def _get_base_url(self) -> str:
        """
        Get base URL based on environment.
        
        Returns:
            str: Base URL for the current environment
        """
        if self.config.servers:
            return self.config.servers[0]["url"]
        
        base_urls = {
            EnvironmentType.DEVELOPMENT: "http://localhost:8000",
            EnvironmentType.STAGING: "https://staging.helpdesk.ai",
            EnvironmentType.PRODUCTION: "https://api.helpdesk.ai"
        }
        return base_urls.get(self.config.environment, base_urls[EnvironmentType.DEVELOPMENT])

    def add_endpoint(self, 
                    method: str, 
                    path: str, 
                    description: str,
                    request_body: Optional[Dict[str, Any]] = None,
                    query_params: Optional[List[Dict[str, str]]] = None,
                    headers: Optional[Dict[str, str]] = None,
                    auth_required: bool = True) -> None:
        """
        Add an endpoint to the Postman collection.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            path: API endpoint path
            description: Endpoint description
            request_body: Optional request body schema
            query_params: Optional query parameters
            headers: Optional custom headers
            auth_required: Whether authentication is required
            
        Raises:
            ValueError: If method or path is invalid
        """
        try:
            # Validate inputs
            if method.upper() not in ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]:
                raise ValueError(f"Invalid HTTP method: {method}")
            
            if not path.startswith("/"):
                path = f"/{path}"
            
            # Create endpoint item
            endpoint_item = {
                "name": f"{method.upper()} {path}",
                "description": description,
                "request": {
                    "method": method.upper(),
                    "header": self._generate_headers(headers, auth_required),
                    "url": {
                        "raw": f"{{{{base_url}}}}{path}",
                        "host": ["{{base_url}}"],
                        "path": path.strip("/").split("/"),
                        "query": self._generate_query_params(query_params),
                        "variable": self._generate_path_variables(path)
                    }
                },
                "response": []
            }
            
            # Add request body if provided
            if request_body and method.upper() in ["POST", "PUT", "PATCH"]:
                endpoint_item["request"]["body"] = {
                    "mode": "raw",
                    "raw": json.dumps(request_body, indent=2),
                    "options": {
                        "raw": {
                            "language": "json"
                        }
                    }
                }
            
            self.collection["item"].append(endpoint_item)
            logger.debug(f"Added endpoint {method.upper()} {path} to Postman collection")
            
        except ValueError as e:
            logger.error(f"Invalid endpoint configuration: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Failed to add endpoint to Postman collection: {str(e)}")
            raise

    def _generate_headers(self, 
                         custom_headers: Optional[Dict[str, str]], 
                         auth_required: bool) -> List[Dict[str, str]]:
        """
        Generate headers for Postman request.
        
        Args:
            custom_headers: Optional custom headers
            auth_required: Whether authentication is required
            
        Returns:
            List[Dict[str, str]]: List of header configurations
        """
        headers = [
            {
                "key": "Content-Type",
                "value": "{{content_type}}",
                "type": "text",
                "description": "Content type for the request"
            },
            {
                "key": "Accept",
                "value": "{{accept_header}}",
                "type": "text",
                "description": "Accept header for the response"
            }
        ]
        
        if auth_required:
            headers.append({
                "key": "Authorization",
                "value": "Bearer {{auth_token}}",
                "type": "text",
                "description": "Bearer token for authentication"
            })
        
        if custom_headers:
            for key, value in custom_headers.items():
                headers.append({
                    "key": key,
                    "value": value,
                    "type": "text",
                    "description": f"Custom header: {key}"
                })
        
        return headers

    def _generate_query_params(self, 
                              query_params: Optional[List[Dict[str, str]]]) -> List[Dict[str, str]]:
        """
        Generate query parameters for Postman request.
        
        Args:
            query_params: Optional list of query parameters
            
        Returns:
            List[Dict[str, str]]: List of query parameter configurations
        """
        if not query_params:
            return []
        
        params = []
        for param in query_params:
            params.append({
                "key": param.get("key", ""),
                "value": param.get("value", ""),
                "description": param.get("description", ""),
                "disabled": param.get("disabled", False)
            })
        
        return params

    def _generate_path_variables(self, path: str) -> List[Dict[str, str]]:
        """
        Extract and generate path variables from URL path.
        
        Args:
            path: API endpoint path
            
        Returns:
            List[Dict[str, str]]: List of path variable configurations
        """
        variables = []
        path_parts = path.split("/")
        
        for part in path_parts:
            if part.startswith("{") and part.endswith("}"):
                var_name = part.strip("{}")
                variables.append({
                    "key": var_name,
                    "value": f"<{var_name}>",
                    "description": f"Path variable: {var_name}"
                })
        
        return variables

    def export_collection(self, filepath: Optional[str] = None) -> str:
        """
        Export Postman collection to JSON file or return as string.
        
        Args:
            filepath: Optional filepath to save the collection
            
        Returns:
            str: JSON string of the Postman collection
            
        Raises:
            IOError: If file writing fails
        """
        try:
            collection_json = json.dumps(self.collection, indent=2)
            
            if filepath:
                # Create directory if it doesn't exist
                Path(filepath).parent.mkdir(parents=True, exist_ok=True)
                
                with open(filepath, 'w') as f:
                    f.write(collection_json)
                logger.info(f"Postman collection exported to {filepath}")
            
            return collection_json
            
        except IOError as e:
            logger.error(f"Failed to export Postman collection: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during export: {str(e)}")
            raise

def validate_openapi_config(config: OpenAPIConfig) -> bool:
    """
    Validate OpenAPI configuration parameters with comprehensive checks.
    
    Args:
        config: OpenAPIConfig instance to validate
        
    Returns:
        bool: True if configuration is valid
        
    Raises:
        ValidationError: If configuration is invalid
        ValueError: If configuration parameters are invalid
    """
    try:
        # Validate using Pydantic model
        config.validate()
        
        # Additional business logic validation
        if config.environment == EnvironmentType.PRODUCTION:
            if not config.contact:
                logger.warning("Production environment should have contact information")
            if not config.servers:
                logger.warning("Production environment should have server configurations")
        
        # Validate description length
        if len(config.description) > 5000:
            raise ValueError("Description exceeds maximum length of 5000 characters")
        
        # Validate version format
        version_parts = config.version.split(".")
        if len(version_parts) != 3:
            raise ValueError("Version must follow semantic versioning (e.g., 2.0.0)")
        
        logger.info(f"OpenAPI configuration validated successfully for {config.title}")
        return True
        
    except ValidationError as e:
        logger.error(f"Configuration validation failed: {str(e)}")
        raise
    except ValueError as e:
        logger.error(f"Configuration value error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during validation: {str(e)}")
        raise

def generate_custom_swagger_html(theme_config: SwaggerThemeConfig) -> str:
    """
    Generate custom Swagger UI HTML with corporate theme and enhanced styling.
    
    Args:
        theme_config: SwaggerThemeConfig instance with theme settings
        
    Returns:
        str: Custom HTML string for Swagger UI with embedded CSS
        
    Raises:
        ValueError: If theme configuration is invalid
    """
    try:
        # Validate theme configuration
        theme_config.validate()
        
        # Generate comprehensive CSS
        custom_css = f"""
        <style>
            /* Base styles */
            .swagger-ui {{
                font-family: {theme_config.font_family};
                background-color: {theme_config.background_color};
            }}
            
            /* Topbar styling */
            .swagger-ui .topbar {{
                background-color: {theme_config.primary_color};
                padding: 10px 0;
                box-shadow: {theme_config.box_shadow};
            }}
            
            .swagger-ui .topbar .download-url-wrapper .select-label select {{
                border-color: {theme_config.secondary_color};
            }}
            
            /* Button styling */
            .swagger-ui .btn {{
                background-color: {theme_config.secondary_color};
                border-color: {theme_config.secondary_color};
                border-radius: {theme_config.border_radius};
                transition: all 0.3s ease;
            }}
            
            .swagger-ui .btn:hover {{
                opacity: 0.9;
                transform: translateY(-1px);
                box-shadow: {theme_config.box_shadow};
            }}
            
            /* Operation tag styling */
            .swagger-ui .opblock-tag {{
                color: {theme_config.primary_color};
                font-size: 1.2em;
                border-bottom: 2px solid {theme_config.primary_color};
                padding-bottom: 10px;
                margin-bottom: 20px;
            }}
            
            /* Operation summary styling */
            .swagger-ui .opblock-summary-method {{
                background-color: {theme_config.primary_color};
                border-radius: {theme_config.border_radius};
                font-weight: bold;
            }}
            
            /* Info section styling */
            .swagger-ui .info .title {{
                color: {theme_config.primary_color};
                font-size: 2em;
                font-weight: bold;
            }}
            
            .swagger-ui .info .description {{
                color: #333;
                line-height: 1.6;
            }}
            
            /* Scheme container styling */
            .swagger-ui .scheme-container {{
                background-color: {theme_config.background_color};
                border: 1px solid #e0e0e0;
                border-radius: {theme_config.border_radius};
                padding: 15px;
                margin: 20px 0;
            }}
            
            /* Input field styling */
            .swagger-ui input[type="text"] {{
                border: 1px solid #d0d0d0;
                border-radius: {theme_config.border_radius};
                padding: 8px 12px;
                transition: border-color 0.3s ease;
            }}
            
            .swagger-ui input[type="text"]:focus {{
                border-color: {theme_config.primary_color};
                outline: none;
                box