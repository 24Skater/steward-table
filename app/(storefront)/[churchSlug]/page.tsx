interface StorefrontPageProps {
  params: Promise<{ churchSlug: string }>;
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { churchSlug } = await params;
  return (
    <main>
      <h1>Order</h1>
      {/* TODO: Implement catalog browsing, cart, guest checkout */}
      {/* Guest checkout flow — no account required */}
      {/* Sticky bottom bar for cart (slim bar, expands to bottom-sheet drawer) */}
      {/* Item detail as bottom-sheet drawer with modifier selection */}
      {/* Post-order magic-link upgrade prompt */}
      {/* TCPA SMS opt-in checkbox (unchecked by default) */}
    </main>
  );
}
