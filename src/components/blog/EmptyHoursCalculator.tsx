import { useId, useState } from "react";
import { estimateEmptyHours, formatRevenueInput } from "@/lib/empty-hours";
import "./clinic-article.css";

const fields = [
  { key: "doctors", label: "Doctors", initial: "40", step: 1 },
  { key: "hoursPerWeek", label: "Bookable hours per doctor per week", initial: "30", step: "any", max: 168 },
  { key: "emptyPercent", label: "Bookable hours lost to no-shows or unfilled cancellations", initial: "8", step: "any", max: 100 },
  { key: "revenuePerHour", label: "Revenue per doctor-hour", initial: "2500", step: "any" },
  { key: "weeksPerYear", label: "Working weeks per year", initial: "48", step: "any", max: 52 },
] as const;

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export default function EmptyHoursCalculator() {
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, field.initial])));
  const result = fields.some(({ key }) => values[key].trim() === "") ? null : estimateEmptyHours({
    doctors: Number(values.doctors),
    hoursPerWeek: Number(values.hoursPerWeek),
    emptyPercent: Number(values.emptyPercent),
    revenuePerHour: Number(values.revenuePerHour),
    weeksPerYear: Number(values.weeksPerYear),
  });

  return (
    <section className="empty-hours" aria-label="Empty capacity calculator" aria-describedby={`${id}-note`}>
      <div className="empty-hours__inputs">
        {fields.map((field) => (
          <div className="form-control" key={field.key}>
            <label className="form-control__label" htmlFor={`${id}-${field.key}`}>{field.label}</label>
            <input
              id={`${id}-${field.key}`}
              type={field.key === "revenuePerHour" ? "text" : "number"}
              inputMode={field.key === "revenuePerHour" ? "decimal" : undefined}
              className={field.key === "revenuePerHour" ? "empty-hours__currency-input" : undefined}
              aria-label={field.key === "emptyPercent" ? `${field.label}, percent` : field.key === "revenuePerHour" ? `${field.label}, Czech crowns` : undefined}
              min={0}
              max={"max" in field ? field.max : undefined}
              step={field.step}
              required
              value={field.key === "revenuePerHour" ? formatRevenueInput(values[field.key]) : values[field.key]}
              onChange={(event) => setValues({ ...values, [field.key]: field.key === "revenuePerHour" ? event.target.value.replace(/,/g, "") : event.target.value })}
            />
            {field.key === "emptyPercent" && (
              <span className="empty-hours__unit" aria-hidden="true">
                <span>{values[field.key]}</span>%
              </span>
            )}
            {field.key === "revenuePerHour" && <span className="empty-hours__unit" aria-hidden="true">CZK</span>}
            <div className="empty-hours__steppers">
              {([-1, 1] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-label={`${direction < 0 ? "Decrease" : "Increase"} ${field.label}`}
                  aria-controls={`${id}-${field.key}`}
                  disabled={direction < 0 ? Number(values[field.key]) <= 0 : "max" in field && Number(values[field.key]) >= field.max}
                  onClick={() => setValues((current) => ({
                    ...current,
                    [field.key]: String(Math.min("max" in field ? field.max : Number.MAX_SAFE_INTEGER,
                      Math.max(0, (Number(current[field.key]) || 0) + direction))),
                  }))}
                >{direction < 0 ? "−" : "+"}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="empty-hours__result" aria-live="polite" aria-atomic="true">
        {result ? <>
          <div><span>Unfilled appointment hours per year</span><strong>{number.format(result.annualHours)}</strong></div>
          <div><span>Potential annual revenue lost to empty slots</span><strong>CZK {number.format(result.annualRevenue)}</strong></div>
        </> : <span>Enter valid, non-negative values in all five fields. Use a whole number of doctors, up to 168 hours per week, 100% empty share and 52 weeks per year.</span>}
      </div>
      <p id={`${id}-note`}>Estimated revenue if those slots had been filled at the entered hourly rate. Not lost profit; some empty slots may not be recoverable. Inputs stay in your browser.</p>
      <noscript>Enable JavaScript to change the estimate. The example above works without it.</noscript>
    </section>
  );
}
