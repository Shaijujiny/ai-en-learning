from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


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


async def generic_exception_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "status": -1,
            "message": "Internal server error",
            "data": None,
        },
    )
