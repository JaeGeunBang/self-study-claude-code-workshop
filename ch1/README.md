# Ch.1 — What is Claude Code

## Claude Code란

터미널, IDE, 데스크톱, 브라우저에서 동작하는 agentic coding 도구.

사용 가능한 모델: **Fable, Opus, Sonnet, Haiku**

## Agentic AI 개념

사용자의 목표를 받아 스스로 계획을 세우고, 도구를 사용하며, 결과를 관찰하면서 목표 달성까지 자율적으로 작동하는 AI 시스템.

- Goal Driven
- Tool Using
- Observative
- Iterative

### Agent Loop (3단계)

1. Gather Context
2. Take Action
3. Verify Results

### 주요 사용 사례

- 디버깅
- 리팩토링
- 신기능 개발
- 코드베이스 학습
- 테스트 작성
- DevOps 자동화

## Agentic Harness의 내부 구조

Claude Code는 모델 주위의 **하네스(Harness)**. 도구, 컨텍스트 관리, 실행 환경을 제공해 언어 모델을 유능한 코딩 에이전트로 바꿈.

Harness가 담당하는 것: 도구 실행, 권한 검사, 컨텍스트·메모리 관리, 체크포인트, 세션 저장

**코드 실행 위치**: local, cloud, remote control

### Agent SDK

하네스를 라이브러리로 노출한 것. Python/TypeScript로 CLI가 쓰는 것과 동일한 도구·권한 체계를 자체 앱에 내장할 수 있음.

### 추론 경로 (Provider)

하네스는 설정된 공급자 하나로 추론 요청을 보냄. 환경변수 스위치로 경로를 선택하고, 조직은 게이트웨이로 중앙 집중할 수 있음.

- Claude API
- Bedrock
- LLM Gateway

### 인증 우선순위

1. Cloud Provider
2. Auth Token
3. API Key

### 도구 카테고리 (5종)

File ops, Search, Execution, Web, Code Intel

### 신규 도구 하이라이트 (2026년)

LSP, Monitor, AskUserQuestion, Artifact

### MCP — 외부 서비스 연결

AI 도구를 외부 데이터 소스에 연결하는 개방형 표준. Github, Slack, 사내 시스템의 기능이 Claude의 도구로 등록됨.

## Context Window 구성

세션 시작 시 로드되는 것:

- System instructions (하네스 기본 지침)
- CLAUDE.md (프로젝트, 사용자, 조직 지침)
- Auto memory (첫 200줄 또는 25KB)
- Skill 설명부 (본문은 사용 시점에 로드)
- MCP 도구 이름 (정의는 온디맨드 로드)
- 대화 이력 + 도구 출력 (세션이 길수록 증가)

### Context Compaction

한계에 접근하면 오래된 도구 출력부터 정리하고, 필요하면 대화를 요약함. 초반의 세부 지시는 사라질 수 있어 지속 규칙은 CLAUDE.md에 둠.

### Checkpointing

모든 파일 편집은 되돌릴 수 있으며, `Esc` 두 번 또는 `/rewind` 명령으로 되돌림.

## 설치 및 인증

### 설치 방법

다섯 가지 경로가 있지만 **Native 방법**을 권장함 (curl / irm 원라이너, 자동 업데이트).

### 설치 검증

```bash
claude --version
claude docker
claude update
```

### 인증 방법

- 구독 OAuth
- Claude Console
- Amazon Bedrock
- Apps Gateway

가장 간단한 방법은 개인 경로: `claude` 실행 시 브라우저가 열리며 로그인 진행. `/usage`로 사용량 확인.

### API Key 환경 변수 관리

- 코드에 금지
- 볼트 관리
- 최소 권한
- 회전과 폐기

### Bedrock 설정

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=ap-northeast-2

aws sso login --profile dev
claude
```

필요 IAM 정책: `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`

### Apps Gateway

사내 SSO로 로그인하는 자체 호스팅 설정. 게이트웨이가 IdP로 개발자를 인증하고, 추론을 설정된 클라우드로 라우팅함.

## 첫 프롬프트 작성 요령

**공식 Best Practice 4원칙**

1. 구체적으로 — 관련 경로, 제약, 참고 패턴을 처음부터 명시
2. 검증 기준 제공 — 테스트 케이스, 기대 출력 등
3. 탐색과 분리 — 복잡한 문제는 Plan 모드로 조사 먼저, 코딩은 그다음
4. 대화로 교정 — 완벽한 첫 프롬프트보다 중간 개입과 반복 교정이 빠름

> 명확한 지시가 1회 성공률 상승을 결정함

## 명령어 & 세션 관리

- `/init` — CLAUDE.md 자동 생성 (프로젝트 초기화)
- `/help`, `/status`, `/docker` — 상태 확인

### 컨텍스트를 다루는 세 가지 선택

| 명령 | 상황 |
|---|---|
| `/clear` | 새 작업 시작 |
| `/compact` | 작업 공간 확보 |
| `/btw` | 흐름을 깨지 않을 곁가지 질문 (대화 이력 미보존, 컨텍스트 오염 방지) |

- `/context` — 윈도우 사용량을 그리드로 확인

### 권한 모드 실전 운영

모드는 세션 중 언제든 전환 가능.

- 큰 변경 전 → **Plan**
- 반복 작업 → **Accept Edits**
- 신뢰 저장소 → **Auto** (기본)

### 세션 관리

- `/resume`, `continue` — 대화를 이어감

### 세션 분기

- `/branch` — 사본으로 갈아타 다른 방향을 시도
- `fork` — 사본을 백그라운드 서브에이전트에게 맡김

### 롤백

- `/rewind` — 체크포인트 복구로 코드와 대화를 시점 단위로 롤백

## CLAUDE.md & Memory

두 가지 메모리 시스템: **내가 쓰는 것 (CLAUDE.md)**과 **Claude가 쓰는 것 (Auto Memory)**. 둘 다 매 세션 시작 시 로드됨. 지시와 규칙은 CLAUDE.md에, Claude가 발견한 학습은 Auto Memory에 쌓임.

### CLAUDE.md 작성 원칙

- 200줄 이하 권장
- 검증 가능한 구체적 문장
- 헤더 구조 (스캔 가능성)
- 팀 공유 (버전 관리 포함)

### Auto Memory

- `MEMORY.md`에 저장
- 200줄 / 25KB 로드 상한
- Repo 단위
- 지시가 아닌 학습 기록 성격

### .claude/rules

주제별 파일로 규칙을 분리할 수 있음.

```
rules/
├── code-style.md
├── testing.md
├── security.md
└── frontend/
    └── components.md
```

### 메모리를 망치는 습관 (피해야 할 것)

- 소설 같은 장문 서사
- 프로젝트와 무관한 일반 상식
- 비밀값과 자격증명 기록
- 매 세션 반복되는 절차 문서 전체
- 모순되는 규칙 방치

## Workflow Patterns

1. 가장 기본이 되는 3단계 리듬 — 탐색으로 이해를 만들고, 계획으로 방향을 합의한 뒤, 코드로 실행 (Explore → Plan → Code)
2. 실패하는 테스트가 곧 명세
3. Code Review
4. Multi-agent와 `/batch`
5. Visual Workflow
6. Headless 자동화
7. Pipeline과 JSON
8. CI 통합
9. Routines 예약 실행
10. `/goal` 지속 실행

## 비용 & 컨텍스트 관리

### 비용 관리 전략

비용은 모델 선택, 컨텍스트 크기, 캐시 적중의 함수. `/usage`로 소비처를 찾고 세 레버를 조정하는 게 중요함.

### 컨텍스트 관리 전략

작업 경계마다 정리하는 습관이 긴 세션의 품질을 지킴. (`/clear`, `/compact`, `/btw`, `/context`)

### 토큰 효율 베스트 프랙티스

1. 경로 지목
2. 출력 형식 지정
3. MCP 다이어트
4. 메모리 다이어트
