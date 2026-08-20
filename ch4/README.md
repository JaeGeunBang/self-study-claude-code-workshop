# Ch.4 — Settings (개인의 설정을 팀의 표준으로)

## 0. 목표

본 챕터에서는 설정 스코프와 우선순위를 설계하고, 권한 규칙과 모드를 조율하며, 훅으로 수명주기를 자동화하고, MCP와 커맨드로 나만의 개발 플랫폼을 완성함

1. **설정 설계** — 4스코프와 병합 규칙으로 개인, 팀 설정을 구조화
2. **권한 조율** — 규칙 문법과 모드 6종으로 마찰 없는 안전선 구축
3. **훅 자동화** — 이벤트와 핸들러 조합으로 워크플로 자동화
4. **확장 통합** — MCP, 커맨드, 스킬로 팀 표준 플랫폼 완성

## 1. Settings 체계

### 설정 스코프 4계층

| 스코프 | 위치 | 범위 |
|---|---|---|
| Managed | 서버 관리, plist/레지스트리, 시스템 파일 | 조직 전체, IT 배포 (Ch.3) |
| User | `~/.claude/settings.json` | 나의 전 프로젝트, 비공유 |
| Project | `.claude/settings.json` | 저장소 협업자 전원, 커밋 공유 |
| Local | `.claude/settings.local.json` | 이 저장소의 나만, gitignore |

- 용도 구분: 취향은 User, 팀 표준은 Project, 실험과 개인 예외는 Local

### 우선순위 5단

1. **Managed** — 무엇으로도 재정의 불가
2. **CLI 인자** — 실행 시 플래그, 그 세션 한정 임시 재정의
3. **Local** — `settings.local.json`, 프로젝트와 사용자 값을 덮음
4. **Project** — 팀 공유 표준, 사용자 값을 덮음
5. **User** — 아무도 지정하지 않았을 때의 내 기본값

### settings.json 해부

```jsonc
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": ["Bash(npm run lint)", "Bash(npm run test *)"],
    "deny": ["Read(./.env)", "Read(./secrets/**)"]
  },
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1"
  },
  "companyAnnouncements": ["코드 리뷰 필수, 가이드는 wiki 참조"]
}
```

### env 블록

- 설정 파일로 환경변수를 배포함
- 쉘 프로파일 대신 settings의 env 블록으로 환경변수를 스코프별로 배포함
- 프로젝트에 커밋하면 팀 전체의 변수가 통일됨

### 키 카탈로그 1 / 모델과 사고

| 키 | 설명 | 비고 |
|---|---|---|
| `alwaysThinkingEnabled` | 확장 사고 기본 활성화 | `/config`로 토글 |
| `availableModels` | 선택 가능한 모델 제한 | 메인, 서브에이전트, 스킬 공통 적용 |
| `enforceAvailableModels` | Default 선택지까지 강제 | managed 짝 키 |
| `advisorModel` | 어드바이저 도구 전용 모델 | `/advisor` 실행 시 기록 |
| `agent` | 세션 기본 에이전트 | Chapter 2의 `--agent` 설정판 |
| `model` | 세션 시작 시 1회만 읽힘 | 중간 변경은 `/model` (주의) |

### 키 카탈로그 2 / 운영

| 키 | 설명 | 비고 |
|---|---|---|
| `autoUpdatesChannel` | latest 기본, stable은 약 1주 지연 | 플릿은 stable 권장 (Ch.3) |
| `autoCompactEnabled` | 컨텍스트 자동 압축 | 기본 true |
| `autoMemoryEnabled` | 자동 메모리 축적 | `/memory`로 토글 |
| `cleanupPeriodDays` | 세션 파일 정리 주기, 기본 30 | 고아 worktree도 정리 |
| `attribution` | 커밋, PR 서명 문구 커스텀 | `commit`, `pr` 필드 |
| `companyAnnouncements` | 시작 공지 순환 표시 | 팀 공지판 |

### 키 카탈로그 3 / 끄기 스위치

| 키 | 설명 | 비고 |
|---|---|---|
| `disableAllHooks` | 전체 훅과 커스텀 상태줄 정지 | managed 계층 존중 |
| `disableBundledSkills` | 번들 스킬, 워크플로 제거 | 자체 표준만 쓸 때 |
| `disableAutoMode` | auto 모드 진입 봉쇄 | `"disable"` 값 |
| `disableAgentView` | 백그라운드 에이전트 뷰 차단 | 고통제 환경 |
| `disableRemoteControl` | 원격 제어 기능 차단 | MDM 배포 대상 |
| `disableSideloadFlags` | `--agents` 등 우회 플래그 거부 | managed 전용 (Ch.3) |

### 라이브 리로드

- 저장하면 대부분 즉시 반영됨
- 설정 파일은 감시되어 저장 즉시 세션에 반영됨
- `permissions`, `hooks`, `apiKeyHelper`가 대표이며, 변경마다 `ConfigChange` 훅이 발화됨

### 팀별 정책 조각의 무충돌 병합

```text
managed-settings.json           # 기본판 (먼저 병합)
managed-settings.d/
  10-telemetry.json             # 관측팀 조각
  20-security.json              # 보안팀 조각
  30-mcp-allowlist.json         # 플랫폼팀 조각
```

### 관용 파싱 vs 엄격 파싱

- 오타 하나가 정책 전체를 죽이지 않게
- managed 설정은 관용적으로, 개인 설정은 엄격하게 해석됨
- 검증 오류는 시작 대화상자와 `doctor` 명령이 알려줌

**Managed (관용)**
- 무효 항목만 제거, 나머지는 강제 유지
- 보안 키는 fail-closed: 무효한 allowlist는 빈 목록으로 처리
- `minimumVersion`류만 fail-open (기동 보장)
- 배포 전 `claude doctor`로 검증

**User, Project, Local (엄격)**
- 검증 실패 시 파일 전체 거부
- 오류는 시작 시 보고
- `$schema`로 사전 예방
- 고치기 전까지 해당 스코프 무시

### /config

```text
> /config
# 탭형 설정 UI: 상태 확인과 옵션 토글
> /config verbose=true
# UI 없이 단일 키 즉시 변경 (v2.1.181+)
# 자주 만지는 항목
# Auto-compact, Session recap, Push 알림,
# Thinking 기본값, 테마
# 어디에 저장되는지 표시되므로 스코프 확인 겸용
```

## 2. Permissions

### 3동사와 평가 순서

- deny가 항상 이긴다
- 규칙은 allow, ask, deny 세 목록으로 구성됨
- 도구 호출은 deny 대조가 먼저이며, allow에 있으면 조용히 실행되고, 어느 쪽도 아니면 모드가 기본 거동을 정함

### 규칙 문법 해부

```text
"Bash(npm run lint)"   # 도구(지정자)
# 도구만: 그 도구의 모든 호출
"WebFetch"             # 웹 페치 전부
# 지정자: 도구별 의미가 다름
# Bash -> 명령 패턴
# Read, Edit -> 파일 경로 패턴
# Agent -> 서브에이전트 타입 (Ch.2)
# mcp__server(__tool) -> MCP 도구 (Part 5)
```

### Bash 패턴

```text
"Bash(npm run lint)"    # 정확히 이 명령만
"Bash(npm run test *)"  # 이 접두 + 임의 인자
"Bash(git *)"           # git 하위 전부
# deny 예시
"Bash(curl *)"          # 임의 curl 차단
"Bash(rm -rf *)"
# 주의: 셸 체이닝, 치환의 우회 가능성
# 권한은 1차 방어, 강한 봉쇄는 sandbox (Ch.3)
# 훅 if의 서브커맨드 검사와 층이 다름 (Part 3)
```

### 파일 경로 패턴

```text
"Read(./.env)"
"Read(./.env.*)"
"Read(./secrets/**)"
"Edit(*.ts)"
"Read(~/.zshrc)"
"Read(//etc/passwd)"
```

### 특수 지정자

| 지정자 | 의미 | 비고 |
|---|---|---|
| `Agent(Explore)` | 특정 서브에이전트 타입 통제 | Chapter 2 복습 |
| `Agent` (지정자 없이) | 위임 자체를 통제 | deny 시 전 위임 봉쇄 |
| `mcp__github` | 서버 전체 도구 | Part 5, 6 |
| `mcp__github__get_issue` | 서버의 특정 도구 | 세밀 통제 |
| `WebFetch` (지정자 없이) | 도구 전체 | sandbox와 병용 (Ch.3) |
| `additionalDirectories` | 규칙이 아닌 접근 범위 확장 | 다음 파트 상세 |

### 권한 모드 6종

- Shift+Tab으로 순환

| 모드 | 설명 | 용도 |
|---|---|---|
| `default` | 표준: 위험 작업마다 확인 | 일상 기본 |
| `acceptEdits` | 작업 경로 편집 자동 수락 | 반복 수정 세션 |
| `plan` | 읽기 전용 탐색, 계획 산출 | 설계 단계 |
| `auto` | 분류기가 명령을 심사 후 자동 결정 | 신뢰 저장소 |
| `dontAsk` | 확인 프롬프트 자동 거부 | 무인, 명시 allow만 |
| `bypassPermissions` | 전 확인 생략 | 격리 환경 한정, 조직 차단 대상 |

### auto 모드 커스텀

- 분류기 규칙을 설정으로

```jsonc
{
  "autoMode": {
    "environment": ["사내 모노레포, k8s 스테이징 접근 가능"],
    "allow": ["$defaults", "kubectl get, describe 계열"],
    "soft_deny": ["$defaults", "terraform apply 금지"],
    "hard_deny": ["IAM 정책 변경 시도"],
    "classifyAllShell": true
  }
}
```

### dontAsk 무인 운용

- 물을 수 없는 곳의 규칙
- 확인이 필요한 호출을 자동 거부함
- 명시 allow만 실행되므로, 무인 스크립트에서 허용 목록이 곧 능력의 전부가 됨

### additionalDirectories

- 작업 범위를 넓히는 별도 키

```jsonc
{
  "permissions": {
    "additionalDirectories": [
      "../shared-lib",
      "~/reference/design-docs"
    ]
  }
}
```

### 조직 정책과의 상호 작용

> 내 allow는 조직 deny를 이길 수 없다 — 병합은 합집합이지만, deny 우선 원칙이 관리 차단을 절대선으로 만든다.

**개발자가 할 수 있는 것**
- 자기 allow로 마찰 줄이기
- 프로젝트 표준 allow, ask 제안
- `additionalDirectories` 확장
- 모드 선택 (차단 안 된 범위 내)

**조직이 강제하는 것**
- managed deny: 제거 불가
- `allowManagedPermissionRulesOnly`
- `disableBypassPermissionsMode`
- `disableAutoMode` 등 모드 봉쇄

### /permissions

```text
/permissions
```

### 설계 예시 / 팀 표준

- 웹 서비스 저장소의 permission

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(npm run lint)", "Bash(npm run test *)",
      "Bash(npm run build)", "Bash(git diff *)",
      "Bash(git log *)", "Bash(git status)"
    ],
    "ask": ["Bash(git push *)", "Bash(npm publish *)"],
    "deny": [
      "Read(./.env*)", "Read(./secrets/**)",
      "Bash(curl *)", "Bash(rm -rf *)"
    ]
  }
}
```

### 흔한 실수

- 현장에서 걸리는 지점

| 실수 | 교정 |
|---|---|
| `Bash(npm run test)`가 인자 붙자 불일치 | 인자 허용은 명령 뒤 공백 + 별표 (`Bash(npm run test *)`) |
| deny에 `.env`만 넣고 `.env.local` 누락 | `.env*`, `secrets/**` 패턴화 |
| 허용 과다로 ask의 의미 소실 | 회색 지대만 ask, 명확한 위험은 deny |
| local에 쌓인 규칙을 팀 표준에 미반영 | 주기적으로 local 검토 후 승격 |
| 권한만으로 네트워크 봉쇄 기대 | 봉쇄는 sandbox 도메인과 병행 (Ch.3) |

## 3. Hooks 아키텍처

### Hooks란 / 5가지 핸들러

- 훅은 세션 수명주기의 특정 지점에서 자동 실행되는 핸들러
- 쉘 명령을 넘어 HTTP, MCP 도구, LLM 프롬프트, 에이전트까지 다섯 타입으로 확장되었음

### 수명주기 3 케이던스

- 세션당, 턴당, 도구 호출당
- 이벤트는 발화 빈도로 세 층으로 나뉨

### 이벤트 카탈로그 1 / 코어

- 자주 사용하는 것들

| 이벤트 | 설명 | 비고 |
|---|---|---|
| `PreToolUse` | 도구 실행 전, 차단 가능 | 가드의 본진 |
| `PostToolUse` | 도구 성공 후 | 포맷터, 후처리 |
| `PostToolUseFailure` | 도구 실패 후 | 실패 대응 분기 |
| `UserPromptSubmit` | 프롬프트 제출 시 | 컨텍스트 주입 |
| `Stop` / `StopFailure` | 턴 종료 / API 오류 종료 | 알림, 오류 매처 |
| `SessionStart` / `SessionEnd` | 세션 시작(재개, clear 매처) / 종료 | 환경 준비, 정리 |

### 이벤트 카탈로그 2 / 에이전트와 권한

- 루프 내부의 확장 이벤트

| 이벤트 | 설명 | 비고 |
|---|---|---|
| `SubagentStart` / `SubagentStop` | 서브에이전트 생성, 종료(타입 매처) | Chapter 2 관측 |
| `PermissionRequest` | 권한 대화상자 표시 시점 | 승인 흐름 관측 |
| `PermissionDenied` | auto 분류기 거부 시, retry 지시 가능 | 재시도 정책 |
| `PostToolBatch` | 병렬 도구 묶음 완료 후 | 배치 단위 후처리 |
| `TaskCreated` / `TaskCompleted` | 작업 항목 생성, 완료 | 진행 추적 연동 |
| `TeammateIdle` | 팀 동료 유휴 직전 | Agent Teams 연계 |

### 이벤트 카탈로그 3 / 환경과 컨텍스트

- 세션 밖 변화에 반응

| 이벤트 | 설명 | 비고 |
|---|---|---|
| `FileChanged` | 감시 파일 변경(매처가 파일명) | `.env` 변경 감지 |
| `ConfigChange` | 설정 파일 변경(소스 매처) | 정책 변경 알림 |
| `CwdChanged` | 작업 디렉토리 이동 | direnv 류 연동 |
| `InstructionsLoaded` | CLAUDE.md, rules 로드 시 | 지침 적용 추적 |
| `PreCompact` / `PostCompact` | 압축 전후(manual, auto 매처) | 상태 보존, 재주입 |
| `WorktreeCreate` / `WorktreeRemove` | 워크트리 생성, 제거 커스텀 | 기본 git 동작 대체 |

### 구성 3단 중첩

- 이벤트, 매처 그룹, 핸들러

```jsonc
{
  "hooks": {
    "PreToolUse": [                            // 1. 이벤트
      {
        "matcher": "Bash",                     // 2. 매처 그룹
        "hooks": [                              // 3. 핸들러 목록
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh",
            "args": []
          }
        ]
      }
    ]
  }
}
# 위치: user, project, local settings + managed,
# plugin hooks.json, skill/agent frontmatter
```

### matcher 문법

- 문자 구성이 해석 방식을 결정

| 패턴 | 해석 방식 | 예시 |
|---|---|---|
| `*`, `""`, 생략 | 전체 매칭 | 이벤트 전체 발화 |
| 영숫자, `_`, `-`, 공백, `\|` | 정확 문자열 (목록은 `\|` 또는 `,`로 구분) | `Edit\|Write`, `Bash` |
| 그 외 문자 포함 | JS 정규식, 비앵커 | `^Notebook`, `mcp__s__.*` |
| mcp 주의 | `mcp__memory`는 정확 문자열이라 무매칭 | `mcp__memory__.*` 필수 |
| 앵커 권장 | `Edit.*`는 `NotebookEdit`도 매칭 | `^Edit$`로 전체 일치 |
| 이벤트별 대상 | 도구명, 에이전트 타입, 트리거, 파일명 등 | 카탈로그 표 참조 |

### if 필드

- 권한 규칙 문법으로 2차 필터

```jsonc
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "if": "Bash(git *)",          // 권한 규칙 문법 1개
      "command": "..."
    }
  ]
}
# Bash 서브커맨드까지 검사
# npm test && git push -> git * 매칭, 실행
# echo $(rm -rf /) -> rm * 매칭, 실행
# VAR=x git push -> 선행 대입 제거 후 매칭
# 파싱 불가면 fail-open: 강제는 권한, 훅은 보조
```

### 입력 JSON

- 핸들러가 받는 공통 필드

```json
{
  "session_id": "...",
  "prompt_id": "...",
  "transcript_path": "~/.claude/projects/.../*.jsonl",
  "cwd": "/home/dev/proj",
  "permission_mode": "default",
  "effort": { "level": "high" },
  "tool_name": "Bash",
  "tool_input": { "command": "rm -rf /tmp/build" }
}
```

- `prompt_id`: OTel 이벤트와 상관 연결
- `tool_name`, `tool_input`: 도구 이벤트 한정

### 결정 출력

- 침묵은 승인이 아니다

```bash
# 방식 1: JSON 결정 (권장)
jq -n '{ hookSpecificOutput: {
  hookEventName: "PreToolUse",
  permissionDecision: "deny",
  permissionDecisionReason: "Destructive command" } }'

# 방식 2: exit code
# exit 0 + 무출력 = 결정 없음 (정상 권한 흐름 계속)
# exit 2 + stderr = 차단, 사유가 Claude에게 전달
# 사용자 표시: systemMessage / 알림: terminalSequence
# 훅은 무단말 세션: /dev/tty 접근 불가 (v2.1.139+)
```

### exec form vs shell form

- `args` 유무가 실행 방식을 가른다
- `args`가 있으면 셸 없이 실행 파일을 직접 스폰하고, 없으면 셸이 문자열을 해석함
- 경로 플레이스홀더에는 exec form이 권장됨

### async와 timeout

- 블로킹을 다스리는 필드들

| 필드 | 기본값 | 비고 |
|---|---|---|
| `timeout` | command, http, mcp_tool 600초 / prompt 30초 / agent 60초 | - |
| 이벤트별 하향 | `UserPromptSubmit` 30초, `MessageDisplay` 10초 | 체감 지연 보호 |
| `async: true` | 백그라운드 실행, 턴을 막지 않음 | 느린 후처리 |
| `asyncRewake` | 백그라운드 + exit 2 시 Claude를 깨움 | 장기 감시 실패 보고 |
| `statusMessage` | 실행 중 스피너 문구 커스텀 | 사용자 체감 개선 |
| `once` | 세션당 1회 후 제거 | 스킬 프론트매터 전용 |

## 4. Hooks 실전

### HTTP 훅

- 중앙 서비스로 이벤트를 쏜다

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "http",
            "url": "https://hooks.corp.example/pre-tool",
            "timeout": 30,
            "headers": { "Authorization": "Bearer $HOOK_TOKEN" },
            "allowedEnvVars": ["HOOK_TOKEN"]
          }
        ]
      }
    ]
  }
}
# 이벤트 JSON이 POST 본문으로 전송
# 차단: 2xx + permissionDecision deny 본문
# 비2xx, 타임아웃은 비차단 오류로 계속 진행
```

### mcp 훅

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "security",
            "tool": "security_scan",
            "input": { "file_path": "${tool_input.file_path}" }
          }
        ]
      }
    ]
  }
}
# 입력에 ${경로} 치환으로 이벤트 필드 전달
# 서버는 이미 연결 상태여야 함 (OAuth 유발 없음)
# SessionStart, Setup에서는 연결 전이라 첫 실행 유의
```

### prompt, agent 훅

- 판정을 모델에게 맡김

```jsonc
{
  "type": "prompt",
  "prompt": "이 도구 호출이 마이그레이션 파일을 건드리면 deny하라. 입력: $ARGUMENTS",
  "model": "haiku"
}
{
  "type": "agent",
  "prompt": "diff를 읽고 스키마 파괴 변경 여부를 검증 후 결정하라. 입력: $ARGUMENTS"
}
# prompt: 단발 판정 (기본 fast model, timeout 30)
# agent: Read, Grep 등 도구로 확인 후 판정 (실험적)
```

### Recipe 1 / Auto Format

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/format.sh",
            "args": [],
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/format.sh
FILE=$(jq -r '.tool_input.file_path')
case "$FILE" in
  *.ts|*.tsx) npx prettier --write "$FILE" ;;
  *.py) ruff format "$FILE" ;;
esac
```

### Recipe 2 / 보호 가드

```bash
#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')
if echo "$COMMAND" | grep -q 'rm -rf'; then
  jq -n '{ hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "Destructive command blocked by hook" } }'
else
  exit 0  # 무결정: 정상 권한 흐름 계속
fi
# 등록: matcher Bash + if "Bash(rm *)" (스폰 절약)
```

### Recipe 3 / 알림

```jsonc
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt|agent_needs_input",
        "hooks": [
          { "type": "command", "command": "notify-send 'Claude가 입력을 기다립니다'" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "http", "url": "https://hooks.slack.com/services/T/B/x", "timeout": 10 }
        ]
      }
    ]
  }
}
# Notification 매처: permission_prompt, idle_prompt,
# agent_completed 등 유형별 선별
```

### Recipe 4 / 반응형 환경

```jsonc
{
  "hooks": {
    "FileChanged": [
      {
        "matcher": ".envrc|.env",
        "hooks": [
          { "type": "command", "async": true, "command": "direnv allow && echo env reloaded" }
        ]
      }
    ],
    "CwdChanged": [
      {
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/on-cd.sh" }
        ]
      }
    ]
  }
}
# FileChanged 매처 = 감시할 파일명 목록
# cd 명령마다 환경 재정렬, direnv 류와 궁합
```

### Recipe 5 / Setup과 컨텍스트 주입

```jsonc
// CI 1회 준비: claude --init-only 가 Setup 발화
{
  "hooks": {
    "Setup": [
      {
        "matcher": "init",
        "hooks": [
          { "type": "command", "command": "npm ci && cp .env.ci .env" }
        ]
      }
    ]
  }
}
```

```jsonc
// 프롬프트마다 최신 상태 주입
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "git status --short | head -5" }
        ]
      }
    ]
  }
}
// stdout이 컨텍스트로 추가됨 (timeout 30초 주의)
```

### /hooks 메뉴와 디버깅

- 무엇이 어디서 왔는지
- `/hooks`는 등록된 전체 훅의 읽기 전용 브라우저
- 타입 접두와 소스 라벨로 출처를 추적하고, 문제 시 `disableAllHooks`로 이분 탐색함

## 5. MCP 구성

### MCP와 3 프리미티브

- 도구, 리소스, 프롬프트
- MCP는 모델과 외부 시스템을 잇는 개방 표준이며, 서버는 세 종류의 능력을 노출하고 Claude Code가 클라이언트로서 이를 소비함

### 전송 4종

- 서버와 이어지는 네 길

| 전송 | 설명 | 용도 |
|---|---|---|
| `stdio` | 로컬 프로세스를 스폰해 표준 입출력으로 통신 | npx 배포 서버의 표준 |
| `http` | 원격 HTTP 엔드포인트, 요청-응답 | 관리형 서비스의 표준 |
| `sse` | 서버 전송 이벤트 스트림 | 레거시 원격, http로 이행 추세 |
| `ws` | 웹소켓 양방향 | 실시간성 요구 서버 |
| 선택 기준 | 로컬 도구는 stdio, SaaS는 http | URL이 있으면 원격 계열 |

### 설치 / claude mcp add

```bash
# stdio: -- 뒤가 실행 명령
$ claude mcp add playwright -- npx -y @playwright/mcp@latest

# 원격: transport 지정
$ claude mcp add --transport http github \
    https://api.githubcopilot.com/mcp/

# 스코프 지정 (-s): local(기본) | project | user
$ claude mcp add -s project sentry -- npx -y @sentry/mcp

$ claude mcp list / get <name> / remove <name>
```

### 스코프 3종과 저장 위치

| 스코프 | 저장 위치 | 범위 |
|---|---|---|
| `local` (기본) | `~/.claude.json`의 프로젝트별 항목 | 이 저장소의 나만, 비공유 |
| `project` | `.mcp.json` (저장소 루트) | 커밋 공유, 팀 표준 |
| `user` | `~/.claude.json` 전역 항목 | 내 전 프로젝트 |

- 우선순위: local > project > user (동명 시)
- 신뢰 확인: project 서버는 최초 사용 시 승인 절차를 거쳐, 저장소가 심어둔 악성 구성으로부터 보호함

### .mcp.json

- 팀 공유 서버 정의와 변수 확장

```jsonc
{
  "mcpServers": {
    "corp-wiki": {
      "type": "http",
      "url": "https://wiki-mcp.corp.example/mcp",
      "headers": { "Authorization": "Bearer ${WIKI_TOKEN}" }
    },
    "db": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@corp/db-mcp"],
      "env": { "DB_HOST": "${DB_HOST:-localhost}" }
    }
  }
}
```

### OAuth 인증 흐름

- 원격 서버 로그인의 표준

1. **추가** — http 서버 add, 미인증 상태
2. **`/mcp`** — 서버 선택, Authenticate 실행
3. **브라우저** — 제공자 로그인, 권한 동의
4. **토큰 저장** — 자동 갱신, 이후 무개입

### 사용하기

- 도구, 리소스, 프롬프트의 소비 창구

```text
# 도구: 자연어로, 권한 규칙은 mcp__ 이름
> github에서 이 저장소 열린 이슈 요약해줘
# 내부적으로 mcp__github__list_issues 호출

# 리소스: @ 멘션으로 컨텍스트 첨부
> @corp-wiki:onboarding/backend 읽고 셋업 도와줘

# 서버 프롬프트: 슬래시로 노출
> /mcp__github__pr_review 123

# 권한: allow에 mcp__github 또는 개별 도구
```

### /mcp 관리 UI

- 연결의 상황판
- `/mcp`는 서버 목록과 연결 상태, 도구 수, 인증을 한 화면에서 다룰 수 있음

### claude.ai 커넥터

- 웹에서 연결한 서버가 CLI로
- claude.ai에서 연결한 커넥터가 Claude Code 세션에도 자동 등장함
- 조직과 저장소는 설정 키로 이를 통제할 수 있음

### 도구 검색 / Tool Search

- 다수 서버 시대의 해법
- 서버가 많아지면 도구 정의만으로 컨텍스트가 잠식됨
- 도구 검색은 설명 대신 검색 인덱스를 두고, 필요한 도구만 온디맨드로 로드함

### 컨텍스트 예산

- 서버는 공짜가 아니다
- 연결된 서버의 도구 설명은 컨텍스트를 소비함
- 도구 검색이 완화하지만, 스코프 설계로 노출 자체를 줄이는 것이 근본임

## 6. MCP 운영과 보안

### 인기 서버 카탈로그

| 서버 | 용도 | 전송 |
|---|---|---|
| github | 이슈, PR, 코드 검색과 조작 | http, OAuth |
| playwright | 브라우저 구동, E2E와 스크린샷 | stdio, npx |
| sentry | 오류 이벤트 조회와 분석 | http, OAuth |
| slack | 채널 검색, 메시지 발신 | http, OAuth |
| postgres 계열 | 스키마 조회, 쿼리 실행 | stdio, 자격은 env |
| notion, linear, figma | 문서, 이슈, 디자인 컨텍스트 | http, OAuth |

### 사내 MCP 서버

- 사내 위키, 배포, 티켓 시스템을 서버로 노출하면 조직 컨텍스트가 도구가 됨
- 제작은 Agent SDK 계열 문서와 챕터 6에서 심화함
- 배포는 stdio 패키지 or 사내 http 엔드포인트
- 운영 결합은 OAuth 인증, allowlist 등재, 버전 관리

### 조직 통제 요약

| 키 | 설명 | 비고 |
|---|---|---|
| `allowedMcpServers` | 승인 서버 화이트리스트 | 빈 배열 = 전면 봉쇄 |
| `deniedMcpServers` | 명시 차단, allowlist보다 우선 | 사고 대응 즉시 배포 |
| `allowManagedMcpServersOnly` | managed 목록만 유효 | 최고 수준 통제 |
| `managed-mcp.json` | 조직 표준 서버 정의 배포 | 커넥터 기본 배제 |
| `disableSideloadFlags` | `--mcp-config` 등 우회 거부 | v2.1.193+ (Ch.3) |
| 적용 범위 | 서브에이전트 인라인 정의 포함 | Ch.2 우회 봉쇄 |

### 훅 결합

- `mcp__` 매처로 감사와 검증

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__.*__(write|create|delete).*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/mcp-write-guard.sh",
            "args": []
          }
        ]
      },
      {
        "matcher": "mcp__corp-wiki__.*",
        "hooks": [
          {
            "type": "command",
            "async": true,
            "command": "jq -c '{ts:now,tool:.tool_name}' >> ~/mcp-audit.jsonl"
          }
        ]
      }
    ]
  }
}
# 쓰기 계열 정규식 가드 + 서버 전체 비동기 감사
```

### 성능 관점

- 연결이 늘 때 생기는 비용

| 항목 | 설명 |
|---|---|
| STARTUP | 기동 지연 — stdio 다중 스폰과 원격 핸드셰이크가 시작을 늦춤 |
| CONTEXT | 컨텍스트 — 도구 정의 비대, 도구 검색과 스코프로 완화 (Part 5) |
| STRICT | 구성 고정 — `--strict-mcp-config`로 지정 구성 외 로드 배제 |
| BARE | 무장식 기동 — `--bare`로 MCP 등 확장 없이 최소 기동 |

### MCP 트러블 슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 서버 안 보임 | 스코프, 신뢰 승인 미완 | `/mcp` 목록과 출처 확인 |
| connection failed | 명령 경로, URL, 네트워크 | 단독 실행, curl 검증 |
| 401, 인증 오류 | OAuth 만료, 토큰 변수 미설정 | `/mcp` 재인증, env 확인 |
| 도구 호출 거부 | 권한 규칙 미허용 | `/permissions`에 `mcp__` 추가 |
| 조직에서 차단 | allowlist 미등재 | 관리자 등재 요청 (Ch.3) |
| 느린 시작 | 서버 과다, 무거운 stdio | 스코프 축소, 도구 검색 |

### 운영 모범 사례

1. **표준은 커밋** — 팀 서버는 `.mcp.json`으로, 개인 상주는 최소로
2. **비밀 외부화** — 토큰은 `${VAR}`와 볼트, 파일에는 절대 금지
3. **쓰기는 관문** — 쓰기 도구 ask + 훅 가드, 읽기는 넉넉히
4. **분기 정리** — 미사용 서버 제거, 버전과 인증 상태 점검

## 7. Commands와 Skills

### 확장 지형 / 무엇으로 고르나

| 확장 | 설명 | 비고 |
|---|---|---|
| CLAUDE.md | 항상 알아야 할 프로젝트 지식 | 상시 컨텍스트 (Ch.1) |
| Command / Skill | 반복 작업의 정형 절차 | 사용자가 호출, 본 파트 |
| Subagent | 격리 컨텍스트의 전담 워커 | 위임 실행 (Ch.2) |
| Hook | 수명주기 자동 반응 | 이벤트 구동 (Part 3, 4) |
| MCP | 외부 시스템 연결 | 도구 확장 (Part 5, 6) |
| Plugin | 위 전부의 배포 묶음 | 마켓 유통 |

### 커스텀 명령 기본

- Markdown 한 장이 슬래시 명령

```text
---
description: 최근 변경을 한국어로 요약
---
git log --oneline -10 결과를 바탕으로 이번 주 변경 사항을 다섯 줄로 요약하라.

# 사용
$ claude
> /summarize
# 위치: .claude/commands/(프로젝트), ~/.claude/commands/(개인)
# 파일명이 곧 명령 이름, 하위 폴더는 네임스페이스
```

### 인자 받기

- `$ARGUMENTS`와 위치 인자

```text
---
description: 이슈 번호로 수정 착수
argument-hint: "<이슈번호> [우선순위]"
---
이슈 #$1 을 조사해 수정하라.
우선순위는 $2, 전체 지시: $ARGUMENTS

# 사용
> /fix-issue 123 high
# $1=123, $2=high, $ARGUMENTS="123 high"
# argument-hint가 자동완성 힌트로 표시
```

### frontmatter 옵션

| 옵션 | 설명 | 비고 |
|---|---|---|
| `description` | 명령 목록과 모델 판단에 쓰이는 설명 | 필수 습관 |
| `argument-hint` | 자동완성에 표시할 인자 안내 | `<필수> [선택]` 관례 |
| `allowed-tools` | 이 명령 실행 중 허용 도구 제한 | 최소 권한 원칙 |
| `model` | 이 명령 전용 모델 지정 | 무거운 분석은 opus |
| `hooks` | 명령 활성 중 스코프 훅 (`once` 지원) | Part 3 프론트매터 훅 |
| `disable-model-invocation` | 모델의 자동 호출 금지 | 사용자 전용 명령 |

### 컨텍스트 수집

- `!`실행과 `@`참조

```text
---
description: PR 컨텍스트를 모아 리뷰 준비
allowed-tools: Bash(git *), Read
---
## 현재 상태
- 브랜치: !`git branch --show-current`
- 변경: !`git diff --stat main...HEAD`

## 기준 문서
@docs/review-checklist.md

위를 바탕으로 리뷰 관점 5가지를 제시하라.
```

### Skills 구조

- 명령의 성장형, 폴더와 리소스

```text
deploy-check/
  SKILL.md          # 본문 + frontmatter
  checklist.md       # 동봉 리소스
  scripts/verify.sh   # 동봉 스크립트

--- SKILL.md ---
---
name: deploy-check
description: 배포 전 검증 절차. 배포 언급 시 사용.
---
checklist.md의 항목을 순서대로 점검하고 scripts/verify.sh 실행 결과를 해석하라.
```

### 스킬 고급 옵션

| 옵션 | 설명 | 비고 |
|---|---|---|
| `context: fork` | 격리 컨텍스트에서 실행 후 요약 귀환 | 무거운 절차의 본진 보호 |
| `allowed-tools` | 스킬 활성 중 도구 제한 | 절차 단위 최소 권한 |
| `hooks` + `once` | 활성 중 스코프 훅, 세션 1회 옵션 | 준비 작업에 최적 |
| `disable-model-invocation` | 자동 발동 금지, `/` 호출 전용 | 위험 절차 안전판 |
| 번들 스킬 | 기본 동봉 절차들, 조직 비활성 가능 | `disableBundledSkills` |
| 플러그인 배포 | 스킬을 플러그인으로 묶어 유통 | 마켓, 팀 배포 |

### 실전 명령 1 / PR 리뷰

```text
---
description: 현재 브랜치 PR 리뷰 패키지 생성
argument-hint: "[base브랜치]"
allowed-tools: Bash(git *), Read, Grep, Agent
---
기준: !`git merge-base HEAD ${1:-main} 2>/dev/null || echo main`
변경: !`git diff --stat ${1:-main}...HEAD`

1. code-reviewer 서브에이전트로 diff 리뷰 위임
2. Critical, Warning, Suggestion으로 정리
3. 마지막 줄에 머지 가능 여부 판정
```

### 실전 명령 2 / 배포 점검

```text
---
description: 스테이징 배포 전 점검과 실행
argument-hint: "<환경: staging|prod>"
allowed-tools: Bash(git *), Bash(npm run *), Read
disable-model-invocation: true
---
대상 환경: $1
테스트: !`npm run test 2>&1 | tail -3`
미커밋: !`git status --short`

체크리스트 통과 시에만 배포 명령을 제시하고, 실패 항목이 있으면 배포를 중단하라
```

### 팀 라이브러리

- 명령 자산의 성장 경로
- 개인 명령에서 출발해 프로젝트 커밋으로, 성숙하면 플러그인으로
- 명령 자산도 코드처럼 리뷰와 버전을 가짐

1. **개인 검증** — `~/.claude/commands`에서 시작, 반복 확인
2. **프로젝트 승격** — `.claude/commands` 커밋, PR 리뷰 대상화
3. **플러그인화** — 다저장소 공통은 플러그인 + 마켓 배포
4. **큐레이션** — 명령 규칙, 설명 품질, 분기 정리 담당자

### 선택 가이드

| 상황 | 선택 | 예시 |
|---|---|---|
| 짧은 정형 프롬프트 | Command 한 장 | 요약, 번역, 템플릿 |
| 절차 + 동봉 자산 | Skill 폴더 | 체크리스트, 스크립트 묶음 |
| 무거운 실행 격리 | Skill `context: fork` | 본진 컨텍스트 보호 |
| 역할 + 도구 제한 워커 | Subagent (Ch.2) | 리뷰어, 스캐너 |
| 자동 반응 | Hook (Part 3, 4) | 이벤트 구동은 훅으로 |
| 판별 축 | 누가 부르나, 상태 격리가 필요한가 | 이 두 질문이면 충분 |

## 8. 통합과 트러블 슈팅

### 통합 예시 / .claude 풀스택

- `settings.json` — permissions 팀 표준, env 관측, hooks 3종
- `hooks/` — format.sh, block-rm.sh, mcp-write-guard.sh
- `commands/`, `skills/` — pr-review, deploy + deploy-check 스킬
- `.mcp.json` — corp-wiki, github, db 팀 서버 3종
- `agents/` — code-reviewer 등 Chapter 2 워커들

### 진단 도구 4종

| 도구 | 설명 | 비고 |
|---|---|---|
| `/context` | 컨텍스트 점유 분해: 지침, 도구, 대화 | 비대 원인 특정 |
| `/doctor` (`claude doctor`) | 환경, 설정 검증과 자동 수정 제안 | 무효 항목 출처 표시 |
| `/hooks` | 훅 브라우저: 타입, 매처, 소스 | Part 4 복습 |
| `/mcp` | 서버 상태, 도구, 인증 | Part 5 복습 |
| 보조 | `/status`, `/permissions`, `--verbose` | 구성 스냅샷과 로그 |

### Hooks 트러블 슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 안 발화 | 매처 불일치, 이벤트 오선택 | `/hooks`로 등록, 매처 확인 |
| `mcp__server` 무매칭 | 정확 문자열로 해석됨 | `__.*` 접미 추가 |
| 차단이 안 됨 | http 비2xx는 비차단 | 2xx + deny 본문으로 |
| 스크립트 오류 | 경로, 실행 권한, jq 부재 | 단독 실행으로 재현 |
| 프롬프트 지연 | `UserPromptSubmit` 무거움 | async 또는 30초 내로 |
| 전부 침묵 | `disableAllHooks` 잔존 | 설정 스코프 전수 확인 |
