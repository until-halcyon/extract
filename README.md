# EXCERPT STUDIO

AI 채팅 원문을 소설형·채팅형·혼합형 이미지로 만드는 로컬 발췌기 MVP입니다.

## 실행

Node.js 20 이상 권장.

```bash
npm install
npm run dev
```

터미널에 표시된 로컬 주소(보통 http://localhost:5173/)에서 확인하세요.

## 포함된 기능

- 한 편집창에서 전체 원문 입력 및 편집 (Tiptap)
- 부분 선택한 글자: 굵게, 기울임, 밑줄, 취소선, 색상
- 현재 문단에 화자 A/B 또는 서술 지정
- 소설형 / 채팅형 / 혼합형 즉시 전환
- 테마 프리셋, 배경·본문·화자 색, 폰트, 글자 크기, 행간, 문단 간격, 여백, 이미지 비율
- 2배 PNG 저장, 작업 JSON 가져오기/내보내기, localStorage 자동 저장

## GitHub Pages 배포

1. GitHub 저장소에 이 프로젝트를 업로드합니다.
2. `npm install && npm run build` 실행 시 `dist` 폴더가 생성됩니다.
3. GitHub 저장소 Settings → Pages에서 GitHub Actions 배포를 사용합니다.
4. Actions 워크플로 예시는 `.github/workflows/deploy.yml`에 준비되어 있습니다.

## 현재 버전의 범위

- 화자는 A/B 2명입니다. 이름 추가/변경 UI는 다음 버전에서 확장 가능합니다.
- 문단별 화자를 지정할 수 있지만 원문 대사 자동 인식은 아직 없습니다.
- PNG는 출력 너비 600px을 2배 해상도로 저장합니다.
- 매우 긴 글은 브라우저 캔버스 크기 제한으로 PNG 출력이 실패할 수 있습니다. 자동 페이지 분할은 다음 버전 예정입니다.
- Google Fonts를 사용하며 오프라인 환경에서 일부 폰트는 시스템 폰트로 대체될 수 있습니다.
- 프로젝트는 로그인이나 원격 데이터베이스 없이 사용자 브라우저의 localStorage에 저장됩니다.
