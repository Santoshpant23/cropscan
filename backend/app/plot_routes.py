from datetime import UTC, datetime
import logging

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
import httpx
from pymongo.collection import Collection

from app.ai_service import generate_plot_care_guide
from app.config import get_settings
from app.database import get_plots_collection_dependency
from app.dependencies import get_current_user
from app.models import (
    PlotCareGuideResponse,
    PlotCreate,
    PlotResponse,
    PlotTodayResponse,
    PlotTodaySignals,
    PlotUpdate,
)
from app.rate_limit import limiter

router = APIRouter(prefix="/plots", tags=["plots"])
logger = logging.getLogger(__name__)
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def _user_id(current_user: dict) -> str:
    return str(current_user["_id"])


def _plot_filter(plot_id: str, current_user: dict) -> dict:
    try:
        object_id = ObjectId(plot_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot was not found.",
        ) from exc

    return {"_id": object_id, "user_id": _user_id(current_user)}


def _serialize_plot(plot: dict) -> PlotResponse:
    return PlotResponse(
        id=str(plot["_id"]),
        userEmail=plot["user_email"],
        name=plot["name"],
        crop=plot["crop"],
        latitude=plot["latitude"],
        longitude=plot["longitude"],
        areaSqFt=plot["area_sq_ft"],
        locationLabel=plot.get("location_label"),
        locationSource=plot.get("location_source") or "manual",
        notes=plot.get("notes") or "",
        createdAt=plot["created_at"],
        updatedAt=plot["updated_at"],
    )


def _first_number(values: object) -> float | None:
    if not isinstance(values, list) or not values:
        return None
    value = values[0]
    if isinstance(value, int | float):
        return float(value)
    return None


def _sum_numbers(values: object, limit: int = 3) -> float:
    if not isinstance(values, list):
        return 0.0
    total = 0.0
    for value in values[:limit]:
        if isinstance(value, int | float):
            total += float(value)
    return round(total, 2)


def _max_probability(values: object, limit: int = 3) -> float:
    if not isinstance(values, list):
        return 0.0
    probabilities = [
        float(value) / 100
        for value in values[:limit]
        if isinstance(value, int | float)
    ]
    return round(max(probabilities, default=0.0), 2)


def _frost_probability(low_f: float | None) -> float:
    if low_f is None:
        return 0.0
    if low_f <= 32:
        return 0.85
    if low_f <= 36:
        return 0.55
    if low_f <= 40:
        return 0.25
    return 0.03


def _seasonal_weather_fallback(latitude: float) -> dict:
    month = datetime.now(UTC).month
    if latitude < 0:
        month = ((month + 5) % 12) + 1
    if month in {12, 1, 2}:
        low_f, high_f, rain_inches, rain_probability = 24.0, 39.0, 0.05, 0.15
    elif month in {3, 4, 11}:
        low_f, high_f, rain_inches, rain_probability = 38.0, 61.0, 0.12, 0.35
    elif month in {5, 10}:
        low_f, high_f, rain_inches, rain_probability = 45.0, 72.0, 0.18, 0.4
    else:
        low_f, high_f, rain_inches, rain_probability = 67.0, 88.0, 0.08, 0.25

    return {
        "tonight_low_f": low_f,
        "today_high_f": high_f,
        "next_rain_inches": rain_inches,
        "rain_probability": rain_probability,
        "source": "seasonal fallback",
    }


def _fetch_weather_for_plot(plot: dict) -> dict:
    params = {
        "latitude": plot["latitude"],
        "longitude": plot["longitude"],
        "daily": ",".join(
            [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
            ]
        ),
        "temperature_unit": "fahrenheit",
        "precipitation_unit": "inch",
        "timezone": "auto",
        "forecast_days": 3,
    }
    try:
        with httpx.Client(timeout=6) as client:
            response = client.get(OPEN_METEO_FORECAST_URL, params=params)
            response.raise_for_status()
        daily = response.json().get("daily") or {}
        return {
            "tonight_low_f": _first_number(daily.get("temperature_2m_min")),
            "today_high_f": _first_number(daily.get("temperature_2m_max")),
            "next_rain_inches": _sum_numbers(daily.get("precipitation_sum")),
            "rain_probability": _max_probability(
                daily.get("precipitation_probability_max")
            ),
            "source": "Open-Meteo",
        }
    except Exception:
        logger.exception("Open-Meteo forecast lookup failed for plot %s.", plot["_id"])
        return _seasonal_weather_fallback(float(plot["latitude"]))


def _crop_list(crop_value: str) -> list[str]:
    return [crop.strip() for crop in crop_value.split(",") if crop.strip()]


def _today_card_for_plot(plot: dict) -> PlotTodayResponse:
    weather = _fetch_weather_for_plot(plot)
    low_f = weather["tonight_low_f"]
    high_f = weather["today_high_f"]
    rain_inches = weather["next_rain_inches"]
    rain_probability = weather["rain_probability"]
    frost_probability = _frost_probability(low_f)
    heat_stress = high_f is not None and high_f >= 90
    drought_pressure = rain_inches < 0.1 and rain_probability < 0.3
    crops = _crop_list(plot["crop"])
    first_crop = crops[0] if crops else "plants"
    sensitive_crop = any(
        crop.lower() in {"tomato", "pepper", "squash", "strawberry", "grape"}
        for crop in crops
    )


@router.get("/{plot_id}", response_model=PlotResponse)
@limiter.limit("60/minute")
def get_plot(
    request: Request,
    plot_id: str,
    current_user: dict = Depends(get_current_user),
    plots_collection: Collection = Depends(get_plots_collection_dependency),
) -> PlotResponse:
    plot = plots_collection.find_one(_plot_filter(plot_id, current_user))
    if plot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot was not found.",
        )
    return _serialize_plot(plot)

    if frost_probability >= 0.55 and sensitive_crop:
        risk_level = "high"
        icon = "frost"
        headline = f"Protect {plot['name']} before sunset; frost is possible tonight."
        actions = [
            "Cover tender plants before dark.",
            "Move containers near a wall or under shelter.",
            "Wait until leaves dry before scanning tomorrow.",
        ]
    elif heat_stress:
        risk_level = "high" if high_f and high_f >= 95 else "medium"
        icon = "heat"
        headline = f"Heat stress is possible for {plot['name']} today."
        actions = [
            "Water early near the soil line, not over the leaves.",
            "Check young plants again in late afternoon.",
            "Delay pruning or spraying until cooler conditions.",
        ]
    elif drought_pressure:
        risk_level = "medium"
        icon = "dry"
        headline = f"Dry stretch ahead for {plot['name']}; check soil moisture."
        actions = [
            "Push a finger two inches into the soil before watering.",
            "Add mulch around established plants if soil is drying fast.",
            "Scan any wilted leaves before treating for disease.",
        ]
    elif rain_probability >= 0.6:
        risk_level = "medium"
        icon = "rain"
        headline = f"Rain is likely near {plot['name']}; avoid leaf-wet work."
        actions = [
            "Skip pruning while leaves are wet.",
            "Check airflow around dense growth after rain passes.",
            f"Look for new {first_crop.lower()} leaf spots in two days.",
        ]
    else:
        risk_level = "low"
        icon = "scout"
        headline = f"Good scouting window for {plot['name']}."
        actions = [
            "Walk the plot and check the newest leaves first.",
            "Look under leaves for pests before spraying anything.",
            "Take a scan if color, spots, or curling changed since yesterday.",
        ]

    return PlotTodayResponse(
        plotId=str(plot["_id"]),
        plotName=plot["name"],
        crop=plot["crop"],
        headline=headline,
        riskLevel=risk_level,
        icon=icon,
        actions=actions,
        signals=PlotTodaySignals(
            tonightLowF=low_f,
            todayHighF=high_f,
            frostProbability=frost_probability,
            nextRainInches=rain_inches,
            rainProbability=rain_probability,
            heatStress=heat_stress,
            droughtPressure=drought_pressure,
            source=weather["source"],
        ),
        generatedAt=datetime.now(UTC),
    )


@router.get("", response_model=list[PlotResponse])
@limiter.limit("60/minute")
def list_plots(
    request: Request,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    plots_collection: Collection = Depends(get_plots_collection_dependency),
) -> list[PlotResponse]:
    plots = plots_collection.find({"user_id": _user_id(current_user)}).sort(
        "created_at", -1
    )
    return [_serialize_plot(plot) for plot in plots.skip(skip).limit(limit)]


@router.post("", response_model=PlotResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def create_plot(
    request: Request,
    payload: PlotCreate,
    current_user: dict = Depends(get_current_user),
    plots_collection: Collection = Depends(get_plots_collection_dependency),
) -> PlotResponse:
    now = datetime.now(UTC)
    if plots_collection.count_documents(
        {"user_id": _user_id(current_user)}
    ) >= get_settings().max_plots_per_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Plot list is full. Delete an old plot before adding another.",
        )

    plot_document = {
        "user_id": _user_id(current_user),
        "user_email": current_user["email"],
        "name": payload.name.strip(),
        "crop": payload.crop.strip(),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "area_sq_ft": payload.areaSqFt,
        "location_label": payload.locationLabel,
        "location_source": payload.locationSource,
        "notes": payload.notes.strip(),
        "created_at": now,
        "updated_at": now,
    }
    result = plots_collection.insert_one(plot_document)
    saved_plot = plots_collection.find_one({"_id": result.inserted_id})
    return _serialize_plot(saved_plot)


@router.get("/{plot_id}/today", response_model=PlotTodayResponse)
@limiter.limit("60/minute")
def get_plot_today(
    request: Request,
    plot_id: str,
    current_user: dict = Depends(get_current_user),
    plots_collection: Collection = Depends(get_plots_collection_dependency),
) -> PlotTodayResponse:
    plot = plots_collection.find_one(_plot_filter(plot_id, current_user))
    if plot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot was not found.",
        )
    return _today_card_for_plot(plot)


@router.get("/{plot_id}/care-guide", response_model=PlotCareGuideResponse)
@limiter.limit("30/minute")
def get_plot_care_guide(
    request: Request,
    plot_id: str,
    current_user: dict = Depends(get_current_user),
    plots_collection: Collection = Depends(get_plots_collection_dependency),
) -> PlotCareGuideResponse:
    plot = plots_collection.find_one(_plot_filter(plot_id, current_user))
    if plot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot was not found.",
        )

    today_card = _today_card_for_plot(plot).model_dump(mode="json")
    return PlotCareGuideResponse.model_validate(
        generate_plot_care_guide(plot, today_card)
    )


@router.patch("/{plot_id}", response_model=PlotResponse)
@limiter.limit("60/minute")
def update_plot(
    request: Request,
    plot_id: str,
    payload: PlotUpdate,
    current_user: dict = Depends(get_current_user),
    plots_collection: Collection = Depends(get_plots_collection_dependency),
) -> PlotResponse:
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one plot field to update.",
        )

    if "name" in updates:
        updates["name"] = updates["name"].strip()
    if "crop" in updates:
        updates["crop"] = updates["crop"].strip()
    if "notes" in updates:
        updates["notes"] = updates["notes"].strip()
    if "areaSqFt" in updates:
        updates["area_sq_ft"] = updates.pop("areaSqFt")
    if "locationLabel" in updates:
        updates["location_label"] = updates.pop("locationLabel")
    if "locationSource" in updates:
        updates["location_source"] = updates.pop("locationSource")
    updates["updated_at"] = datetime.now(UTC)

    result = plots_collection.update_one(
        _plot_filter(plot_id, current_user),
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot was not found.",
        )

    saved_plot = plots_collection.find_one(_plot_filter(plot_id, current_user))
    if saved_plot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot was not found.",
        )
    return _serialize_plot(saved_plot)


@router.delete("/{plot_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
def delete_plot(
    request: Request,
    plot_id: str,
    current_user: dict = Depends(get_current_user),
    plots_collection: Collection = Depends(get_plots_collection_dependency),
) -> None:
    result = plots_collection.delete_one(_plot_filter(plot_id, current_user))
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot was not found.",
        )
