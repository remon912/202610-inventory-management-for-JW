import { useState } from 'react';
import AdminLoginForm from './AdminLoginForm.jsx';
import StatusView from './StatusView.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import styles from './UserGate.module.css';

/**
 * 사용자를 선택해야 재고관리 화면에 들어갈 수 있다.
 * 일반 사용자는 이름만 선택, 관리자는 비밀번호로 로그인한다.
 */
export default function UserGate() {
  const { users, usersQuery, sessionQuery, selected, setUserId, selectMember } = useCurrentUser();
  // 관리자 세션이 만료된 경우 그 관리자의 로그인 폼을 바로 연다
  const [adminTarget, setAdminTarget] = useState(selected?.role === 'admin' ? selected : null);

  if (usersQuery.isPending || sessionQuery.isPending) {
    return <StatusView kind="loading" title="사용자 목록을 불러오는 중…" />;
  }
  if (usersQuery.isError) {
    return (
      <StatusView
        kind="error"
        title="사용자 목록을 불러오지 못했습니다"
        description={usersQuery.error.message}
        onRetry={() => usersQuery.refetch()}
      />
    );
  }

  return (
    <section className={styles.gate} aria-labelledby="gate-title">
      <h1 id="gate-title" className={styles.title}>
        사용자 선택
      </h1>
      <p className={styles.desc}>
        입출고와 품목 변경 내역에 기록자가 남습니다. 본인 이름을 선택하세요. 관리자는 비밀번호를
        입력해야 합니다.
      </p>

      {users.length > 0 ? (
        <ul className={styles.list} aria-label="사용자 목록">
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className={`${styles.user} ${adminTarget?.id === u.id ? styles.selected : ''}`}
                onClick={() => (u.role === 'admin' ? setAdminTarget(u) : selectMember(u.id))}
                aria-pressed={adminTarget?.id === u.id}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {u.name.slice(0, 1)}
                </span>
                <span className={styles.name}>{u.name}</span>
                {u.role === 'admin' && (
                  <span className={styles.role}>
                    <span aria-hidden="true">🔒</span> 관리자
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>등록된 사용자가 없습니다. 관리자에게 문의하세요.</p>
      )}

      {adminTarget && (
        <AdminLoginForm
          key={adminTarget.id}
          user={adminTarget}
          onSuccess={() => setUserId(adminTarget.id)}
          onCancel={() => setAdminTarget(null)}
        />
      )}

      <p className={styles.note}>
        사용자 추가·삭제는 관리자만 할 수 있습니다. 이름이 없으면 관리자에게 요청하세요.
      </p>
    </section>
  );
}
