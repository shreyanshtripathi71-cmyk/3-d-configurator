'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { WINDOW_TYPES, COLOURS } from '@/data/windows';
import type { Colour } from '@/data/windows';
import type { ViewerControlsAPI } from '@/components/WindowViewer';
import ColorSelector from '@/components/ColorSelector';
import styles from './page.module.css';

const WindowViewer = dynamic(() => import('@/components/WindowViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', aspectRatio: '1/1', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#999', fontSize: 13 }}>Initializing 3D engine...</span>
    </div>
  ),
});

export default function WindowConfiguratorPage() {
  const params = useParams();
  const router = useRouter();
  const typeId = params.type as string;
  const windowType = WINDOW_TYPES.find((w) => w.id === typeId);

  const [selectedColour, setSelectedColour] = useState<Colour>(COLOURS.find((c) => c.name === 'White')!);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'controls'>('desc');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsRef = useRef<ViewerControlsAPI | null>(null);

  useEffect(() => {
    if (!windowType) router.replace('/windows');
  }, [windowType, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key) {
        case 'Escape': if (isFullscreen) setIsFullscreen(false); break;
        case 'ArrowUp': e.preventDefault(); controlsRef.current?.rotateUp(); break;
        case 'ArrowDown': e.preventDefault(); controlsRef.current?.rotateDown(); break;
        case 'ArrowLeft': e.preventDefault(); controlsRef.current?.rotateLeft(); break;
        case 'ArrowRight': e.preventDefault(); controlsRef.current?.rotateRight(); break;
        case '+': case '=': controlsRef.current?.zoomIn(); break;
        case '-': case '_': controlsRef.current?.zoomOut(); break;
        case 'r': case 'R': controlsRef.current?.resetView(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  if (!windowType) return null;

  return (
    <>
      {/* Top announcement bar */}
      <div className={styles.topBar}>
        Custom made windows in as quick as 10 business days
      </div>

      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/">Products</Link>
        <span className={styles.sep}>&raquo;</span>
        <Link href="/windows">Vinyl Windows</Link>
        <span className={styles.sep}>&raquo;</span>
        <span>#{WINDOW_TYPES.indexOf(windowType) + 1} - {windowType.label} Windows</span>
      </div>

      {/* ══════ PRODUCT PAGE ══════ */}
      <div className={styles.productPage}>

        {/* ── LEFT: Viewer ── */}
        <div className={styles.viewerCol}>
          <div className={`${styles.viewerWrap} ${isFullscreen ? styles.fullscreen : ''}`}>

            {/* Expand button */}
            <button className={styles.expandBtn} onClick={() => setIsFullscreen(!isFullscreen)} title="Expand">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>

            {/* 3D Canvas */}
            <WindowViewer
              modelPath={windowType.modelPath}
              typeId={windowType.id}
              colour={selectedColour}
              controlsRef={controlsRef}
              dimensions={windowType.dimensions}
            />
          </div>

          {/* Colour selector */}
          <div className={styles.colourBox}>
            <ColorSelector colours={COLOURS} selected={selectedColour} onSelect={setSelectedColour} />
          </div>

          {/* Controls — flat icons, dark and thick */}
          <div className={styles.controlsRow}>
            {/* Zoom */}
            <button className={styles.iconBtn} onClick={() => controlsRef.current?.zoomIn()} title="Zoom In">
              <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="11" cy="11" r="8" fill="none" stroke="#111" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#111" strokeWidth="2"/><line x1="11" y1="8" x2="11" y2="14" stroke="#111" strokeWidth="2"/><line x1="8" y1="11" x2="14" y2="11" stroke="#111" strokeWidth="2"/></svg>
            </button>
            <button className={styles.iconBtn} onClick={() => controlsRef.current?.zoomOut()} title="Zoom Out">
              <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="11" cy="11" r="8" fill="none" stroke="#111" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#111" strokeWidth="2"/><line x1="8" y1="11" x2="14" y2="11" stroke="#111" strokeWidth="2"/></svg>
            </button>

            <span className={styles.iconSep} />

            {/* Direction pad — cross layout */}
            <div className={styles.dpad}>
              <button className={styles.iconBtn} onClick={() => controlsRef.current?.rotateUp()} title="Up" data-pos="top">
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 19V5" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M5 12l7-7 7 7" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className={styles.iconBtn} onClick={() => controlsRef.current?.rotateLeft()} title="Left" data-pos="left">
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M19 12H5" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M12 19l-7-7 7-7" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className={styles.iconBtn} onClick={() => controlsRef.current?.rotateRight()} title="Right" data-pos="right">
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 12h14" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M12 5l7 7-7 7" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className={styles.iconBtn} onClick={() => controlsRef.current?.rotateDown()} title="Down" data-pos="bottom">
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 5v14" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M19 12l-7 7-7-7" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <span className={styles.iconSep} />

            {/* Iso + Reset */}
            <button className={styles.iconBtn} onClick={() => controlsRef.current?.isoView()} title="Isometric View">
              <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#111" strokeWidth="2" fill="none" strokeLinejoin="round"/><path d="M2 17l10 5 10-5" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12l10 5 10-5" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className={styles.iconBtn} onClick={() => controlsRef.current?.resetView()} title="Reset">
              <svg viewBox="0 0 24 24" width="24" height="24"><path d="M1 4v6h6" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <p className={styles.disclaimer}>* Image is for display purposes only.</p>
        </div>

        {/* ── RIGHT: Product Info ── */}
        <div className={styles.infoCol}>
          <h1 className={styles.title}>{windowType.label} Windows</h1>
          <div className={styles.manufacturer}>PANES WINDOW MANUFACTURING</div>
          <div className={styles.stars}>
            {[1,2,3,4,5].map(i => (
              <svg key={i} viewBox="0 0 24 24" width="22" height="22" fill="#111">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            ))}
          </div>
          <div className={styles.price}>
            STARTING FROM <span className={styles.priceVal}>{windowType.price}</span>
          </div>

          <div className={styles.buttons}>
            <button className={styles.btnBlack}>Get an instant quote</button>
            <button className={styles.btnBlue}>Browse in-stock inventory</button>
          </div>

          {/* Window Type Selector */}
          <div className={styles.typeSection}>
            <div className={styles.typeSectionTitle}>{windowType.label} Windows</div>
            <div className={styles.typeSectionSub}>DESCRIPTION</div>
          </div>

          <div className={styles.descriptionText}>
            <p>{windowType.description}</p>
          </div>

          {/* Specs */}
          <div className={styles.specsSection}>
            <div className={styles.specsSectionTitle}>SPECIFICATIONS</div>
            <ul className={styles.specsList}>
              {windowType.specs.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          {/* Window Type Buttons */}
          <div className={styles.windowTypeSection}>
            <div className={styles.windowTypeSectionTitle}>Select Window Type</div>
            <div className={styles.windowTypeGrid}>
              {WINDOW_TYPES.map((wt) => (
                <button
                  key={wt.id}
                  className={`${styles.wtBtn} ${wt.id === typeId ? styles.wtActive : ''}`}
                  onClick={() => router.push(`/windows/${wt.id}`, { scroll: false })}
                >
                  <span className={styles.wtIcon}>{wt.icon}</span>
                  <span className={styles.wtLabel}>{wt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className={styles.featuresSection}>
            <div className={styles.featuresSectionTitle}>Features</div>
            <div className={styles.featuresGrid}>
              {[
                { icon: '🔲', label: 'Glazing Options' },
                { icon: '🧊', label: 'Foam Injected' },
                { icon: '🎨', label: 'Colour Options' },
                { icon: '🛡️', label: 'Triple Seals' },
                { icon: '🔒', label: 'Multi-Point Lock' },
                { icon: '🪟', label: 'FlexScreen' },
              ].map((f) => (
                <div key={f.label} className={styles.featureCard}>
                  <div className={styles.featIcon}>{f.icon}</div>
                  <div className={styles.featLabel}>{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sticky CTA */}
      <div className={styles.bottomCta}>
        <button className={styles.bottomCtaBtn}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="white" stroke="white" strokeWidth="0">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="white" strokeWidth="2"/>
            <polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="white" strokeWidth="2"/>
          </svg>
          REQUEST IN-HOME ESTIMATE
        </button>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        &copy; 2026 WindowCraft. 3D Window Configurator.
      </footer>
    </>
  );
}
