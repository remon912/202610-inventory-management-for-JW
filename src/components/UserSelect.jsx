import { useId, useRef, useState } from 'react';
import AdminLoginForm from './AdminLoginForm.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { useToast } from '../hooks/useToast.js';
import styles from './UserSelect.module.css';

/** 상단 바: 사용자 변경 (관리자로 바꿀 때는 비밀번호 확인) + 관리자 로그아웃 */
export default function UserSelect() {
  const id = useId();
  const dialogRef = useRef(null);
  const { user, users, isAdmin, setUserId, selectMember, logout } = useCurrentUser();
  const { toast } = useToast();
  const [target, setTarget] = useState(null);

  if (!user) return null;

  const onChange = (e) => {
    const next = users.find((u) => u.id === e.target.value);
    if (!next) return;
    if (next.role === 'admin') {
      setTarget(next);
      dialogRef.current?.showModal();
    } else {
      selectMember(next.id);
    }
  };

  const closeDialog = () => {
    dialogRef.current?.close();
    setTarget(null);
  };

  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={styles.label}>
        사용자
      </label>
      <select id={id} className={`input ${styles.select}`} value={user.id} onChange={onChange}>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
            {u.role === 'admin' ? ' (관리자)' : ''}
          </option>
        ))}
      </select>
      {isAdmin && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            await logout();
            toast('관리자 로그아웃했습니다.');
          }}
        >
          로그아웃
        </button>
      )}

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${id}-dialog-title`}
        onClose={() => setTarget(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) closeDialog(); // 바깥 클릭 시 닫기
        }}
      >
        <div className={styles.dialogBody}>
          <div className={styles.dialogHead}>
            <h2 id={`${id}-dialog-title`} className={styles.dialogTitle}>
              관리자 로그인
            </h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={closeDialog}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          {target && (
            <AdminLoginForm
              key={target.id}
              user={target}
              onSuccess={() => {
                setUserId(target.id);
                closeDialog();
                toast(`관리자 ‘${target.name}’(으)로 로그인했습니다.`);
              }}
              onCancel={closeDialog}
            />
          )}
        </div>
      </dialog>
    </div>
  );
}
