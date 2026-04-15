import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from './page.module.css';

export default function HomePage() {
  const categories = [
    {
      id: 'windows',
      title: 'Windows',
      icon: '🪟',
      description: 'Casement, awning, picture, hung, and slider windows',
      available: true,
      count: 9,
      href: '/windows',
    },
    {
      id: 'doors',
      title: 'Patio Doors',
      icon: '🚪',
      description: 'Sliding and French patio doors',
      available: false,
      count: 0,
      href: '#',
    },
    {
      id: 'garage',
      title: 'Garage Doors',
      icon: '🏠',
      description: 'Insulated and carriage-style garage doors',
      available: false,
      count: 0,
      href: '#',
    },
  ];

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Configure Your Perfect
              <span className={styles.heroHighlight}> Windows & Doors</span>
            </h1>
            <p className={styles.heroSubtext}>
              Explore our complete collection in interactive 3D. Customize colors, compare styles,
              and find the perfect fit for your home.
            </p>
          </div>
        </div>

        <div className={styles.categorySection}>
          <div className={styles.sectionLabel}>What would you like to configure?</div>
          <div className={styles.categoryGrid}>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={cat.href}
                className={`${styles.categoryCard} ${!cat.available ? styles.disabled : ''}`}
              >
                <div className={styles.categoryIcon}>{cat.icon}</div>
                <h2 className={styles.categoryTitle}>{cat.title}</h2>
                <p className={styles.categoryDesc}>{cat.description}</p>
                {cat.available ? (
                  <div className={styles.categoryAction}>
                    <span>{cat.count} types available</span>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                ) : (
                  <div className={styles.comingSoon}>Coming Soon</div>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.featuresRow}>
          {[
            { icon: '🎨', label: '70+ Colors', desc: 'Extensive palette' },
            { icon: '🔄', label: 'Interactive 3D', desc: 'Rotate & zoom' },
            { icon: '⚡', label: 'Instant Quote', desc: 'Real-time pricing' },
            { icon: '📐', label: 'Custom Sizes', desc: 'Made to order' },
          ].map((f) => (
            <div key={f.label} className={styles.featureItem}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <div>
                <div className={styles.featureLabel}>{f.label}</div>
                <div className={styles.featureDesc}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
