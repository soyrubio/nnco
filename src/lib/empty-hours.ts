export interface EmptyHoursInputs {
  doctors: number;
  hoursPerWeek: number;
  emptyPercent: number;
  revenuePerHour: number;
  weeksPerYear: number;
}

export function formatRevenueInput(value: string): string {
  const [whole, ...fraction] = value.split(".");
  return [whole.replace(/\B(?=(\d{3})+(?!\d))/g, ","), ...fraction].join(".");
}

export function estimateEmptyHours(inputs: EmptyHoursInputs) {
  const { doctors, hoursPerWeek, emptyPercent, revenuePerHour, weeksPerYear } = inputs;
  if (
    Object.values(inputs).some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isInteger(doctors) || hoursPerWeek > 168 ||
    emptyPercent > 100 || weeksPerYear > 52
  ) return null;

  const annualHours = doctors * hoursPerWeek * (emptyPercent / 100) * weeksPerYear;
  const annualRevenue = annualHours * revenuePerHour;
  if (!Number.isFinite(annualHours) || !Number.isFinite(annualRevenue)) return null;
  return { annualHours, annualRevenue };
}
