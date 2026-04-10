from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import math
from typing import Any


FIVE_MINUTES = 5.0
HALF_WINDOW = 2.5


@dataclass(frozen=True)
class TimedRecord:
    timestamp: datetime
    values: dict[str, Any]


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip().upper() == "ND":
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return False


def _to_number(value: Any) -> float | None:
    if _is_missing(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        raw = value.strip().replace(",", ".")
        try:
            return float(raw)
        except ValueError:
            return None
    return None


def _parse_timestamp(record: dict[str, Any]) -> datetime:
    lowered = {str(key).lower(): key for key in record.keys()}

    if "fecha" in lowered and "hora" in lowered:
        fecha = str(record[lowered["fecha"]]).strip()
        hora = str(record[lowered["hora"]]).strip()
        return datetime.strptime(f"{fecha} {hora}", "%d/%m/%Y %H:%M:%S")

    combined_candidates = [
        "fecha_hora",
        "fechahora",
        "datetime",
        "timestamp",
        "date_time",
    ]
    for candidate in combined_candidates:
        if candidate in lowered:
            raw = str(record[lowered[candidate]]).strip()
            for fmt in (
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%y %H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
            ):
                try:
                    return datetime.strptime(raw, fmt)
                except ValueError:
                    continue

    raise ValueError("Cada registro debe incluir fecha/hora valida en formato dd/mm/yyyy HH:MM:SS")


def _floor_to_five_minutes(value: datetime) -> datetime:
    return value.replace(minute=value.minute - (value.minute % 5), second=0, microsecond=0)


def _measurement_keys(data: list[dict[str, Any]]) -> list[str]:
    ignored = {
        "fecha",
        "hora",
        "fecha_hora",
        "fechahora",
        "datetime",
        "timestamp",
        "date_time",
    }
    keys: list[str] = []
    seen: set[str] = set()
    for row in data:
        for key in row.keys():
            normalized = str(key).lower()
            if normalized in ignored or key in seen:
                continue
            seen.add(key)
            keys.append(key)
    return keys


def _nearest_previous(t: datetime, key: str, records: list[TimedRecord]) -> TimedRecord | None:
    for item in reversed(records):
        if item.timestamp > t:
            continue
        value = item.values.get(key)
        if _is_missing(value):
            continue
        return item
    return None


def _nearest_next(t: datetime, key: str, records: list[TimedRecord]) -> TimedRecord | None:
    for item in records:
        if item.timestamp < t:
            continue
        value = item.values.get(key)
        if _is_missing(value):
            continue
        return item
    return None


def _distance_minutes(target: datetime, candidate: TimedRecord | None) -> float:
    if candidate is None:
        return float("inf")
    return abs((target - candidate.timestamp).total_seconds()) / 60.0


def _format_value(value: float) -> float:
    return round(value, 2)


def _resolve_value(t: datetime, key: str, records: list[TimedRecord]) -> Any:
    prev_item = _nearest_previous(t, key, records)
    next_item = _nearest_next(t, key, records)

    d1 = _distance_minutes(t, prev_item)
    d2 = _distance_minutes(t, next_item)

    if prev_item is not None and next_item is not None and prev_item.timestamp == t and next_item.timestamp == t:
        return prev_item.values[key]

    # TODO: validar regla PDF (umbral estricto de 2.5 min para interpolacion en ambos lados)
    if d1 < HALF_WINDOW and d2 < HALF_WINDOW:
        v1 = prev_item.values[key] if prev_item else None
        v2 = next_item.values[key] if next_item else None

        n1 = _to_number(v1)
        n2 = _to_number(v2)

        if n1 is not None and n2 is not None:
            denominator = d1 + d2
            if denominator == 0:
                return _format_value(n1)
            interpolated = n1 + (n2 - n1) * (d1 / denominator)
            return _format_value(interpolated)

        if d1 <= d2:
            return v1 if v1 is not None else "ND"
        return v2 if v2 is not None else "ND"

    if d1 < HALF_WINDOW and d2 > FIVE_MINUTES:
        return prev_item.values[key] if prev_item else "ND"

    if d1 > FIVE_MINUTES and d2 < HALF_WINDOW:
        return next_item.values[key] if next_item else "ND"

    # TODO: manejar ND
    return "ND"


def homogenize(data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not data:
        raise ValueError("La entrada no puede estar vacia")

    parsed_records = [TimedRecord(timestamp=_parse_timestamp(item), values=item) for item in data]
    records = sorted(parsed_records, key=lambda item: item.timestamp)

    measurement_keys = _measurement_keys(data)
    if not measurement_keys:
        raise ValueError("No se encontraron variables para homogenizar")

    start = _floor_to_five_minutes(records[0].timestamp)
    end = _floor_to_five_minutes(records[-1].timestamp)

    output: list[dict[str, Any]] = []
    current = start
    step = timedelta(minutes=5)

    while current <= end:
        row: dict[str, Any] = {
            "Fecha": f"{current.day}/{current.month}/{current.year}",
            "Hora": current.strftime("%H:%M:%S"),
        }

        for key in measurement_keys:
            row[key] = _resolve_value(current, key, records)

        output.append(row)
        current += step

    return output
