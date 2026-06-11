export default async function CheckoutCancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ churchSlug: string }>;
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { churchSlug } = await params;
  const { orderId } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Payment cancelled</h1>

        <p className="text-slate-600 text-sm">
          Your payment was not completed. Your order has not been placed.
        </p>

        {orderId && (
          <p className="text-slate-400 text-xs font-mono">
            Order ID: {orderId.slice(-8).toUpperCase()}
          </p>
        )}

        <div className="flex flex-col gap-2 mt-4">
          <a
            href={`/${churchSlug}/checkout`}
            className="inline-block px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Try again
          </a>
          <a
            href={`/${churchSlug}/menu`}
            className="inline-block px-5 py-2.5 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Back to menu
          </a>
        </div>
      </div>
    </main>
  );
}
