import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
  const plugins = [react()];
  // npm run dev:local — Neon 없이 내장 DB(PGlite)로 API까지 실행하는 로컬 미리보기
  if (mode === 'preview-db') {
    const { default: localApi } = await import('./scripts/vite-local-api.js');
    plugins.push(localApi());
  }
  return { plugins };
});
