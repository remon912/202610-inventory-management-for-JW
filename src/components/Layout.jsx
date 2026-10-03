import { Link, NavLink, Outlet } from 'react-router-dom';
import UserGate from './UserGate.jsx';
import UserSelect from './UserSelect.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import styles from './Layout.module.css';

const navClass = ({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`;

export default function Layout() {
  const { user, isAdmin } = useCurrentUser();

  return (
    <>
      <a href="#main" className={`${styles.skip} no-print`}>
        본문으로 건너뛰기
      </a>
      <header className={`${styles.header} no-print`}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand}>
            <img src="/favicon.svg" alt="" width="28" height="28" />
            재고관리
          </Link>
          {user && (
            <nav aria-label="주 메뉴" className={styles.nav}>
              <NavLink to="/" end className={navClass}>
                품목
              </NavLink>
              <NavLink to="/reports" className={navClass}>
                입출고 현황
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={navClass}>
                  관리
                </NavLink>
              )}
            </nav>
          )}
          <div className={styles.tools}>
            <UserSelect />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        {/* 사용자를 선택해야 재고관리 화면을 사용할 수 있다 */}
        {user ? <Outlet /> : <UserGate />}
      </main>
    </>
  );
}
