import { Search } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[500px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-6 w-6 text-slate-500" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-slate-800">
            Page not found
          </h1>
          <p className="mb-6 text-sm text-slate-500">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/orders"
              className="rounded-lg bg-slate-800 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Back to orders
            </Link>
            <Link
              href="/home"
              className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
