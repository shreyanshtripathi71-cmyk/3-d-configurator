'use client';

import { useState } from 'react';
import type { PriceBreakdownItem } from '@/data/configuratorData';
import styles from './PriceBreakdown.module.css';

interface PriceBreakdownProps {
  total: number;
  breakdown: PriceBreakdownItem[];
}

export default function PriceBreakdown({ total, breakdown }: PriceBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Total Price</span>
        <span className={styles.totalValue}>${total.toFixed(2)}</span>
      </div>

      <button
        className={styles.breakdownToggle}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {isOpen ? 'Hide' : 'Breakdown'}
        <svg
          className={`${styles.toggleChev} ${isOpen ? styles.toggleChevOpen : ''}`}
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.breakdownList}>
          {breakdown.map((item, i) => (
            <div key={i} className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>{item.label}</span>
              <span className={styles.breakdownAmount}>
                {item.amount >= 0 ? '+' : '-'}${Math.abs(item.amount).toFixed(2)}
              </span>
            </div>
          ))}
          <div className={styles.breakdownDivider} />
          <div className={`${styles.breakdownItem} ${styles.breakdownTotal}`}>
            <span className={styles.breakdownLabel}>Total</span>
            <span className={styles.breakdownAmount}>${total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
