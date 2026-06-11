"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface CancelOrderButtonProps {
  orderId: string
}

export function CancelOrderButton({ orderId }: CancelOrderButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this order?")) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/storefront/orders/${orderId}/cancel`, {
        method: "POST",
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        setError(body.error ?? "Failed to cancel order")
        return
      }
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 text-center">
      {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
      <button
        onClick={handleCancel}
        disabled={loading}
        className="text-sm text-red-500 underline-offset-2 hover:underline disabled:opacity-50"
      >
        {loading ? "Canceling…" : "Cancel order"}
      </button>
    </div>
  )
}
