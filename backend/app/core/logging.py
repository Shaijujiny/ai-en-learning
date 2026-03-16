import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


request_logger = logging.getLogger("app.request")
error_logger = logging.getLogger("app.error")
ai_logger = logging.getLogger("app.ai")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        started_at = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - started_at) * 1000
            request_logger.exception(
                "request_failed method=%s path=%s duration_ms=%.2f client=%s",
                request.method,
                request.url.path,
                duration_ms,
                request.client.host if request.client else "unknown",
            )
            raise

        duration_ms = (time.perf_counter() - started_at) * 1000
        request_logger.info(
            "request_completed method=%s path=%s status_code=%s duration_ms=%.2f client=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request.client.host if request.client else "unknown",
        )
        return response


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_logger.exception(
        "unhandled_exception method=%s path=%s error=%s",
        request.method,
        request.url.path,
        str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
