'use client';

import { useState, useRef, useEffect } from 'react';
import type { Colour } from '@/data/windows';
import styles from './ColorSelector.module.css';

interface ColorSelectorProps {
  colours: Colour[];
  selected: Colour;
  onSelect: (colour: Colour) => void;
}

export default function ColorSelector({ colours, selected, onSelect }: ColorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = colours.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => {
        searchRef.current?.focus();
        const selectedEl = listRef.current?.querySelector(`.${styles.selected}`);
        selectedEl?.scrollIntoView({ block: 'center' });
      }, 50);
    }
  }, [isOpen]);

  const isLightColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 200;
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={`${styles.dropdownBtn} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span
          className={styles.swatchPreview}
          style={{
            background: selected.hex,
            borderColor: isLightColor(selected.hex) ? '#bbb' : 'transparent',
          }}
        />
        <span className={styles.colourName}>{selected.name}</span>
        <svg
          className={styles.chevron}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdownList}>
          <input
            ref={searchRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search colours..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className={styles.optionsContainer} ref={listRef}>
            {filtered.map((colour) => (
              <div
                key={colour.name}
                className={`${styles.option} ${colour.name === selected.name ? styles.selected : ''}`}
                onClick={() => {
                  onSelect(colour);
                  setIsOpen(false);
                }}
              >
                <span
                  className={styles.optSwatch}
                  style={{
                    background: colour.hex,
                    borderColor: isLightColor(colour.hex) ? '#bbb' : 'transparent',
                  }}
                />
                <span>{colour.name}</span>
                {colour.name === selected.name && (
                  <span className={styles.checkmark}>✓</span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className={styles.noResults}>No colours found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
