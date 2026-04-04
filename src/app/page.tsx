import Link from "next/link";
import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.nav__brand}>
          <div className={styles.nav__logo}>H</div>
          <span className={styles.nav__name}>HotelOS</span>
        </div>
        <div className={styles.nav__links}>
          <Link href="/login" className={styles.nav__link}>Sign In</Link>
          <Link href="/register" className={styles.nav__cta}>Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.hero__badge}>🚀 Built for Indian Hotels & Restaurants</div>
        <h1 className={styles.hero__title}>
          Your Hotel & Restaurant,<br />
          <span className={styles.hero__gradient}>Fully Transparent.</span>
        </h1>
        <p className={styles.hero__subtitle}>
          Track rooms, restaurant sales, expenses, salaries, and profits — all in one place.
          Real-time insights for owners. Simple interface for staff.
        </p>
        <div className={styles.hero__actions}>
          <Link href="/register" className={styles.hero__primary}>Start Free Trial</Link>
          <Link href="/login" className={styles.hero__secondary}>Sign In →</Link>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <h2 className={styles.features__title}>Everything you need to run your business</h2>
        <div className={styles.features__grid}>
          {[
            { icon: "🏨", title: "Hotel Rooms", desc: "Check-in/out, room status, guest details, payment tracking with proof uploads" },
            { icon: "🍽️", title: "Restaurant POS", desc: "KOT management, menu items, sales reports, cancellation tracking with owner alerts" },
            { icon: "💰", title: "Salaries", desc: "Track employee salaries by department, mark as paid, monthly totals" },
            { icon: "🧾", title: "Expenses", desc: "Item name, price, quantity, date, bill proof — everything accounted for" },
            { icon: "⚡", title: "Utility Bills", desc: "Electricity, water, gas bills with paid/unpaid toggle and due dates" },
            { icon: "📊", title: "Month-End Reports", desc: "Revenue vs expenses, profit/loss, weekly breakdown, calendar heatmap" },
            { icon: "📱", title: "Mobile Ready", desc: "Install as an app on your phone. Works offline. No app store needed" },
            { icon: "🔒", title: "Secure & Private", desc: "Each organization's data is completely isolated. Your data stays yours" },
          ].map((f) => (
            <div key={f.title} className={styles.feature__card}>
              <div className={styles.feature__icon}>{f.icon}</div>
              <h3 className={styles.feature__title}>{f.title}</h3>
              <p className={styles.feature__desc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <h2 className={styles.cta__title}>Ready to take control?</h2>
        <p className={styles.cta__subtitle}>Set up your hotel or restaurant in under 2 minutes. No credit card required.</p>
        <Link href="/register" className={styles.hero__primary}>Get Started Free →</Link>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} HotelOS. Built with ❤️ for the hospitality industry.</p>
      </footer>
    </div>
  );
}
