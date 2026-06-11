"""Suppuo Python SDK — typed client for the suppuo.com helpdesk REST API."""
from .client import SuppuoClient
from .errors import SuppuoError

__all__ = ["SuppuoClient", "SuppuoError"]
__version__ = "0.2.0"
