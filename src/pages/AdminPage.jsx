import { useId, useState } from 'react';
import AddUserForm from '../components/AddUserForm.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';
import PlaceEditForm from '../components/PlaceEditForm.jsx';
import UserEditForm from '../components/UserEditForm.jsx';
import StatusView from '../components/StatusView.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { useChangePassword } from '../hooks/useSession.js';
import { useToast } from '../hooks/useToast.js';
import {
  useCreateUsagePlace,
  useDeleteUsagePlace,
  useUsagePlaces,
} from '../hooks/useUsagePlaces.js';
import { useDeleteUser } from '../hooks/useUsers.js';
import styles from './Admin.module.css';

function UsersSection() {
  const { user: me, users } = useCurrentUser();
  const { toast } = useToast();
  const del = useDeleteUser();
  const [editingId, setEditingId] = useState(null);
  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <section className={styles.section} aria-labelledby="admin-users">
      <h2 id="admin-users" className={styles.sectionTitle}>
        사용자 관리
      </h2>
      <ul className={styles.list}>
        {users.map((u) => {
          const isMe = u.id === me.id;
          const lastAdmin = u.role === 'admin' && adminCount <= 1;
          if (editingId === u.id) {
            return (
              <li key={u.id} className={styles.row}>
                <UserEditForm
                  user={u}
                  isMe={isMe}
                  isLastAdmin={lastAdmin}
                  onCancel={() => setEditingId(null)}
                  onDone={(saved, input) => {
                    setEditingId(null);
                    toast(
                      input.password
                        ? `‘${saved.name}’ 사용자를 수정했습니다. 비밀번호가 바뀌어 다시 로그인해야 합니다.`
                        : `‘${saved.name}’ 사용자를 수정했습니다.`,
                    );
                  }}
                />
              </li>
            );
          }
          return (
            <li key={u.id} className={styles.row}>
              <span className={styles.rowName}>
                {u.name}
                {isMe && <span className={styles.tag}>본인</span>}
              </span>
              <span className={u.role === 'admin' ? styles.admin : styles.member}>
                {u.role === 'admin' ? '🔒 관리자' : '일반'}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditingId(u.id)}
                aria-label={`${u.name} 수정`}
              >
                수정
              </button>
              {isMe || lastAdmin ? (
                <span className={styles.muted}>{isMe ? '본인은 삭제 불가' : '마지막 관리자'}</span>
              ) : (
                <ConfirmButton
                  ariaLabel={`${u.name} 삭제`}
                  message={`'${u.name}' 사용자를 삭제할까요? 기록은 남습니다.`}
                  pending={del.isPending}
                  onConfirm={() =>
                    del
                      .mutateAsync(u.id)
                      .then(() => toast(`‘${u.name}’ 사용자를 삭제했습니다.`))
                      .catch((err) => toast(err.message, { variant: 'error' }))
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.addBox}>
        <h3 className={styles.subTitle}>사용자 추가</h3>
        <AddUserForm onCreated={(u) => toast(`‘${u.name}’ 사용자를 추가했습니다.`)} />
      </div>
    </section>
  );
}

function PlacesSection() {
  const uid = useId();
  const { toast } = useToast();
  const placesQuery = useUsagePlaces();
  const create = useCreateUsagePlace();
  const del = useDeleteUsagePlace();
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const places = placesQuery.data ?? [];

  const onSubmit = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return setError('사용처 이름을 입력해 주세요.');
    if (v.length > 100) return setError('100자 이하로 입력해 주세요.');
    if (places.some((p) => p.name === v)) return setError('이미 등록된 사용처입니다.');
    setError(null);
    create.mutate(v, {
      onSuccess: (p) => {
        setName('');
        toast(`‘${p.name}’ 사용처를 등록했습니다.`);
      },
      onError: (err) => setError(err.message),
    });
  };

  return (
    <section className={styles.section} aria-labelledby="admin-places">
      <h2 id="admin-places" className={styles.sectionTitle}>
        사용처 관리
      </h2>
      <p className={styles.desc}>
        출고할 때는 여기 등록된 사용처만 선택할 수 있습니다. 사용처 이름을 바꾸거나 삭제해도 지난
        출고 이력은 기록 당시 그대로 남습니다.
      </p>
      <form className={styles.inline} onSubmit={onSubmit} noValidate>
        <label htmlFor={`${uid}-place`} className="visually-hidden">
          새 사용처 이름
        </label>
        <input
          id={`${uid}-place`}
          className="input"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          maxLength={100}
          placeholder="새 사용처 이름 (예: 3층 회의실)"
          aria-invalid={error ? 'true' : undefined}
        />
        <button type="submit" className="btn btn-primary" disabled={create.isPending}>
          + 등록
        </button>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {placesQuery.isPending ? (
        <StatusView kind="loading" />
      ) : places.length === 0 ? (
        <p className={styles.muted}>등록된 사용처가 없습니다.</p>
      ) : (
        <ul className={styles.list}>
          {places.map((p) =>
            editingId === p.id ? (
              <li key={p.id} className={styles.row}>
                <PlaceEditForm
                  place={p}
                  existingNames={places.filter((x) => x.id !== p.id).map((x) => x.name)}
                  onCancel={() => setEditingId(null)}
                  onDone={(saved) => {
                    setEditingId(null);
                    toast(`사용처 이름을 ‘${saved.name}’(으)로 바꿨습니다.`);
                  }}
                />
              </li>
            ) : (
              <li key={p.id} className={styles.row}>
                <span className={styles.rowName}>{p.name}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingId(p.id)}
                  aria-label={`${p.name} 수정`}
                >
                  수정
                </button>
                <ConfirmButton
                  ariaLabel={`${p.name} 삭제`}
                  message={`'${p.name}'을(를) 삭제할까요?`}
                  pending={del.isPending}
                  onConfirm={() =>
                    del
                      .mutateAsync(p.id)
                      .then(() => toast(`‘${p.name}’ 사용처를 삭제했습니다.`))
                      .catch((err) => toast(err.message, { variant: 'error' }))
                  }
                />
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function PasswordSection() {
  const uid = useId();
  const { toast } = useToast();
  const mutation = useChangePassword();
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    if (!values.current) return setError('현재 비밀번호를 입력해 주세요.');
    if (values.next.length < 8) return setError('새 비밀번호는 8자 이상이어야 합니다.');
    if (values.next !== values.confirm) return setError('새 비밀번호 확인이 일치하지 않습니다.');
    setError(null);
    mutation.mutate(
      { current: values.current, next: values.next },
      {
        onSuccess: () => {
          setValues({ current: '', next: '', confirm: '' });
          toast('비밀번호를 변경했습니다. 다른 기기의 로그인은 해제됩니다.');
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  const field = (key, label, autoComplete) => (
    <div className="field">
      <label htmlFor={`${uid}-${key}`} className="field-label">
        {label}
      </label>
      <input
        id={`${uid}-${key}`}
        className="input"
        type="password"
        value={values[key]}
        onChange={set(key)}
        autoComplete={autoComplete}
        maxLength={200}
      />
    </div>
  );

  return (
    <section className={styles.section} aria-labelledby="admin-pw">
      <h2 id="admin-pw" className={styles.sectionTitle}>
        내 비밀번호 변경
      </h2>
      <form className={styles.pwForm} onSubmit={onSubmit} noValidate>
        {field('current', '현재 비밀번호', 'current-password')}
        {field('next', '새 비밀번호 (8자 이상)', 'new-password')}
        {field('confirm', '새 비밀번호 확인', 'new-password')}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? '변경 중…' : '비밀번호 변경'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function AdminPage() {
  const { isAdmin } = useCurrentUser();
  if (!isAdmin) {
    return (
      <StatusView
        kind="error"
        title="관리자만 이용할 수 있습니다"
        description="상단의 사용자 선택에서 관리자로 로그인하세요."
      />
    );
  }
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>관리</h1>
      <UsersSection />
      <PlacesSection />
      <PasswordSection />
    </div>
  );
}
