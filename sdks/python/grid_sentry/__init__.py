"""
Grid Sentry Python Client SDK
Official client for streaming telemetry into the Grid Sentry SOC & SIEM platform.

WARNING: Server-side only. Do not use in client applications where API keys may be exposed.
"""

from .client import GridSentry, AsyncGridSentry

__all__ = ["GridSentry", "AsyncGridSentry"]
__version__ = "1.0.0"
