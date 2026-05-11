from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings


def rate_limit_key(request) -> str:
    settings = get_settings()
    if settings.trust_proxy_headers:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for:
            return forwarded_for.split(",", 1)[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()

    return get_remote_address(request)


settings = get_settings()
limiter = Limiter(
    key_func=rate_limit_key,
    storage_uri=settings.rate_limit_storage_uri,
    enabled=settings.rate_limit_enabled,
)
