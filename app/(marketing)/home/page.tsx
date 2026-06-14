import { CheckCircle, CreditCard, Github, Monitor } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Steward Table
          </span>
          <nav className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              GitHub
            </a>
            <a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Docs
            </a>
            <Link
              href="/auth/sign-in"
              className="text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-md transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 mb-8">
                Free &amp; open source — AGPL-3.0
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-slate-900 mb-6">
                Order management
                <br />
                <span className="text-emerald-600">built for churches.</span>
              </h1>
              <p className="text-xl text-slate-500 leading-relaxed mb-10 max-w-lg">
                A free, open-source platform for food ministries — tamales, pupusas, holiday
                dinners. No platform fees. Your data, your Stripe keys.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/auth/sign-in"
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-md transition-colors text-sm"
                >
                  Get started free
                </Link>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-medium px-6 py-3 rounded-md transition-colors text-sm bg-white"
                >
                  <Github className="w-4 h-4" />
                  View on GitHub
                </a>
              </div>
            </div>

            {/* App screenshot — orders dashboard */}
            <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-slate-200">
              <Image
                src="/screenshots/dashboard-orders.png"
                alt="Steward Table orders dashboard showing real-time order management"
                width={1440}
                height={900}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-slate-50 border-y border-slate-100">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-12 text-center">
              Built around how your ministry actually works
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-5">
                  <Monitor className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Kitchen-first design</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Large touch targets, WakeLock API to keep the screen on, and instant order
                  updates. Built for cooks with flour on their hands.
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-5">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">No platform fees</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Bring your own Stripe keys. Every dollar your congregation pays goes directly to
                  your ministry — not to a middleman.
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-5">
                  <Github className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Open source</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  MIT licensed. Self-host on your own infrastructure, or use our managed service.
                  Audit the code, fork it, contribute to it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              From catalog to kitchen in minutes
            </h2>
            <p className="text-slate-500">Set up your church once, then focus on your ministry.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Create your church and catalog",
                body: "Add your menu items, set prices, and configure pickup windows.",
              },
              {
                step: "02",
                title: "Share your menu link",
                body: "Your congregation visits your storefront link and places orders — no app download needed.",
              },
              {
                step: "03",
                title: "Watch orders flow to the kitchen",
                body: "Orders appear on the kitchen display in real time. Cooks see exactly what to make.",
              },
              {
                step: "04",
                title: "Mark ready and fulfill",
                body: "Mark orders ready when done. Drivers and staff see fulfillment status live.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="relative">
                <div className="text-5xl font-bold text-slate-100 leading-none mb-4 select-none">
                  {step}
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-10 text-center">
              Built on proven open-source technology
            </p>
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
              {["Next.js 15", "Prisma ORM", "PostgreSQL", "Auth.js", "Stripe", "Resend"].map(
                (tech) => (
                  <span
                    key={tech}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-default"
                  >
                    {tech}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* Role matrix / trust section */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Every role. Every need.</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Steward Table ships with six roles out of the box. Each person on your team sees
                exactly what they need — nothing more.
              </p>
              <ul className="space-y-3">
                {[
                  ["Owner", "Full control over settings, billing, and team"],
                  ["Admin", "Manage catalog, staff, and orders"],
                  ["Staff", "Process and fulfill orders"],
                  ["Cook", "Kitchen display — no distractions"],
                  ["Driver", "Fulfillment queue and delivery view"],
                  ["Viewer", "Read-only dashboard access"],
                ].map(([role, desc]) => (
                  <li key={role} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-800">{role}</span> — {desc}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* App screenshot — kitchen display */}
            <div className="rounded-xl overflow-hidden shadow-xl ring-1 ring-slate-800">
              <Image
                src="/screenshots/kitchen-display.png"
                alt="Steward Table kitchen display showing live order queue"
                width={1440}
                height={900}
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-emerald-600">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Start taking orders today</h2>
            <p className="text-emerald-100 mb-8 text-lg">
              Free forever for self-hosted. Managed hosting available.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/auth/sign-in"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-emerald-700 font-semibold px-6 py-3 rounded-md transition-colors text-sm"
              >
                Get started
              </Link>
              <a
                href="#"
                className="inline-flex items-center gap-2 border border-emerald-400 hover:border-white text-white font-medium px-6 py-3 rounded-md transition-colors text-sm"
              >
                Read the docs
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">Steward Table is open source. AGPL-3.0.</p>
          <nav className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
              GitHub
            </a>
            <a href="#" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
              Documentation
            </a>
            <Link
              href="/auth/sign-in"
              className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
