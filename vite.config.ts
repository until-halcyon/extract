import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages의 프로젝트 저장소에서도 정적 리소스 경로가 작동하도록 상대 경로 사용.
export default defineConfig({ plugins: [react()], base: './' });
