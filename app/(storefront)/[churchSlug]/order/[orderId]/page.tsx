interface OrderStatusPageProps {
  params: Promise<{ churchSlug: string; orderId: string }>;
}

export default async function OrderStatusPage({ params }: OrderStatusPageProps) {
  const { churchSlug, orderId } = await params;
  return (
    <main>
      <h1>Order Status</h1>
      {/* TODO: Order tracking timeline */}
    </main>
  );
}
