from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
import httpx

from app.dependencies import get_current_user
from app.rate_limit import limiter

router = APIRouter(prefix="/locations", tags=["locations"])
CENSUS_GEOCODER_URL = (
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
)
NOMINATIM_GEOCODER_URL = "https://nominatim.openstreetmap.org/search"


async def _lookup_census(address: str) -> dict | None:
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get(
            CENSUS_GEOCODER_URL,
            params={
                "address": address,
                "benchmark": "Public_AR_Current",
                "format": "json",
            },
        )
        response.raise_for_status()

    matches = response.json().get("result", {}).get("addressMatches", [])
    if not matches:
        return None

    match = matches[0]
    coordinates = match["coordinates"]
    return {
        "label": match.get("matchedAddress") or address,
        "latitude": coordinates["y"],
        "longitude": coordinates["x"],
        "source": "address",
    }


async def _lookup_nominatim(address: str) -> dict | None:
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get(
            NOMINATIM_GEOCODER_URL,
            params={"q": address, "format": "jsonv2", "limit": 1},
            headers={"User-Agent": "CropScan/1.0 (https://cropscan.tech)"},
        )
        response.raise_for_status()

    matches = response.json()
    if not isinstance(matches, list) or not matches:
        return None

    match = matches[0]
    try:
        latitude = float(match["lat"])
        longitude = float(match["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    return {
        "label": match.get("display_name") or address,
        "latitude": latitude,
        "longitude": longitude,
        "source": "address",
    }


@router.get("/geocode")
@limiter.limit("20/minute")
async def geocode_address(
    request: Request,
    address: str = Query(min_length=3, max_length=200),
    _current_user: dict = Depends(get_current_user),
) -> dict:
    lookup_error: Exception | None = None
    try:
        census_result = await _lookup_census(address)
        if census_result is not None:
            return census_result
    except httpx.HTTPError as exc:
        lookup_error = exc

    try:
        nominatim_result = await _lookup_nominatim(address)
        if nominatim_result is not None:
            return nominatim_result
    except httpx.HTTPError as exc:
        lookup_error = exc

    if lookup_error is not None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Address lookup is unavailable. Use current location instead.",
        ) from lookup_error

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="We could not find that address. Try a nearby street address or city.",
    )
