# 📅 G-Scheduler & Notes

GitHub Pages를 통해 어디서나 무료로 접속하여 사용할 수 있는 글래스모피즘(Glassmorphism) 스타일의 프리미엄 스케줄러 & 메모장입니다.
사용자의 모든 데이터는 브라우저의 `LocalStorage`에 안전하게 자동 저장되며, **GitHub Gist API**를 연동하여 기기 간 실시간 백업 및 동기화를 수행할 수 있습니다.

---

## 주요 기능

1. **📊 통합 대시보드**
   - **오늘의 업무 진행률**: 오늘 해야 하는 할 일의 진척도를 애니메이션 원형 차트로 시각화
   - **중요 일정 D-Day**: D-Day 목표일 카운트다운 관리 (정렬 기능 및 지연 표시 제공)
   - **오늘의 일정**: 달력에 등록된 오늘 하루 일정을 간편 요약하여 확인
   - **자주 찾는 정보 (Quick Links)**: 메모장에서 별표(Favorite) 표시한 자주 쓰는 메모들을 대시보드에 고정하여 원클릭 이동 지원

2. **📅 달력 일정 관리**
   - 연/월 단위 달력 그리드 렌더링
   - 날짜 칸 클릭을 통한 신규 일정 등록 (제목, 날짜, 색상 태그, 상세 내용 기입 가능)
   - 날짜 칸 내부의 일정 배지 클릭을 통한 상세 정보 수정 및 삭제

3. **📝 업무 리스트 (To-do List)**
   - 업무 내용, 우선순위(높음/보통/낮음), 마감일 지정을 통한 스마트한 할 일 관리
   - 필터 기능 (전체, 진행 중, 완료됨) 제공
   - 완료 시 취소선 및 투명도 처리를 통한 완료 항목 시각화
   - 드롭다운 및 모달 없이도 인라인 수정 및 삭제 지원

4. **ℹ️ 정보 메모장 (Notes & Wiki)**
   - 카테고리별 메모 분류 지원 (예: 업무, 개발, 개인 등)
   - 링크 삽입 필드 제공 및 본문 내 메모 기능 지원
   - 별표(Favorite) 처리를 통한 대시보드 내 바로가기 카드 고정 기능

5. **🔄 설정 및 GitHub Gist 동기화**
   - **로컬 백업**: 전체 데이터를 `.json` 파일로 즉시 내보내기(Export) 및 가져오기(Import)
   - **GitHub Gist 동기화**: GitHub Personal Access Token(PAT)을 연동하여, 사용자의 비공개 Gist 공간에 안전하게 암호화 데이터 백업/다운로드 지원

---

## 🚀 GitHub Pages 배포 방법 (어디서나 접속하기)

1. 이 프로젝트 폴더(`.html`, `.css`, `.js` 파일들)를 사용자 본인의 GitHub 저장소(Repository)에 업로드(Commit & Push)합니다.
2. 해당 GitHub 저장소 페이지로 이동하여 **Settings** 탭을 클릭합니다.
3. 좌측 사이드바에서 **Pages** 메뉴를 선택합니다.
4. **Build and deployment** 섹션의 Source 항목을 `Deploy from a branch`로 설정하고, Branch를 `main`(또는 `master`) 브랜치의 `/ (root)` 폴더로 설정한 후 **Save** 버튼을 누릅니다.
5. 약 1~2분 후 상단에 표시되는 `https://<username>.github.io/<repository-name>/` 주소를 통해 전 세계 어디서나 모바일/PC 브라우저로 접속할 수 있습니다.

---

## 🔑 GitHub Gist 동기화 설정 방법

1. [GitHub Personal Access Token 설정 페이지](https://github.com/settings/tokens)로 이동합니다.
2. **Generate new token (classic)** 을 클릭합니다.
3. Note 이름을 입력하고(예: `scheduler-sync-key`), 권한(Scopes) 목록 중 **`gist`** 항목을 체크합니다.
4. 맨 아래 **Generate token**을 클릭하여 생성된 토큰(`ghp_...`로 시작)을 안전하게 복사합니다.
5. 본 스케줄러 웹앱의 **설정 및 동기화** 탭으로 이동합니다.
6. 복사한 토큰을 **Personal Access Token** 필드에 입력합니다.
   *(기존에 저장한 Gist가 있다면 Gist ID를 입력하고, 처음 만드는 것이라면 Gist ID 칸을 비워둡니다.)*
7. **설정 저장 및 연결** 버튼을 누른 뒤, 활성화된 **지금 동기화** 버튼을 클릭하면 클라우드 백업이 완료됩니다.
