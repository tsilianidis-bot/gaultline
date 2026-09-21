export const MAJOR_STRESS_PERIODS = [
  { id: "gfc", label: "Global Financial Crisis", start: "2007-07-01", end: "2009-03-31", severity: "critical" },
  { id: "eu_debt", label: "Euro area sovereign stress", start: "2011-07-01", end: "2012-06-30", severity: "high" },
  { id: "taper_em", label: "Taper / EM stress", start: "2015-08-01", end: "2016-02-29", severity: "high" },
  { id: "volmageddon", label: "Q4 2018 drawdown", start: "2018-10-01", end: "2018-12-31", severity: "moderate" },
  { id: "covid", label: "COVID liquidity shock", start: "2020-02-20", end: "2020-04-30", severity: "critical" },
  { id: "hike_2022", label: "2022 hiking / inflation shock", start: "2022-01-03", end: "2022-10-31", severity: "high" },
] as const;
