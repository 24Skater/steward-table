interface OrderProgressProps {
  status: string
  fulfillment: string
}

const PICKUP_STEPS = [
  { key: "SUBMITTED", label: "Received" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_KITCHEN", label: "In Kitchen" },
  { key: "READY", label: "Ready" },
  { key: "AWAITING_PICKUP", label: "Awaiting Pickup" },
  { key: "PICKED_UP", label: "Picked Up" },
]

const DELIVERY_STEPS = [
  { key: "SUBMITTED", label: "Received" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_KITCHEN", label: "In Kitchen" },
  { key: "READY", label: "Ready" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" },
]

export function OrderProgress({ status, fulfillment }: OrderProgressProps) {
  const steps = fulfillment === "DELIVERY" ? DELIVERY_STEPS : PICKUP_STEPS

  const currentIndex = steps.findIndex((s) => s.key === status)
  // If status not in steps (e.g. CANCELED, SERVED, COMPLETED), don't show progress
  if (currentIndex === -1) return null

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Order Progress
      </h2>
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const isCompleted = i < currentIndex
          const isCurrent = i === currentIndex
          const isFuture = i > currentIndex
          const isLast = i === steps.length - 1

          return (
            <li key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? "animate-pulse bg-emerald-400 text-white"
                        : "bg-slate-200 text-slate-400",
                  ].join(" ")}
                >
                  {isCompleted ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={[
                    "mt-1 text-center text-xs leading-tight",
                    isCompleted || isCurrent ? "font-medium text-slate-700" : "text-slate-400",
                    isFuture ? "text-slate-300" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ maxWidth: "4rem", wordBreak: "break-word" }}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={[
                    "mb-5 h-0.5 flex-1",
                    i < currentIndex ? "bg-emerald-400" : "bg-slate-200",
                  ].join(" ")}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
