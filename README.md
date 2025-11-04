# JSON Viewer by CS

JSON 파일을 보기 좋게 표시하고 값을 쉽게 복사할 수 있는 **Electron 데스크톱 앱**입니다.

## 기능

- JSON 텍스트 직접 입력 및 파싱
- JSON 파일 업로드 (드래그 앤 드롭 지원)
- 중첩된 JSON을 플랫한 키-값 쌍으로 표시
- 각 값에 대한 원클릭 복사 기능
- 키 또는 값 검색 기능
- **Markdown 파일로 내보내기** (코드블럭 형식으로 복사 편리)
- **macOS 앱처럼 동작**:
  - JSON 파일을 더블클릭하면 자동으로 열림
  - JSON 파일을 앱 아이콘에 드래그 앤 드롭하여 열기
  - 파일 우클릭 > "연결 프로그램"에서 선택 가능
- 반응형 디자인

## 설치 및 실행

### 설치
```bash
npm install
```

### Electron 앱 실행 (권장)
```bash
npm start
```

Electron 데스크톱 앱이 실행됩니다.

### 웹 버전 실행 (선택사항)
```bash
npm run web
```

서버가 시작되면 브라우저에서 `http://localhost:3000` 으로 접속하세요.

### 실행 파일 빌드
```bash
# 현재 플랫폼용 빌드
npm run build

# macOS용 빌드
npm run build:mac

# Windows용 빌드
npm run build:win

# Linux용 빌드
npm run build:linux
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

## 사용 방법

### 방법 1: 텍스트 입력
1. "텍스트 입력" 탭 선택
2. JSON 텍스트를 입력
3. "JSON 파싱" 버튼 클릭

### 방법 2: 파일 업로드
1. "파일 업로드" 탭 선택
2. JSON 파일을 선택하거나 드래그 앤 드롭
3. 자동으로 파싱됨

### 값 복사하기
- 각 항목 옆의 "복사" 버튼을 클릭하여 값을 클립보드에 복사

### 검색하기
- 검색창에 키 또는 값을 입력하여 필터링

### MD 파일로 저장하기
- "MD 파일로 저장" 버튼을 클릭하여 Markdown 형식으로 내보내기
- 각 키-값 쌍이 코드블럭으로 표시되어 복사가 편리함
- 생성일시와 통계 정보가 포함됨

### macOS 앱처럼 사용하기
빌드한 앱을 설치한 후:

1. **JSON 파일 더블클릭으로 열기**
   - JSON 파일 우클릭 > 정보 가져오기
   - "연결 프로그램"에서 JSON Viewer by CS 선택
   - "모두 변경" 클릭하면 모든 JSON 파일이 이 앱으로 열림

2. **앱 아이콘에 드래그 앤 드롭**
   - Dock의 JSON Viewer by CS 아이콘에 JSON 파일을 드래그
   - 자동으로 앱이 열리면서 파일 로드

3. **앱 내에서 파일 열기**
   - Cmd+O 단축키 사용
   - 메뉴: File > Open JSON File

## 프로젝트 구조

```
.
├── main.js             # Electron 메인 프로세스
├── preload.js          # Electron preload 스크립트 (안전한 IPC)
├── server.js           # Express 서버
├── package.json        # 프로젝트 설정
├── public/
│   └── index.html     # 프론트엔드 UI
└── README.md          # 이 파일
```

## 기술 스택

- **Electron** - 데스크톱 앱 프레임워크
- Node.js
- Express
- Multer (파일 업로드)
- Vanilla JavaScript (프론트엔드)

## 라이센스

MIT
