import React, { useState } from 'react';
import styles from './ConceptMockup.module.css';

// Importing assets for mockup purposes
// Using existing SVGs if available or placeholders
import dashboardIcon from '../assets/results.svg'; // Placeholder
import walletIcon from '../assets/piggy-bank.svg';
import historyIcon from '../assets/hourglass-top.svg';
import settingsIcon from '../assets/gear.svg';

// Bank logos placeholders
import poalimLogo from '../assets/importers/poalim.jpeg';
import leumiLogo from '../assets/importers/leumi.png';
import discountLogo from '../assets/importers/discount.jpeg';

export default function ConceptMockup() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.logoArea}>
          <div
            style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #1a73e8, #4285f4)',
              borderRadius: 8,
            }}
          />
          <span className={styles.logoText}>MoneyMoney</span>
        </div>

        <div className={styles.navMenu}>
          <NavItem
            icon={dashboardIcon}
            text="ראשי"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem
            icon={walletIcon}
            text="החיבורים שלי"
            active={activeTab === 'accounts'}
            onClick={() => setActiveTab('accounts')}
          />
          <NavItem
            icon={historyIcon}
            text="היסטוריה"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
          <div style={{ flex: 1 }}></div>
          <NavItem
            icon={settingsIcon}
            text="הגדרות"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.versionTag}>גרסה 2.0.0 (Concept)</div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div>
            <div className={styles.greeting}>שלום, משתמש</div>
            <div className={styles.date}>יום ראשון, 26 בינואר 2025</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {/* User profile placeholder */}
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#e0e0e0' }}></div>
          </div>
        </div>

        {/* Hero Section */}
        <div className={styles.heroSection}>
          <div className={styles.heroContent}>
            <div className={styles.heroTitle}>הכל מוכן לסנכרון</div>
            <div className={styles.heroSubtitle}>הסנכרון האחרון בוצע בהצלחה לפני 4 שעות</div>
          </div>
          <button className={styles.runButton}>סנכרן כעת</button>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <StatCard title="חשבונות פעילים" value="5" trend="תקין" />
          <StatCard title="טרנזקציות חדשות" value="124" trend="+12 מאתמול" />
          <StatCard title="סנכרון הבא" value="14:00" trend="אוטומטי" />
        </div>

        {/* Accounts Preview */}
        <div>
          <div className={styles.sectionTitle}>החיבורים שלי</div>
          <div className={styles.accountsGrid}>
            <AccountCard name="בנק הפועלים" logo={poalimLogo} />
            <AccountCard name="בנק לאומי" logo={leumiLogo} />
            <AccountCard name="דיסקונט" logo={discountLogo} />
            <div className={`${styles.accountCard} ${styles.addAccountCard}`}>
              <span style={{ fontSize: 24 }}>+</span>
              <span style={{ fontWeight: 600 }}>הוסף חדש</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: string;
  text: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, text, active, onClick }: NavItemProps) {
  return (
    <div className={`${styles.navItem} ${active ? styles.navItemActive : ''}`} onClick={onClick}>
      <img
        src={icon}
        className={styles.navIcon}
        style={{ filter: active ? 'sepia(100%) hue-rotate(190deg) saturate(500%)' : 'grayscale(100%) opacity(0.6)' }}
      />
      <span>{text}</span>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  trend: string;
}

function StatCard({ title, value, trend }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statTitle}>{title}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statTrend}>{trend}</div>
    </div>
  );
}

interface AccountCardProps {
  name: string;
  logo: string;
}

function AccountCard({ name, logo }: AccountCardProps) {
  return (
    <div className={styles.accountCard}>
      <img src={logo} className={styles.bankLogo} />
      <div className={styles.accountName}>{name}</div>
      <div style={{ fontSize: 12, color: '#188038', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#188038' }}></div>
        פעיל
      </div>
    </div>
  );
}
