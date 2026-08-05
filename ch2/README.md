# Ch.2 — Subagents

## 1. subagent 개념과 원리

### subagent란 무엇인가

- subagent는 특정 작업을 처리하는 격리된 Claude 인스턴스
- 자체 컨텍스트 윈도우, 맞춤 시스템 프롬프트, 별도 도구 권한으로 독립 작업 후 요약만 돌려줌
- 브라우저 탭에 비유할 수 있음

### 왜 위임하는가

- 컨텍스트 오염이 품질을 깎음
- 검색 결과, 로그, 파일 내용이 main 화면을 채우면 모델의 주의가 분산되고 응답 품질이 떨어지며, 다시 참조하지 않을 출력은 특히 낭비임

### main agent vs subagent

| 구분 | main agent | subagent |
|---|---|---|
| 컨텍스트 | 전체 대화 이력 보유 | 위임 메시지로 새 출발 |
| 시스템 프롬프트 | Claude Code 전체 프롬프트 | 정의 파일 본문 + 환경 정보 |
| 도구 | 세션의 전체 도구 | `tools` 필드로 좁힌 집합 |
| 산출물 | 사용자와의 대화 | 요약 결과 한 덩이 |
| 수명 | 세션과 함께 | 작업 완료 시 종료, resume 가능 |

### 격리의 실체

- subagent에게는 main agent가 작성한 위임 지시문만 전달되고, 대화 이력은 오지 않음

즉, subagent는

- 탐색과 구현 출력을 main 대화 밖으로 격리
- 도구 제한으로 읽기 전용 등 안전선 강제
- user 레벨 정의로 전 프로젝트 재사용
- 도메인 특화 프롬프트로 성공률 상승
- Haiku 같은 경량 모델로 라우팅해 비용 절감
- 프로젝트 정의를 버전 관리로 팀과 공유, 공동 개선

### Built-in subagent

- **읽기 전용 탐색 agent**: 코드베이스 검색과 분석에 최적화된 읽기 전용 agent로, Claude가 수정 없이 코드를 이해해야 할 때 자동으로 위임함
- 나머지 내장 agent: Plan, general-purpose, statusline-setup, claude-code-guide

v2.1.198부터 백그라운드가 기본값으로, 결과가 필요할 때만 포그라운드로 실행되며, 권한 프롬프트는 main 세션에 떠오름.

### 상태 모델 — 종료 후에도 살아있음

- **Lifecycle**: 각 호출은 새 인스턴스로 시작하지만, 완료된 agent의 대화 기록은 파일로 남아 이어서 재개할 수 있음 (Explore, Plan만 일회성)

### 모델 해석 순위

1. **환경변수** — `CLAUDE_CODE_SUBAGENT_MODEL`, alias나 모델 ID 지정 시 최우선
2. **호출 파라미터** — main agent가 Agent 도구 호출에 함께 넘기는 `model` 값
3. **Frontmatter** — 정의 파일의 `model` 필드 (sonnet, opus, haiku, fable)
4. **main 모델** — 위가 없으면 main 대화의 모델을 그대로 상속

### 4가지 병렬화 수단

| 수단 | 설명 |
|---|---|
| subagent | 한 세션 안의 워커, 새 컨텍스트, 요약 회수 |
| Fork | 대화 전체를 물려받는 subagent |
| Background agent | 독립 세션 여러 개를 한 화면에서 관찰 |
| Agent Teams | 세션들끼리 메시지로 협업, 더 무겁고 비쌈 |

> 판단 기준: 소통이 필요 없으면 subagent, 필요하면 Agent Teams

### subagent 6대 사용 사례

1. **고볼륨 격리** — 테스트 스위트 실행, 로그 처리의 대량 출력 격리
2. **병렬 리서치** — 독립 모듈 여러 개를 동시에 조사, 결과만 종합
3. **제2의 시선** — 구현과 분리된 신선한 컨텍스트로 리뷰와 검증
4. **권한 강제** — 읽기 전용, 도메인 한정 등 도구 제약을 역할로 고정
5. **문서 조회** — 외부 문서 다량 페치를 subagent에게 소화시키고 요점만 회수
6. **반복 역할** — 같은 지시를 반복하는 워커를 정의 파일로 상비군화

### Cost & Latency 고려 사항

- subagent는 새 컨텍스트에서 출발하므로 상황 파악 시간이 들고, 결과 회수도 토큰을 사용함. 이득이 오버헤드를 넘는지 판단이 필요함

### 안티패턴

- 잦은 왕복이 필요한 대화형 작업 위임
- 계획, 구현, 테스트가 맥락을 공유하는 일을 분리
- 한 줄 수정 같은 초단발 작업 위임
- 전 단계 결과에 의존하는 조사들의 병렬화
- 만능 agent 하나로 모든 역할 해결

## 2. 정의 방법

`.claude/agents/code-reviewer.md`

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---
You are a code reviewer. When invoked, analyze the
code and provide specific, actionable feedback on
quality, security, and best practices.
```

### scope 5계층과 우선순위

같은 이름이 충돌하면 위가 이김.

| 순위 | scope | 위치 | 특징 |
|---|---|---|---|
| 1 | Managed | 조직 관리 설정 디렉토리의 `.claude/agents/` | 관리자가 배포 |
| 2 | `--agents` 플래그 | 실행 시 JSON으로 주입 | 세션 한정, 디스크 저장 없음 |
| 3 | Project | `.claude/agents/` | 버전 관리로 팀 공유, 실무의 중심 |
| 4 | User | `~/.claude/agents/` | 내 모든 프로젝트에서 사용 |
| 5 | Plugin | 플러그인의 `agents/` | scope 이름 `my-plugin:name`으로 등록 |

### 배치 규칙 상세

- 재귀 스캔, 이름 유일성, 모노레포
- `agents` 디렉토리는 재귀 스캔되어 하위 폴더로 정리할 수 있으며, 정체성은 오직 `name` 필드이므로 이름 유일성이 관리 포인트

### 파일 워처 — 재시작이 필요 없음

- 저장하면 몇 초 안에 반영됨
- Claude Code가 `agents` 디렉토리를 감시하여, 파일을 추가하거나 수정하면 몇 초 안에 감지되어 다음 위임부터 새 정의가 적용됨

### 생성 방법

```text
> ~/.claude/agents/ 에 code-improver subagent를 만들어줘. 파일을 스캔해서 가독성, 성능,
모범 사례 개선점을 제안하는 역할이야. 각 이슈마다 문제 설명, 현재 코드, 개선 코드를
보여줘. 읽기 전용으로 하고 모델은 sonnet을 써.
# Claude가 name, description, tools, model,
# 시스템 프롬프트를 갖춘 파일을 작성

> code-improver agent로 이 프로젝트 개선점 제안해줘
# 저장 후 몇 초 뒤 바로 위임 가능
```

### name과 description

- 자동 위임을 좌우하는 필수 2개 필드
- Claude는 `description`을 읽고 위임 여부를 판단함. 언제 이 agent를 써야 하는지 명확할수록 자동 위임의 정확도가 올라감
- 무엇을 하는지보다 **언제 쓰는지**를 담아야 하며, `use proactively`, `MUST BE USED`가 자동 위임을 강화함

#### description 작성 비교

| 무시되는 설명 (막연함) | 위임되는 설명 (시점 명확) |
|---|---|
| 코드를 리뷰하는 agent | `Use proactively after writing or modifying code` |
| 테스트 관련 도우미 | `MUST BE USED when tests fail or coverage drops` |
| 보안 전문가 | `Use before commits touching auth, payments, or user data` |
| 역할만 있고 시점이 없음 | 행동 트리거가 문장에 내장 |
| Claude가 위임 시점을 못 찾음 | 매칭 조건이 곧 자동 위임 규칙 |

### tools 필드 — 허용 목록

역할에 필요한 도구만 부여.

```markdown
---
name: safe-researcher
description: Research agent with restricted capabilities
tools: Read, Grep, Glob, Bash
---
# 생략 시: main agent의 전체 도구를 상속 (MCP 포함)
# 지정 시: 나열한 도구만 사용 가능
# subagent에서 원천 불가한 도구
# AskUserQuestion, EnterPlanMode, ScheduleWakeup,
# WaitForMcpServers (UI, 세션 상태 의존)
```

### model 필드

| 값 | 설명 | 용도 |
|---|---|---|
| alias | sonnet, opus, haiku, fable | 일반적인 선택 |
| 전체 ID | `claude-opus-5`, `claude-sonnet-5` | 버전 고정 필요 시 |
| `inherit` | main 대화의 모델 그대로 | 생략 시 기본값 |

- **검증**: 조직 `availableModels` 허용 목록 통과 필수, 제외 모델은 상속으로 폴백
- **사고 설정**: 확장 사고는 main 설정을 그대로 상속, agent별 개별 설정 없음

### permissionMode 필드

| 값 | 동작 | 용도 |
|---|---|---|
| `default` | 표준 확인 프롬프트 | 일반 작업 |
| `acceptEdits` | 작업 경로의 편집 자동 수락 | 반복 수정 워커 |
| `auto` | 분류기가 명령과 보호 경로 쓰기 검토 | 신뢰 저장소 |
| `dontAsk` | 확인 프롬프트를 자동 거부 | 무인, 읽기 중심 |
| `plan` | 읽기 전용 탐색 | 조사 전용 워커 |

- **부모 우선**: 부모가 `bypass`, `acceptEdits`, `auto`면 그쪽이 우선하고 frontmatter는 무시됨

### skills 프리로드

```markdown
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---
# 나열한 skill의 본문 전체가 시작 컨텍스트에 주입
# 미나열 skill도 Skill 도구로 실행 중 호출은 가능
# skill 호출 자체를 막으려면 tools에서 Skill 제외
```

### mcpServers scope

이 agent에만 MCP 서버를 붙일 수 있음.

```markdown
---
name: browser-tester
description: Tests features in a real browser using Playwright
mcpServers:
  - playwright:            # 인라인: 이 agent 전용
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
  - github                 # 참조: 기존 서버 공유
---
# 인라인 서버는 시작 시 연결, 종료 시 해제
```

### memory 필드 — 영속 메모리

세션을 넘어 학습이 쌓이는 agent.

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
memory: project
---
You are a code reviewer. As you review code, update
your agent memory with patterns, conventions, and
recurring issues you discover.
# scope: user / project(권장) / local
# MEMORY.md 첫 200줄 또는 25KB가 프롬프트에 포함
```

### 이외 다른 필드들

| 필드 | 설명 | 비고 |
|---|---|---|
| `maxTurns` | agent 턴 수 상한 | 폭주 방지 안전장치 |
| `effort` | low, medium, high, xhigh, max | 세션 노력 수준 오버라이드 |
| `isolation: worktree` | 임시 git worktree에서 실행 | 변경을 체크아웃과 분리 |
| `background: true` | 항상 백그라운드로 실행 | 미지정 시 Claude가 선택 |
| `color` | red, blue, green 등 8색 | 작업 목록 표시 색상 |
| `initialPrompt` | `--agent` main 실행 시 첫 턴 자동 제출 | 세션형 agent 부팅 |

### hooks — frontmatter hook

이 agent가 도는 동안만의 검증.

```markdown
---
name: db-reader
description: Execute read-only database queries
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---
# 스크립트가 INSERT, UPDATE 등 감지 시 exit 2로 차단
```

### 공식 예시 1 — code-reviewer

```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively
  reviews code. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
---
You are a senior code reviewer.
When invoked: 1. Run git diff 2. Focus on modified
files 3. Begin review immediately
Provide feedback by priority: Critical / Warnings /
Suggestions, with fix examples.
```

### 공식 예시 2 — debugger

```markdown
---
name: debugger
description: Debugging specialist for errors, test failures,
  and unexpected behavior. Use proactively when
  encountering any issues.
tools: Read, Edit, Bash, Grep, Glob
---
You are an expert debugger specializing in root cause
analysis.
When invoked: capture error and stack trace, isolate
the failure, implement minimal fix, verify solution.
Focus on fixing the underlying issue, not the symptoms.
```

## 3. Agent 도구와 디스패치

### 명시 호출 3단계 사다리

제안에서 보장, 세션 전체까지. 한 번의 제안은 자연어, 이번 작업의 보장은 @멘션, 세션 전체의 기본값은 `--agent`이며, 강도가 한 칸씩 올라감.

- **LEVEL 1** — 자연어로 "test-runner subagent로 고쳐줘", Claude가 판단
- **LEVEL 2** — @멘션으로 `@agent-이름` 지목, 이번 작업은 반드시 그 agent
- **LEVEL 3** — `--agent`로 세션 자체가 그 agent의 프롬프트와 도구로 실행

### @멘션 상세

```text
> @ 입력 후 타입어헤드에서 선택
> @"code-reviewer (agent)" auth 변경 부분 봐줘
# 수동 표기
# 로컬: @agent-code-reviewer
# 플러그인: @agent-my-plugin:review:security
# 타입어헤드에는 실행 중인 background agent도
# 상태와 함께 표시
# 멘션은 어떤 agent가 돌지를 고정할 뿐,
# 지시문 작성은 여전히 main agent의 몫
```

### --agent 세션 전체 실행

```bash
$ claude --agent code-reviewer
# 세션 자체가 그 agent의 시스템 프롬프트,
# 도구 제한, 모델로 실행
# 특성
# 기본 Claude Code 프롬프트를 완전 대체
# CLAUDE.md와 프로젝트 메모리는 그대로 로드
# 시작 헤더에 @이름 표시, resume 시에도 유지
# 프로젝트 기본값 고정 (.claude/settings.json)
# { "agent": "code-reviewer" }
```

### 패턴 — 병렬 리서치

```text
> 인증, 데이터베이스, API 모듈을 각각 별도 subagent로 병렬 조사해줘.
각자 담당 영역의 구조와 핵심 흐름을 요약해서 보고해.
# 동작
# 독립 agent 3개가 동시에 탐색
# 각자 자기 컨텍스트에서 파일을 소화
# 완료되는 대로 요약이 main에 도착
# main agent가 세 보고를 종합
# 조건: 조사 경로가 서로 의존하지 않을 것
```

### 패턴 — 고볼륨 격리와 체이닝

```text
# 고볼륨 격리
> subagent로 전체 테스트 스위트를 돌리고, 실패한 테스트와 에러 메시지만 보고해줘
# 수천 줄 로그는 subagent에서 소화, 실패만 귀환

# 체이닝 (의존 작업의 순차 연결)
> code-reviewer subagent로 성능 이슈를 찾고, 그다음 optimizer subagent로 고쳐줘
# 앞 결과를 main agent가 받아 다음 지시문에 반영
```

### 백그라운드 운용

- 패널, 권한, 전환키
- background agent는 프롬프트 아래 패널에 나타나며, 권한 요청은 main에 떠오르고, 완료 결과는 메시지로 도착함

### 중첩 subagent

- agent가 agent를 부름
- subagent도 자기 subagent를 만들 수 있으며, 위임받은 작업이 다시 하위 작업으로 갈라질 때 중간 출력이 main에 닿지 않음

### /fork 상세

대화 전체를 물려받는 특수 subagent.

```text
> /fork 지금까지의 파서 변경에 대한 단위 테스트 초안 작성
# 지시문 첫 단어들로 이름이 자동 부여
# 패널에 행 추가, 백그라운드로 진행
# 패널 조작
# 위아래 화살표: 행 이동
# Enter: 트랜스크립트 열람, 후속 지시
# x: 중지 또는 완료 정리
# Esc: 프롬프트로 복귀
# 열람 중 /model, /fast는 main 대상임을 안내
```

### Fork vs Named subagent

무엇을 물려받느냐의 차이가 있음.

| 구분 | Fork | Named subagent |
|---|---|---|
| 컨텍스트 | 전체 대화 이력 | 지시문으로 새 출발 |
| 프롬프트, 도구 | main과 동일 | 정의 파일의 것 |
| 모델 | main과 동일 | `model` 필드 |
| 프롬프트 캐시 | main과 공유 | 별도 캐시 |
| 선택 기준 | 배경 설명이 긴 곁가지 | 역할이 정형화된 작업 |

### 에러 처리

- 실패가 결과로 둔갑하지 않게, API 오류로 끊긴 agent는 오류 텍스트를 결과인 척 반환하지 않고 실패로 정확히 보고

### 관측과 디버깅

트랜스크립트, 압축 로그, 수명 주기 hook.

```jsonc
// 트랜스크립트 위치
// ~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl

// 압축 이벤트도 파일에 기록
{ "type": "system", "subtype": "compact_boundary",
  "compactMetadata": { "trigger": "auto",
  "preTokens": 167189 } }

// settings.json의 수명 주기 hook
// SubagentStart / SubagentStop, 이름 매처 지원
// 예: db-agent 시작 시 연결 준비, 종료 시 정리
```

### 선택 가이드 (main agent vs subagent vs /btw vs skill)

| 상황 | 선택 | 이유 |
|---|---|---|
| 계획, 구현, 테스트가 맥락 공유 | main agent | 대화 한 흐름 유지 |
| 대량 출력 작업, 요약만 필요 | subagent | 격리의 본령 |
| 도구, 권한 제약을 강제할 작업 | subagent | 역할 설계 |
| 대화 맥락에 대한 빠른 질문 | `/btw` | 전체 참조, 이력 미기록 |
| 재사용할 프롬프트, 워크플로 | skill | main 컨텍스트에서 실행 |

## 4. agent 예시 — Code Reviewer

Code Reviewer는 커밋 전 셀프 리뷰를 표준화하며, 사람 리뷰어에게 가기 전에 명백한 결함과 보안 이슈를 걸러 리뷰 왕복 횟수를 줄이는 것이 목표임.

### 정의 완성본

```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively
  reviews code. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
memory: project
---
You are a senior code reviewer ensuring high standards
of code quality and security.
When invoked: run git diff, focus on modified files,
begin review immediately.
```

### 시스템 프롬프트 심화

```text
Review checklist:
- 명확성: 함수와 변수 이름, 중복 코드
- 안전성: 에러 처리, 입력 검증, 시크릿 노출
- 품질: 테스트 커버리지, 성능 고려

Provide feedback organized by priority:
- Critical (must fix): 파일:라인 + 수정 예시
- Warnings (should fix)
- Suggestions (consider improving)

결론에 머지 가능 여부를 한 줄로 판정.
```

### 영속 메모리 결합

리뷰할수록 똑똑해지는 리뷰어.

- `memory: project`로 이 저장소의 반복 이슈와 컨벤션이 축적됨
- 팀은 메모리 디렉토리를 버전 관리에 올려 학습까지 공유함

| 단계 | 내용 |
|---|---|
| WRITE (축적 지시) | 본문에 발견 패턴을 메모리에 기록하라는 지시 포함 |
| READ (선참조 지시) | 리뷰 전에 과거 패턴을 먼저 확인하라고 호출 시 요청 |
| SHARE (팀 공유) | `.claude/agent-memory/` 커밋으로 학습 자체를 공유 |
| CURATE (정리 주기) | `MEMORY.md` 상한 초과 시 agent가 스스로 큐레이션 진행 |

### 호출 경로 — 대화형

```text
# 자동 위임 (description 매칭)
> 결제 모듈 리팩토링 끝났어, 커밋 전에 점검하자
# 수정 직후 문맥이 code-reviewer를 자동 발동

# 멘션으로 보장
> @agent-code-reviewer 이번 diff 봐줘.
메모리의 과거 패턴 먼저 확인하고 시작해.

# 체이닝
> 리뷰에서 Critical만 debugger subagent로 바로 수정하고 재검토까지 돌려줘
```

그 외 헤드리스, GitHub Actions를 통해 code reviewer를 호출할 수 있음.

### 자주 만나는 함정

| 함정 | 솔루션 |
|---|---|
| `description`에 시점이 없어 자동 위임 불발 | `Use immediately after...` 시점 문구 명시 |
| Bash 누락으로 `git diff` 실행 불가 | `tools`에 Bash 포함, hook으로 diff만 허용 |
| 출력 형식 미지정, 리뷰가 산문으로 흩어짐 | 우선순위 3단계와 `파일:라인` 형식 강제 |
| 저장소 전수 검사로 시간과 토큰 폭증 | diff 중심 범위를 본문에 명문화 |
| CI에서 Agent 도구 미허용으로 위임 실패 | `allowed-tools`에 Agent 포함 확인 |

## 5. agent 예시 — Security Scanner

### 읽기 전용 + PreToolUse 이중 잠금

```markdown
---
name: security-scanner
description: Security specialist. MUST BE USED before
  commits touching auth, payments, or user data.
tools: Read, Grep, Glob, Bash
model: opus
memory: project
permissionMode: dontAsk
hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: command, command: "./scripts/ro-guard.sh" }] }] }
---
```

### ro-guard.sh — hook 검증 스크립트

읽기 명령만 통과시킬 수 있음.

```bash
#!/bin/bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# 허용: 조회 계열만
echo "$CMD" | grep -qE \
  '^(git (diff|log|show|status)|grep|rg|cat|head|ls|find|npm audit|pip-audit|trivy)' \
  && exit 0

echo "Blocked: read-only commands only" >&2
exit 2
```

### 본문에 명시하는 6대 관점

- 인젝션
- 인증, 인가
- 민감 데이터
- 입력 검증
- 설정 결함
- 의존성

### 시크릿과 의존성 스캔

**시크릿 탐지**

- API 키, 토큰, 비밀번호 패턴 검색
- 엔트로피 높은 문자열 후보 추출
- `.env` 예시 파일과 실제 파일 구분
- 이력 유출 시 회전 절차 안내까지

**의존성 스캔**

- `npm audit`, `pip-audit` 실행과 해석
- 심각도별 분류, 수정 버전 확인
- 직접 의존과 전이 의존 구분 보고
- 락 파일 기준 재현 가능한 결과

### pre-commit 게이트 통합

치명 이슈는 커밋 자체를 차단할 수 있음.

`.git/hooks/pre-commit`

```bash
#!/bin/bash
STAGED=$(git diff --cached --name-only | grep -E \
  'auth|payment|user' || true)
[ -z "$STAGED" ] && exit 0   # 민감 경로 없으면 통과

RESULT=$(claude -p "security-scanner subagent로 스테이징된 변경을 스캔, 마지막 줄에 Critical N건" \
  --allowed-tools "Agent,Read,Grep,Glob,Bash")

echo "$RESULT" | tail -1 | grep -q "Critical 0건" || {
  echo "보안 Critical 발견, 커밋 중단"
  exit 1
}
```

### 오탐 처리와 메모리

- 오탐이 반복되면 게이트는 무시됨
- 확인된 오탐을 메모리에 축적해 같은 지적이 되풀이되지 않게 만드는 순환이 핵심임
