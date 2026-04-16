'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ConfigDropdown.module.css';

interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
  priceAddon?: number;
  description?: string;
}

interface ConfigDropdownProps {
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  helpText?: string;
  showPriceAddon?: boolean;
}

export default function ConfigDropdown({
  label,
  options,
  value,
  onChange,
  helpText,
  showPriceAddon = true,
}: ConfigDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.field} ref={containerRef}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        {helpText && (
          <span className={styles.helpIcon} title={helpText}>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#999" strokeWidth="1.5">
              <circle cx="10" cy="10" r="8" />
              <path d="M7.5 7.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" strokeLinecap="round" />
              <circle cx="10" cy="15" r="0.5" fill="#999" />
            </svg>
          </span>
        )}
      </div>
      <button
        className={`${styles.selector} ${isOpen ? styles.selectorOpen : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {selected.icon && <span className={styles.optionIcon}>{selected.icon}</span>}
        <span className={styles.selectedLabel}>{selected.label}</span>
        {showPriceAddon && selected.priceAddon !== undefined && selected.priceAddon > 0 && (
          <span className={styles.priceTag}>+ ${selected.priceAddon.toFixed(2)}</span>
        )}
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.option} ${opt.value === value ? styles.optionActive : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              type="button"
            >
              {opt.icon && <span className={styles.optionIcon}>{opt.icon}</span>}
              <div className={styles.optionInfo}>
                <span className={styles.optionLabel}>{opt.label}</span>
                {opt.description && (
                  <span className={styles.optionDesc}>{opt.description}</span>
                )}
              </div>
              {showPriceAddon && opt.priceAddon !== undefined && opt.priceAddon > 0 && (
                <span className={styles.optionPrice}>+ ${opt.priceAddon.toFixed(2)}</span>
              )}
              {opt.value === value && (
                <svg className={styles.checkmark} viewBox="0 0 20 20" width="16" height="16" fill="#111">
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
