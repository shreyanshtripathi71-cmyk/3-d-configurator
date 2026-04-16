'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      <div className="top-bar">
        🪟 <span>Nanokad</span> — Explore our complete window collection in interactive 3D
      </div>
      <nav className="navbar">
        <Link href="/" className="navbar-brand">
          <span className="icon">🪟</span>Nanokad
        </Link>
        <ul className="navbar-nav">
          <li>
            <Link
              href="/windows"
              className={pathname?.startsWith('/windows') ? 'active' : ''}
            >
              Windows
            </Link>
          </li>
          <li>
            <Link href="/" className={styles.disabled}>
              Patio Doors
            </Link>
          </li>
          <li>
            <Link href="/" className={styles.disabled}>
              Garage Doors
            </Link>
          </li>
          <li>
            <Link href="/" className={styles.disabled}>
              Contact
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
