"""Major historical stress windows used for validation only.

These windows are research labels. They are not CURRENT product truth and
are never used to fit the HMM. FAULTLINE live warning dates are included
only when a verified institutional event timestamp exists in-repo docs;
otherwise they stay empty rather than being invented.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StressPeriod:
    id: str
    label: str
    start: str
    end: str
    severity: str
    notes: str


# Inclusive calendar windows. Used as event intervals for lead-time / recall.
MAJOR_STRESS_PERIODS: tuple[StressPeriod, ...] = (
    StressPeriod("gfc", "Global Financial Crisis", "2007-07-01", "2009-03-31", "critical", "Housing/credit unwind into Lehman and equity trough."),
    StressPeriod("eu_debt", "Euro area sovereign stress", "2011-07-01", "2012-06-30", "high", "EMU periphery + US rating downgrade risk-off."),
    StressPeriod("taper_em", "Taper / EM stress", "2015-08-01", "2016-02-29", "high", "China FX + commodity + HY energy stress."),
    StressPeriod("volmageddon", "Q4 2018 drawdown", "2018-10-01", "2018-12-31", "moderate", "Tightening + growth scare equity drawdown."),
    StressPeriod("covid", "COVID liquidity shock", "2020-02-20", "2020-04-30", "critical", "Dash-for-cash; fastest equity collapse in sample."),
    StressPeriod("hike_2022", "2022 hiking / inflation shock", "2022-01-03", "2022-10-31", "high", "Policy tightening, yield shock, equity bear."),
)


# FAULTLINE live warning dates are ingested from persisted institutional events
# when the Node reader supplies them. This module does not invent dates.
FAULTLINE_WARNING_DATES: tuple[str, ...] = ()


def periods_as_dicts() -> list[dict[str, str]]:
    return [
        {
            "id": period.id,
            "label": period.label,
            "start": period.start,
            "end": period.end,
            "severity": period.severity,
            "notes": period.notes,
        }
        for period in MAJOR_STRESS_PERIODS
    ]
