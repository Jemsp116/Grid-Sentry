"""
Grid Sentry Client - Python Core Implementation
Zero heavy dependencies (uses standard urllib.request / threading by default).
"""

from __future__ import annotations
import datetime
import json
import threading
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional, Union


class GridSentry:
    """
    Synchronous Grid Sentry Client with non-blocking background queue flushing.
    """

    _default_instance: Optional[GridSentry] = None

    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:4000",
        app_name: str = "python-service",
        batch_size: int = 25,
        flush_interval_seconds: float = 0.5,
        disabled: bool = False,
        auto_start_worker: bool = True,
    ):
        if not api_key:
            raise ValueError("[GridSentry] Missing required 'api_key'.")

        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.app_name = app_name
        self.batch_size = max(1, batch_size)
        self.flush_interval = max(0.1, flush_interval_seconds)
        self.disabled = disabled

        self._buffer: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

        # Background flush worker
        self._worker_thread = threading.Thread(
            target=self._background_worker, daemon=True
        )
        if not self.disabled and auto_start_worker:
            self._worker_thread.start()

    @classmethod
    def init(
        cls,
        api_key: str,
        base_url: str = "http://localhost:4000",
        app_name: str = "python-service",
        **kwargs: Any,
    ) -> GridSentry:
        """Initialize singleton instance."""
        instance = cls(api_key=api_key, base_url=base_url, app_name=app_name, **kwargs)
        cls._default_instance = instance
        return instance

    @classmethod
    def get_instance(cls) -> GridSentry:
        """Retrieve initialized singleton instance."""
        if cls._default_instance is None:
            raise RuntimeError(
                "[GridSentry] GridSentry is not initialized. Please call GridSentry.init(api_key='...') first."
            )
        return cls._default_instance

    @classmethod
    def log_event(
        cls,
        event_type: str,
        user_identifier: Optional[str] = None,
        raw_message: Optional[str] = None,
        source_ip: str = "127.0.0.1",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log event using singleton instance."""
        cls.get_instance().log(
            event_type=event_type,
            user_identifier=user_identifier,
            raw_message=raw_message,
            source_ip=source_ip,
            details=details,
        )

    def log(
        self,
        event_type: str,
        user_identifier: Optional[str] = None,
        raw_message: Optional[str] = None,
        source_ip: str = "127.0.0.1",
        details: Optional[Dict[str, Any]] = None,
        timestamp: Optional[str] = None,
    ) -> None:
        """
        Buffer a log event for background shipping.
        """
        if self.disabled:
            return

        ts = timestamp or datetime.datetime.now(datetime.timezone.utc).isoformat()
        msg = raw_message or f"[{self.app_name}] {event_type}"

        event: Dict[str, Any] = {
            "timestamp": ts,
            "event_type": event_type or "custom_event",
            "source_ip": source_ip or "127.0.0.1",
            "raw_message": msg,
            "details": details or {},
        }
        if user_identifier:
            event["user_identifier"] = user_identifier

        with self._lock:
            self._buffer.append(event)
            should_flush_now = len(self._buffer) >= self.batch_size

        if should_flush_now:
            self.flush()

    def login_success(self, user_email: str, details: Optional[Dict[str, Any]] = None) -> None:
        """Helper for user login success events."""
        self.log(
            event_type="user_login_success",
            user_identifier=user_email,
            raw_message=f"User {user_email} logged in successfully",
            details=details,
        )

    def login_failure(
        self,
        user_email: str,
        reason: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Helper for failed authentication attempts."""
        d = dict(details or {})
        if reason:
            d["reason"] = reason
        self.log(
            event_type="user_login_failed",
            user_identifier=user_email,
            raw_message=f"Failed login attempt for {user_email}{f': {reason}' if reason else ''}",
            details=d,
        )

    def error(self, err: Union[Exception, str], details: Optional[Dict[str, Any]] = None) -> None:
        """Helper for logging exceptions and application errors."""
        msg = str(err)
        d = dict(details or {})
        self.log(
            event_type="application_error",
            raw_message=f"Application exception: {msg}",
            details=d,
        )

    def flush(self) -> int:
        """
        Immediately send all buffered events to Grid Sentry over HTTP.
        Resilient: network/API exceptions are never raised into the caller.
        """
        with self._lock:
            if not self._buffer or self.disabled:
                return 0
            batch = list(self._buffer)
            self._buffer.clear()

        url = f"{self.base_url}/api/logs/ingest"
        data = json.dumps(batch).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": self.api_key,
                "User-Agent": f"GridSentry-Python/1.0 ({self.app_name})",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                return len(batch) if response.status == 200 else 0
        except Exception:
            # Guaranteed safe: Telemetry failure never crashes calling Python app
            return 0

    def _background_worker(self) -> None:
        while not self._stop_event.is_set():
            time.sleep(self.flush_interval)
            try:
                self.flush()
            except Exception:
                pass

    def close(self) -> None:
        """Stop background worker and flush remaining events."""
        self._stop_event.set()
        self.flush()


class AsyncGridSentry:
    """
    Asynchronous Grid Sentry Client for asyncio / FastAPI / Tornado / Sanic applications.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:4000",
        app_name: str = "python-async-service",
    ):
        if not api_key:
            raise ValueError("[GridSentry] Missing required 'api_key'.")

        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.app_name = app_name

    async def log(
        self,
        event_type: str,
        user_identifier: Optional[str] = None,
        raw_message: Optional[str] = None,
        source_ip: str = "127.0.0.1",
        details: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Fire-and-forget log event without blocking the event loop."""
        ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
        event = {
            "timestamp": ts,
            "event_type": event_type or "custom_event",
            "source_ip": source_ip,
            "user_identifier": user_identifier,
            "raw_message": raw_message or f"[{self.app_name}] {event_type}",
            "details": details or {},
        }

        # Uses standard urllib in thread pool or simple fire-and-forget
        def _send() -> None:
            try:
                url = f"{self.base_url}/api/logs/ingest"
                data = json.dumps([event]).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={
                        "Content-Type": "application/json",
                        "X-API-Key": self.api_key,
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=3):
                    pass
            except Exception:
                pass

        threading.Thread(target=_send, daemon=True).start()
        return True
