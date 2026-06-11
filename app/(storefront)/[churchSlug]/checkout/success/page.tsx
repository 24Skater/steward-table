export default async function CheckoutSuccessPage({
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
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Order placed!</h1>

        <p className="text-slate-600 text-sm">
          Your order has been received. You will be notified when it is ready.
        </p>

        {orderId && (
          <p className="text-slate-400 text-xs font-mono">
            Order ID: {orderId.slice(-8).toUpperCase()}
          </p>
        )}

        <a
          href={`/${churchSlug}/menu`}
          className="inline-block mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          Back to menu
        </a>
      </div>
    </main>
  );
}
