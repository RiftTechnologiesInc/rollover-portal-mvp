import Header from '../components/Header'
import './pages.css'

export default function Landing() {
  return (
    <div className="page landing-page">
      <Header />
      <main className="hero">
        <h1 className="hero-title">Welcome to Rift</h1>
        <p className="hero-sub">Simple, focused product — placeholder text.</p>
        <button className="primary">Request Demo</button>
      </main>

      <section className="value-prop">
        <h2>Why choose us?</h2>
        <p>Short value proposition goes here. Placeholder copy describing benefits.</p>
      </section>
    </div>
  )
}
