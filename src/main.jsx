import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import UserProvider from './components/UserProvider.jsx';
import ToastProvider from './components/ToastProvider.jsx';
import { SESSION_KEY } from './hooks/useSession.js';
import './styles/tokens.css';
import './styles/global.css';

// 관리자 세션이 만료되면 로그인 상태를 다시 확인 → 사용자 선택(로그인) 화면으로 돌아간다
const onAuthError = (err) => {
  if (err?.code === 'ADMIN_LOGIN_REQUIRED') {
    queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthError }),
  mutationCache: new MutationCache({ onError: onAuthError }),
  defaultOptions: {
    queries: {
      refetchInterval: 15_000, // 다른 사용자 변경 사항 polling
      refetchOnWindowFocus: true,
      staleTime: 5_000,
      // 4xx는 재시도해도 결과가 같으므로 서버/네트워크 오류만 재시도
      retry: (count, err) => (err?.status === 0 || err?.status >= 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </UserProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
