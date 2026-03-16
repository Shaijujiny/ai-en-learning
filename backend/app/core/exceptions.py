from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import error_logger


def build_response(message: str, data=None, status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "status": 1,
            "message": message,
            "data": data,
        },
    )


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": -1,
            "message": exc.detail,
            "data": None,
        },
        headers=exc.headers,
    )


async def validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    validation_errors = exc.errors()
    first_error = validation_errors[0] if validation_errors else {}
    field_path = ".".join(str(part) for part in first_error.get("loc", [])[1:])
    field_label = field_path or "request"
    message = first_error.get("msg", "Validation error")
    return JSONResponse(
        status_code=422,
        content={
            "status": -1,
            "message": f"{field_label}: {message}",
            "data": {"errors": validation_errors},
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_logger.exception(
        "unhandled_exception method=%s path=%s error=%s",
        request.method,
        request.url.path,
        str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={
            "status": -1,
            "message": "Internal server error",
            "data": None,
        },
    )
