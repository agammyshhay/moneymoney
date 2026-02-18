import React, { useCallback, useRef, useState } from 'react';
import styles from './AccountsContainer.module.css';

interface AccountsContainerProps {
  title: string;
  children: React.ReactNode;
  accountsCount: number;
  onAddAccount?: () => void;
}

function AccountsContainer({ title, children, accountsCount, onAddAccount }: AccountsContainerProps) {
  const isGrid = accountsCount > 4;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isScrollable = el.scrollHeight > el.clientHeight;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setShowFade(isScrollable && !isAtBottom);
  }, []);

  const refCallback = useCallback(
    (node: HTMLDivElement | null) => {
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (node) {
        const isScrollable = node.scrollHeight > node.clientHeight;
        setShowFade(isScrollable);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountsCount],
  );

  return (
    <div className={`${styles.container} ${isGrid ? styles.gridContainer : styles.listContainer}`}>
      <div className={styles.titleRow}>
        <h3 className={styles.title}>{title}</h3>
        {onAddAccount && (
          <button type="button" className={styles.addAccountLink} onClick={onAddAccount}>
            <i className="bi bi-plus-lg" />
            <span>הוסף חשבון</span>
          </button>
        )}
      </div>
      <div className={styles.scrollContainer}>
        <div
          ref={refCallback}
          onScroll={handleScroll}
          className={`${styles.accountsWrapper} ${isGrid ? styles.gridWrapper : styles.listWrapper}`}
        >
          {children}
        </div>
        {showFade && <div className={styles.scrollFade} />}
      </div>
    </div>
  );
}

export default AccountsContainer;
