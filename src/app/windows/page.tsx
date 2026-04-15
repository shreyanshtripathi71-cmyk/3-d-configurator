import Link from 'next/link';
import { WINDOW_TYPES } from '@/data/windows';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from './page.module.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Windows — WindowCraft 3D Configurator',
  description:
    'Browse our complete collection of 9 vinyl window types. Configure each in interactive 3D with 70+ color options.',
};

export default function WindowsPage() {
  return (
    <>
      <Navbar />
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span className="sep">&raquo;</span>
        <span>Windows</span>
      </div>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Vinyl Windows</h1>
          <p className={styles.subtitle}>
            {WINDOW_TYPES.length} window types available &middot; Interactive 3D configurator &middot; 70+ colours
          </p>
        </div>
        <div className={styles.grid}>
          {WINDOW_TYPES.map((win) => (
            <Link
              key={win.id}
              href={`/windows/${win.id}`}
              className={styles.card}
              id={`window-card-${win.id}`}
            >
              <div className={styles.cardIcon}>{win.icon}</div>
              <div className={styles.cardContent}>
                <h2 className={styles.cardTitle}>{win.label} Windows</h2>
                <p className={styles.cardDesc}>{win.description.slice(0, 90)}...</p>
                <div className={styles.cardFooter}>
                  <div className={styles.cardPrice}>
                    <span className={styles.priceLabel}>From</span>
                    <span className={styles.priceValue}>{win.price}</span>
                  </div>
                  <div className={styles.configureBtn}>
                    Configure
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
