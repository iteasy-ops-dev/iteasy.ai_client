# ITEasy AI Agent - 프로젝트 분석 및 컨텍스트

## 프로젝트 개요

**프로젝트명**: ITEasy AI Agent
**버전**: 1.0.0
**목적**: ITEasy 사내 전용 AI 채팅 클라이언트 - 업무 효율성과 생산성 향상을 위한 AI 어시스턴트
**개발자**: iteasy-ops-dev (iteasy.ops.dev@gmail.com)
**라이선스**: MIT

ITEasy 팀원들을 위한 전용 AI 채팅 클라이언트로, ChatGPT와 유사한 인터페이스를 제공하며 업무 지원 및 생산성 향상을 목적으로 개발된 웹 애플리케이션입니다.

## 기술 스택 및 아키텍처

### Core Framework
- **Next.js 14**: App Router 기반 React 프레임워크
- **TypeScript**: 타입 안전성을 위한 정적 타입 언어
- **React 19.1.0**: 최신 React 버전 사용

### UI 및 스타일링
- **Tailwind CSS 3.4.17**: 유틸리티 기반 CSS 프레임워크
- **Lucide React 0.525.0**: 아이콘 라이브러리
- **clsx & tailwind-merge**: 조건부 클래스 네임 관리

### AI 및 실시간 통신
- **Vercel AI SDK (@ai-sdk/openai, ai)**: OpenAI API 통합 및 스트리밍
- **OpenAI 5.9.0**: OpenAI API 클라이언트
- **LangGraph 0.3.8**: AI 워크플로우 오케스트레이션 및 의도 분석
- **LangChain Core 0.3.62**: LangGraph 기반 라이브러리
- **Server-Sent Events (SSE)**: 실시간 응답 스트리밍

### 상태 관리 및 데이터
- **Zustand 5.0.6**: 간단하고 효율적인 상태 관리
- **localStorage**: 클라이언트 사이드 데이터 영속성

### 마크다운 및 코드 표시
- **react-markdown 10.1.0**: 마크다운 렌더링
- **remark-gfm 4.0.1**: GitHub Flavored Markdown 지원
- **react-syntax-highlighter 15.6.1**: 코드 신택스 하이라이팅

## 프로젝트 구조

```
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts            # SSE 스트리밍 API 엔드포인트 (LangGraph 통합)
│   │   │   └── langgraph/          # LangGraph 의도 분석 시스템
│   │   │       ├── graph.ts        # 메인 워크플로우 그래프
│   │   │       ├── types.ts        # 타입 정의
│   │   │       ├── nodes/          # 처리 노드들
│   │   │       │   ├── intentClassifier.ts  # 의도 분류
│   │   │       │   ├── generalChat.ts       # 일반 채팅
│   │   │       │   ├── systemEngineer.ts    # 시스템 엔지니어링
│   │   │       │   └── helpNode.ts          # 사용법 도움말
│   │   │       └── prompts/        # 프롬프트 템플릿
│   │   │           └── intentClassification.ts
│   │   └── validate-key/route.ts   # API 키 검증 엔드포인트
│   ├── components/
│   │   ├── chat/                   # 채팅 관련 컴포넌트
│   │   │   ├── ChatInterface.tsx   # 메인 채팅 인터페이스
│   │   │   ├── MessageList.tsx     # 메시지 리스트
│   │   │   ├── MessageItem.tsx     # 개별 메시지 컴포넌트
│   │   │   ├── InputArea.tsx       # 입력 영역
│   │   │   ├── ChatSidebar.tsx     # 사이드바 (채팅 목록)
│   │   │   └── SettingsModal.tsx   # 탭 기반 설정 모달 (API/테마/폰트)
│   │   ├── ui/                     # 재사용 가능한 UI 컴포넌트
│   │   ├── FontProvider.tsx        # 동적 폰트 적용 컴포넌트
│   │   ├── ThemeProvider.tsx       # 테마 시스템 관리
│   │   └── ClientOnly.tsx          # 클라이언트 전용 렌더링
│   ├── hooks/
│   │   └── useHydration.ts         # 하이드레이션 훅
│   ├── lib/
│   │   └── utils.ts                # 유틸리티 함수
│   ├── store/
│   │   ├── chat-store.ts           # 채팅 히스토리 관리
│   │   └── settings-store.ts       # API 키 및 설정
│   ├── types/
│   │   └── index.ts                # TypeScript 타입 정의
│   ├── globals.css                 # 글로벌 스타일
│   ├── layout.tsx                  # 루트 레이아웃
│   └── page.tsx                    # 홈페이지
```

## 주요 컴포넌트 분석

### 1. ChatInterface.tsx (app/components/chat/ChatInterface.tsx:1)
메인 채팅 인터페이스로 전체 애플리케이션의 중심 컴포넌트입니다.

**주요 기능**:
- Vercel AI SDK의 useChat 훅 사용으로 AI와 실시간 통신
- Zustand 스토어와의 동기화 관리
- 하이드레이션 처리 및 클라이언트/서버 상태 분리
- 에러 처리 및 API 키 검증
- 메시지 스트리밍 및 토큰 사용량 추적

**코딩 패턴**:
- 'use client' 지시어로 클라이언트 컴포넌트 명시
- useEffect를 활용한 스토어 동기화
- 조건부 렌더링으로 하이드레이션 미스매치 방지

### 2. 상태 관리 (Zustand Stores)

#### chat-store.ts (app/store/chat-store.ts:1)
채팅 히스토리와 메시지 관리를 담당합니다.

**구조**:
- Chat 및 Message 타입 기반 데이터 구조
- localStorage를 통한 영속성 보장
- 날짜 직렬화/역직렬화 처리
- 토큰 사용량 추적 기능

**주요 액션**:
- createNewChat(): 새 채팅 생성
- addMessage(): 메시지 추가
- updateMessageWithTokenUsage(): 토큰 사용량 업데이트
- updateChatTitle(): 채팅 제목 업데이트

#### settings-store.ts (app/store/settings-store.ts:1)
API 키, AI 모델, UI 테마 및 폰트 설정을 통합 관리합니다.

**설정 항목**:
- apiKey: OpenAI API 키
- model: AI 모델 선택 (gpt-3.5-turbo 기본값)
- temperature: 창의성 수준 (0-2)
- maxTokens: 최대 토큰 수 (1-4000)
- **theme**: 테마 모드 (light/dark/system)
- **font**: 폰트 선택 (12가지 옵션, 한글 최적화 포함)

### 3. API 엔드포인트

#### /api/chat (app/api/chat/route.ts:1)
LangGraph 기반 지능형 의도 분석 및 SSE 스트리밍 AI 응답 처리

**LangGraph 워크플로우**:
- 사용자 입력 자동 의도 분석 (일반/시스템엔지니어링/도움말)
- 조건부 라우팅으로 적절한 전문성 수준 선택
- 시스템 프롬프트 동적 생성 및 적용

**특징**:
- Vercel AI SDK의 streamText 함수 사용
- LangGraph 의도 분석 전처리
- 호환성 모드 설정으로 토큰 사용량 추적
- 에러 처리 (401, 429, 500)
- 의도별 로깅 및 디버깅

**의도 분류 시스템**:
- **General Chat**: 일반 대화, 인사, 비기술적 질문
- **System Engineering**: 리눅스, 클라우드, 네트워크, DevOps 전문 질문
- **Help**: AI 에이전트 사용법, 기능 설명, 가이드

**토큰 사용량 추적**:
- sendUsage: true 옵션으로 사용량 데이터 전송
- onFinish 콜백에서 사용량 및 의도 분석 결과 로깅
- 클라이언트에서 토큰 정보를 메시지에 연결

## 코딩 스타일 및 컨벤션

### 1. TypeScript 사용
- 엄격한 타입 정의 (app/types/index.ts)
- 인터페이스 기반 컴포넌트 props 정의
- 제네릭 타입 활용 (Zustand 스토어)

### 2. 컴포넌트 패턴
- 함수형 컴포넌트 사용
- 커스텀 훅을 통한 로직 분리
- 조건부 렌더링 활용
- props destructuring 패턴

### 3. 스타일링 패턴
- Tailwind CSS 유틸리티 클래스
- 반응형 디자인 (mobile-first)
- 컴포넌트별 스타일 캡슐화
- 일관된 색상 및 간격 시스템

### 4. 상태 관리 패턴
- Zustand의 간단한 스토어 구조
- 액션과 상태의 명확한 분리
- localStorage 기반 영속성
- 타입 안전한 스토어 정의

## 라이브러리 사용 현황

### 의존성 (dependencies)
```json
{
  "@ai-sdk/openai": "^1.3.23",          # OpenAI AI SDK
  "@langchain/core": "^0.3.62",         # LangChain 핵심 라이브러리
  "@langchain/langgraph": "^0.3.8",     # 워크플로우 오케스트레이션
  "@langchain/openai": "^0.5.18",       # LangChain OpenAI 통합
  "ai": "^4.3.17",                      # Vercel AI SDK
  "zustand": "^5.0.6",                  # 상태 관리
  "react-markdown": "^10.1.0",          # 마크다운 렌더링
  "react-syntax-highlighter": "^15.6.1", # 코드 하이라이팅
  "lucide-react": "^0.525.0",           # 아이콘
  "clsx": "^2.1.1",                     # 클래스명 유틸리티
  "tailwind-merge": "^3.3.1"            # Tailwind 클래스 병합
}
```

### 개발 의존성 (devDependencies)
```json
{
  "@types/node": "^24.0.13",
  "@types/react": "^19.1.8",
  "@types/react-dom": "^19.1.6",
  "typescript": "^5.8.3"
}
```

## 주요 기능

### 1. 지능형 의도 분석 및 실시간 AI 채팅
- **LangGraph 기반 의도 분석**: 사용자 질문을 자동으로 분류하여 적절한 전문성 수준으로 라우팅
- **3가지 응답 모드**: 일반 채팅, 시스템 엔지니어링 전문가, 사용법 도움말
- **SSE를 통한 실시간 응답 스트리밍**: 답변이 실시간으로 스트리밍
- **다양한 OpenAI 모델 지원** (GPT-3.5, GPT-4 등)
- **사용자 설정 가능한 AI 파라미터**: 온도, 최대 토큰 등

### 2. 다중 채팅 세션
- 여러 채팅 동시 관리
- 자동 제목 생성 (첫 메시지 기반)
- 채팅 삭제 및 선택 기능

### 3. 토큰 사용량 추적
- 메시지별 토큰 사용량 표시
- 비용 관리를 위한 사용량 모니터링
- 프롬프트/완성/총 토큰 분리 추적

### 4. 설정 관리
- API 키 동적 구성
- AI 모델 및 파라미터 조정
- 실시간 API 키 검증
- **다국어 폰트 시스템**: 12가지 폰트 선택 (한글 최적화 포함)
- **테마 설정**: Light/Dark/System 모드
- **탭 기반 설정 UI**: API, 테마, 폰트 설정 분리

### 5. 사용자 경험
- 반응형 디자인
- 마크다운 및 코드 블록 렌더링
- 메시지 복사 기능
- 에러 처리 및 사용자 피드백
- **동적 폰트 변경**: 실시간 폰트 적용
- **향상된 텍스트 가독성**: 여유로운 자간 및 줄간격
- **최적화된 UI 레이아웃**: 상단 여백 및 균형잡힌 배치

## 개발 워크플로우

### 스크립트
- `npm run dev`: 개발 서버 실행
- `npm run build`: 프로덕션 빌드
- `npm run start`: 프로덕션 서버 실행
- `npm run lint`: 코드 린팅

### 환경 변수
- `OPENAI_API_KEY`: OpenAI API 키 (선택사항, 앱 내에서 설정 가능)

### 빌드 및 배포
- Next.js App Router 기반 SSR/SSG
- Vercel 배포 최적화
- 정적 자산 최적화

## 보안 고려사항

### API 키 관리
- 클라이언트 사이드 API 키 저장 (localStorage)
- 환경 변수 fallback 지원
- API 키 검증 기능

### 에러 처리
- API 오류 상황별 적절한 응답
- 사용자 친화적 에러 메시지
- 디버깅을 위한 서버 로깅

## 성능 최적화

### 렌더링 최적화
- 컴포넌트 메모이제이션
- 조건부 렌더링
- 하이드레이션 미스매치 방지

### 데이터 관리
- 효율적인 상태 업데이트
- 로컬스토리지 최적화
- 메시지 스트리밍 최적화

## Context7 MCP 서버 활용 가능 영역

이 프로젝트에서 Context7 MCP 서버를 활용할 수 있는 영역:

1. **라이브러리 검토**: 새로운 UI 컴포넌트나 기능 추가 시 기존 의존성 호환성 확인
2. **코드 품질**: 코딩 스타일 및 베스트 프랙티스 검증
3. **보안 검토**: API 키 관리 및 보안 취약점 분석
4. **성능 최적화**: 렌더링 및 상태 관리 최적화 방안 제안
5. **타입 안전성**: TypeScript 타입 정의 개선 제안

## LangGraph 의도 분석 시스템 (v1.1.0 추가)

### 아키텍처 개요
LangGraph를 활용한 지능형 의도 분석 및 라우팅 시스템이 추가되어, 사용자의 질문 의도를 자동으로 파악하고 적절한 전문성 수준으로 응답합니다.

### 워크플로우 구조
```
사용자 입력 → 의도 분석 노드 → 조건부 라우팅 → 전문 응답 생성
                    ↓
        [일반 채팅 | 시스템 엔지니어링 | 도움말]
```

### 의도 분류 카테고리

#### 1. General Chat (일반 채팅)
- 일상 대화, 인사, 일반적인 질문
- 기본 GPT 모델의 표준 응답 모드
- 예시: "안녕하세요", "날씨가 어때요?", "AI에 대해 설명해주세요"

#### 2. System Engineering (시스템 엔지니어링)
전문적인 인프라 및 시스템 관리 질문에 대해 전문가 수준의 답변 제공
- **Linux/Unix 시스템 관리**: 명령어, 설정, 문제 해결
- **클라우드 플랫폼**: AWS, GCP, Azure 설정 및 관리
- **컨테이너 기술**: Docker, Kubernetes 배포 및 최적화
- **네트워크 인프라**: TCP/IP, DNS, 보안 설정
- **CI/CD 파이프라인**: Jenkins, GitLab CI, GitHub Actions
- **모니터링 및 로깅**: Prometheus, Grafana, ELK 스택
- **데이터베이스 관리**: MySQL, PostgreSQL, MongoDB, Redis
- **Infrastructure as Code**: Terraform, Ansible, CloudFormation

#### 3. Help (사용법 도움말)
ITEasy AI Client의 기능과 사용법에 대한 종합적인 가이드 제공
- AI 에이전트 사용법 및 기능 설명
- 최적의 질문 방법 및 모범 사례
- 시스템의 3가지 응답 모드 설명
- 기능별 사용 팁 및 트러블슈팅

### 기술적 구현

#### 신뢰도 기반 라우팅
- 의도 분류 신뢰도 0.7 이상일 때 전문 모드 활성화
- 낮은 신뢰도 시 일반 채팅으로 기본 라우팅
- 실시간 의도 분석 결과 로깅

#### 동적 프롬프트 시스템
- 의도에 따른 시스템 프롬프트 동적 생성
- 시스템 엔지니어링 모드: 전문 지식 및 실용적 예시 포함
- 도움말 모드: 포괄적인 사용 가이드 및 기능 설명

#### 성능 최적화
- LangGraph 노드 병렬 처리 지원
- 의도 분석 결과 캐싱 (향후 구현 예정)
- 에러 처리 및 폴백 메커니즘

### 사용 예시

```typescript
// 시스템 엔지니어링 질문
"Docker 컨테이너가 포트 8080에서 충돌이 발생합니다. 어떻게 해결하나요?"
→ 시스템 엔지니어 모드로 라우팅
→ 구체적인 명령어와 설정 예시 포함 답변

// 도움말 질문  
"이 AI 에이전트는 어떤 기능들이 있나요?"
→ 도움말 모드로 라우팅
→ 전체 기능 소개 및 사용법 가이드 제공

// 일반 대화
"오늘 기분이 좋네요!"
→ 일반 채팅 모드로 라우팅
→ 자연스러운 대화 응답
```

## 최근 업데이트 (v1.2.0)

### 포괄적인 폰트 커스터마이제이션 시스템
- **12가지 폰트 옵션**: Inter, Noto Sans KR, Open Sans, Roboto, Poppins, Nunito, Comfortaa, Quicksand, Lato, Source Sans 3, Noto Serif KR, IBM Plex Sans KR
- **한글+영어 조합**: 영어 폰트 선택 시 한글은 Noto Sans KR로 자동 fallback
- **실시간 폰트 변경**: FontProvider를 통한 동적 폰트 적용
- **폰트 미리보기**: 설정 모달에서 각 폰트의 시각적 미리보기 제공

### 향상된 텍스트 가독성
- **여유로운 자간**: body 0.025em, 메시지 영역 0.03em
- **최적화된 줄간격**: line-height 1.7로 편안한 읽기 경험
- **메시지 텍스트 크기 통일**: 사용자와 AI 메시지 일관된 typography

### UI/UX 개선
- **상단 여백 추가**: 전체 UI 레이아웃의 시각적 균형 개선
- **탭 기반 설정**: API, 테마, 폰트 설정을 분리된 탭으로 구성
- **테마 시스템**: Light/Dark/System 모드 지원

## 향후 개선 방향

1. **테스트 추가**: 현재 테스트가 없으므로 Jest/Testing Library 도입 필요
2. **의도 분석 정확도 개선**: 더 많은 학습 데이터 및 파인튜닝
3. **새로운 의도 카테고리 추가**: 개발, 디자인, 비즈니스 등 영역별 전문화
4. **접근성**: ARIA 속성 및 키보드 네비게이션 개선
5. **PWA**: 오프라인 지원 및 푸시 알림
6. **모니터링**: 사용량 통계 및 성능 모니터링
7. **의도 분석 결과 학습**: 사용자 피드백 기반 의도 분류 정확도 개선
8. **폰트 크기 조절**: 사용자 맞춤형 텍스트 크기 설정
9. **커스텀 테마**: 사용자 정의 색상 테마 지원