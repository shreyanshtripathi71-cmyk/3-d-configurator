import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span>&copy; 2026 WindowCraft. 3D Window Configurator.</span>
        <div className="footer-links">
          <Link href="/windows">Windows</Link>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </div>
    </footer>
  );
}
