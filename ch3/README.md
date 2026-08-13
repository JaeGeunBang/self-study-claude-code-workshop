# Ch.3 — Admin Setup (개인의 도구를 조직의 플랫폼으로)

## 1. 배포 전략

500대에 설치하고 갱신하는 방법

- 설치 채널 4계열과 조직 관점 선택
- 사내 미러와 Artifactory 운영
- 버전 통제: 채널 고정과 MinimumVersion
- 점진 롤아웃과 에어갭 대응

### 설치 채널 4계열 / 조직 관점

- 무엇으로 500대에 설치할 것인지?

| 채널 | 설명 | 용도 |
|---|---|---|
| Native 스크립트 | claude.ai/install.sh, 단일 바이너리, 자동 갱신 | 표준 권장, MDM 스크립트화 |
| OS 패키지 저장소 | apt, dnf, apk 공식 저장소, GPG 서명 | 리눅스 서버 플릿 |
| 패키지 매니저 | Homebrew cask, WinGet | 개발자 셀프서비스 |
| 컨테이너 | 표준 이미지, devcontainer | CI 러너, 통제 환경 |
| npm (레거시) | Node 의존, 신규 배포 비권장 | 기존 파이프라인 호환용 |

### Linux 플릿 / 공식 저장소 등록

- GPG 검증 포함 표준 절차

```bash
$ sudo install -d -m 0755 /etc/apt/keyrings
$ sudo curl -fsSL https://downloads.claude.ai/keys/claude-code.asc \
    -o /etc/apt/keyrings/claude-code.asc
$ gpg --show-keys /etc/apt/keyrings/claude-code.asc
# 지문 대조: 31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE
$ echo "deb [signed-by=/etc/apt/keyrings/claude-code.asc] \
https://downloads.claude.ai/claude-code/apt/stable stable main" \
  | sudo tee /etc/apt/sources.list.d/claude-code.list
$ sudo apt update && sudo apt install claude-code
```

### 사내 미러 운영

- Artifactory, Nexus로 다운로드 경로를 내재화
- 외부 다운로드가 막힌 망이나 대역폭, 감사 요구가 있는 조직은 공식 저장소를 사내 아티팩트 서버로 미러링함

### 표준 컨테이너 이미지

```dockerfile
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y \
    curl git ca-certificates ripgrep jq
RUN curl -fsSL https://claude.ai/install.sh | bash -s 2.1.201
ENV PATH="/root/.local/bin:${PATH}"
ENV DISABLE_AUTOUPDATER=1
COPY managed-settings.json /etc/claude-code/
WORKDIR /workspace
# 버전 고정 + 자동갱신 차단 + 정책 내장이 3원칙
```

### 버전 통제 두 다이얼

- 채널과 최소 버전
- `autoUpdatesChannel`로 갱신 속도를, `minimumVersion`으로 하한선을 통제함. 둘 다 관리 설정으로 강제할 수 있음

### 오프라인, 에어갭 환경

- 외부망 없는 곳의 선택지
- 설치는 미러로 해결되지만 추론 트래픽은 모델 엔드포인트가 필요함
- 완전 격리망은 클라우드 프라이빗 연결이 현실적인 답 (Bedrock + PrivateLink)
- 정책은 파일 기반 managed-settings를 형상 관리로 배포

### 사용량, 용량 예측

- 도입 전 산정의 기준선

| 항목 | 내용 |
|---|---|
| 좌석 산정 | 활성 개발자 기준, 파일럿 실측으로 배수 보정 |
| 토큰 추정 | 1인 1일 세션 수와 평균 규모를 파일럿에서 실측 |
| 모델 배분 | Sonnet 중심, Opus 비중이 비용의 지배 변수 |
| 피크 대비 | 클라우드 경로는 리전 쿼터와 스로틀 한도 사전 확인 |

## 2. 공급자와 자격증명 (키를 나눠주지 않는 인증 설계)

### 공급자 결정표

| 공급자 | 특징 | 용도 |
|---|---|---|
| Teams / Enterprise | 좌석제, 인프라 불필요, 기본 권장 | claude.ai와 통합 관리 |
| Claude Console | API 우선, 종량 과금 | 파이프라인 중심 조직 |
| Amazon Bedrock | AWS 컴플라이언스와 과금 상속 | AWS 표준 기업 |
| 혼합 | LLM gateway로 단일 엔드포인트 | 중앙 로깅 요구 시 |

### 인증 우선순위 복습

1. **환경변수 강제 스위치** — `CLAUDE_CODE_USE_BEDROCK` / `USE_VERTEX` / `USE_FOUNDRY`
2. **`ANTHROPIC_API_KEY`** — 환경변수 키, CI와 서버 자동화 경로
3. **`apiKeyHelper`** — settings의 동적 키 헬퍼 스크립트, 볼트 연동 지점
4. **OAuth 토큰** — `setup-token` 장기 토큰, claude.ai 로그인 세션

### Bedrock 설정 개요

- 조직 표준 환경 구성

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=ap-northeast-2
# 모델 alias는 리전 가용성에 맞춰 해석됨
# 필요 시 인퍼런스 프로파일 ID로 고정
# export ANTHROPIC_MODEL=apac.anthropic.claude-sonnet-5-v1:0
$ aws sso login --profile dev && export AWS_PROFILE=dev
$ claude # /status 로 Bedrock 활성 확인
```

### Bedrock IAM 정책

- 최소 권한의 표준형

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ClaudeCodeInvoke",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.*"
    }
  ]
}
```

### Bedrock + Identity Center SSO

- 키 없는 인증의 전체 흐름
- 개발자는 브라우저 로그인만 하면 되고, 자격증명은 단기 토큰으로 자동 발급됨. 퇴사자는 IdP에서 끊는 순간 접근이 사라짐

1. **IdP 로그인** — `aws sso login`, 브라우저 인증
2. **권한 매핑** — 그룹 → Permission Set
3. **단기 자격 증명** — STS 토큰 자동 발급, 갱신
4. **Bedrock 호출** — Claude Code가 SDK 체인으로 사용

### Claude Platform on AWS

- Anthropic 운영 API를 AWS 인증으로
- Anthropic이 운영하는 Claude API를 AWS IAM 인증과 Marketplace 과금으로 쓰는 경로이며, 최신 기능 속도와 AWS 거버넌스를 함께 가져감

### API Key 분배의 위험과 대안

> 정적 키를 사람에게 주지 않을 것 — 키 분배는 유출, 이직, 회전의 3중 부담을 만듦. 사람에게는 SSO, 기계에는 볼트와 헬퍼가 원칙임.

### apiKeyHelper / 볼트 통합

- 키가 필요하다면 동적으로

```jsonc
// ~/.claude/settings.json
{
  "apiKeyHelper": "/opt/claude/get-key.sh",
  "env": { "CLAUDE_CODE_API_KEY_HELPER_TTL_MS": "300000" }
}
```

```bash
#!/bin/bash
# /opt/claude/get-key.sh
aws secretsmanager get-secret-value \
  --secret-id claude/team-api-key \
  --query SecretString --output text
# TTL마다 재호출, 회전이 클라이언트에 자동 반영
```

### PrivateLink와 VPC Endpoint

- 추론 트래픽의 프라이빗 경로
- Bedrock 호출을 인터넷 없이 VPC 내부에서 처리함
- 폐쇄망 요건과 데이터 경로 통제 요구의 표준 답안

1. **Setup** — bedrock-runtime 인터페이스 엔드포인트 생성
2. **DNS** — Private DNS 활성으로 SDK 무수정 전환
3. **Control** — 엔드포인트 정책으로 호출 가능 모델, 주체 제한
4. **Audit** — VPC Flow Logs로 트래픽 경로 증적

## 3. Claude Apps Gateway (자체 호스팅 SSO 게이트웨이)

### 왜 게이트웨이인가?

- Bedrock은 인증과 과금을 상속하지만, 조직 로그인 경험과 그룹별 모델 통제, 개인 지출 한도는 제공할 수 없음
- 이를 게이트웨이가 수행함

### 아키텍처 / gateway.yaml 구성

| 구성 요소 | 역할 |
|---|---|
| Listener + TLS | 수신 포트와 인증서, 조직 도메인으로 서비스 |
| OIDC + Session | IdP 연동 사인온, 세션 저장은 Postgres |
| Policy | managed 정책, 그룹 매핑, 지출 한도 판정 |
| Model Routing | 요청 모델을 그룹 규칙에 따라 허용, 치환 |
| Upstream | Bedrock, Agent Platform, Foundry로 전달 |

### 키도 프로파일도 없는 로그인

```bash
# 클라이언트는 게이트웨이만 바라봄
export ANTHROPIC_BASE_URL=https://claude-gw.corp.example
$ claude
# 브라우저가 열리고 조직 IdP 로그인 (OIDC)
# 세션 수립, 이후 요청은 게이트웨이가 상류 인증 대행
> /status
# 공급자: gateway 경유, 그룹과 허용 모델 확인
# AWS 프로파일, 정적 키, 리전 설정이 전부 사라짐
```

### 그룹별 모델 라우팅 (gateway.yaml)

```yaml
routing:
  groups:
    - match: "eng-platform"
      allowedModels: [opus, sonnet, haiku]
    - match: "eng-default"
      allowedModels: [sonnet, haiku]
      rewrite: { opus: sonnet }
    - match: "contractors"
      allowedModels: [haiku]
```

### 지출 한도 / Admin API

- 개발자별 일, 주, 월 캡을 실시간 강제

```bash
# 한도 설정
$ curl -X PUT https://claude-gw.corp.example/admin/limits \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{ "subject": "user:jdoe", "period": "month", "usd": 300 }'
# 동작
# 게이트웨이가 요청마다 누적 지출을 판정
# 한도 도달 시 요청 거부, 사용자에게 사유 표시
# 그룹 기본값 + 개인 예외의 2단 구성 가능
```

### 배포와 운영

- Kubernetes, Cloud Run 표준 경로
- 컨테이너 하나와 Postgres만 있으면 되며, IdP 등록, 시크릿, 헬스체크, 업그레이드의 운영 절차가 공식 문서로 제공됨

### OTLP 텔레메트리

- 요청 단위로 중앙에서 관측

### apps gateway VS 일반 LLM Gateway

- 일반 LLM 게이트웨이는 범용 프록시, apps gateway는 Claude Code 조직 운영에 특화된 완제품

| 항목 | 일반 LLM Gateway (LiteLLM 등) | Claude Apps Gateway |
|---|---|---|
| 목적 | 다중 벤더 추상화 | Claude Code 전용 설계 |
| 정책 인지 | Claude Code 정책 모델 미인지 | managed 정책과 자연 결합 |
| 한도 / 라우팅 | 직접 구현 필요 | SSO, 라우팅, 한도가 내장된 완제품 |
| 유지보수 | 범용 프록시 유지보수 부담 | 공식 배포, 운영 문서 제공 |

## 4. 네트워크와 보안 (사내망에서 안전하게 통과시키기)

### 필수 아웃바운드와 도메인

| 도메인 | 용도 | 비고 |
|---|---|---|
| api.anthropic.com | 추론 API (Anthropic 직결 경로) | Bedrock 경로는 불필요 |
| claude.ai | 구독 로그인, 서버 관리 설정 수신 | Teams, Enterprise |
| downloads.claude.ai | 설치 자산, 패키지 저장소, 자동 갱신 | 미러 운영 시 대체 |
| statsig 계열 | 기능 플래그 수신 | 차단 시 기본값 동작 |
| sentry 계열 | 오류 리포트 송신 | 차단 가능, 진단 저하 |
| 클라우드 엔드포인트 | bedrock-runtime.\<region\>.amazonaws.com 등 | PrivateLink로 대체 가능 |

### 사내 프록시 통과

```bash
export HTTPS_PROXY=http://proxy.corp.example:8080
export HTTP_PROXY=http://proxy.corp.example:8080
export NO_PROXY=localhost,127.0.0.1,.corp.example
# 조직 배포: /etc/profile.d 또는 MDM 프로파일로
# NO_PROXY에 사내 MCP, 게이트웨이 도메인 포함
$ claude # /status 와 첫 응답으로 경로 확인
# 실패 시 진단: curl -v https://api.anthropic.com/ 로
# 프록시 계층과 TLS 계층을 분리 확인
```

### 사내 MCP 서버 통합

- 내부 시스템을 도구로
- 사내 위키, 티켓, 배포 시스템을 MCP로 노출하면 Claude Code가 조직 컨텍스트를 갖게 되며, 네트워크와 정책 두 층의 준비가 필요함

## 5. 거버넌스와 정책 (개인이 못 바꾸는 것을 설계한다)

### managed settings 4채널 (정책이 기기에 도달하는 네 경로)

| 순위 | 채널 | 경로 | 범위 / 비고 |
|---|---|---|---|
| 1 | Server-managed | claude.ai 어드민 콘솔에서 배포 | 전 플랫폼, Teams/Ent 전용 |
| 2 | plist / HKLM | com.anthropic.claudecode, HKLM\...\ClaudeCode | macOS, Windows, 변조 저항 |
| 3 | 파일 기반 | /etc/claude-code/managed-settings.json 등 | 전 플랫폼, 형상 관리 배포 |
| 4 | HKCU | 사용자 레지스트리, 권한 상승 불필요 | Windows, 편의용 (비강제) |

> 규칙: 기기에서 처음 발견되는 채널 하나만 사용하며, `/status`가 소스를 표기함

### 조직 CLAUDE.md 정책

- 모든 세션에 실리는 지시문
- 관리 정책 경로에 둔 CLAUDE.md는 전 세션에 로드되며 사용자가 제외할 수 없음
- 규칙이 아니라 행동 지침을 배포하는 채널

| 항목 | 내용 |
|---|---|
| 배치 경로 | managed 설정 디렉토리, 4채널과 동일 배포 |
| 제외 불가 | 개인, 프로젝트 메모리보다 앞서 항상 로드 |
| 담을 내용 | 보안 수칙, 금지 관행, 사내 표준 링크 등 지침 |
| 담지 않을 것 | 긴 문서 전문, 프로젝트별 세부는 각 계층으로 |

### 권한 패턴 설계 전략

> deny는 좁고 단단하게, allow는 넓고 명시적으로 — managed deny는 논쟁 없는 위험한 최소로 고정하고, 생산성 allow는 넉넉히 명시하며, 회색 지대는 ask, auto 분류기에 맡김

**managed deny (최소, 불변)**
- 파괴 명령: `rm -rf`, 디스크 포맷류
- 자격증명 파일 읽기: `.env`, 키 경로
- 파이프 실행: `curl | bash` 패턴
- IAM 변조 등 권한 상승 명령

**allow와 회색 지대**
- 빌드, 테스트, 린트 명령 명시 allow
- git 조회 계열 전면 allow
- push, 배포는 ask로 확인 유지
- 나머지는 auto 분류기 + 신뢰 경계

### 감사 훅 / 조직 로그

- 누가 무엇을 실행했는가

```jsonc
// managed-settings.json 발췌
{
  "allowManagedHooksOnly": true,
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit",
        "hooks": [{ "type": "command", "command": "/opt/claude/audit.sh" }]
      }
    ]
  }
}
```

- `/opt/claude/audit.sh`: stdin JSON을 요약해 사용자, 시각, 도구, 대상 4필드를 사내 로그로 송신
- `exit 0` 유지: 기록만 하고 차단하지 않음

### 적용 검증 / /status

```text
> /status
# 출력 중 확인 라인
Enterprise managed settings (file)
# 괄호 안 소스: remote | plist | HKLM | HKCU | file
# 함께 확인
# Provider: Bedrock (env 강제 반영 여부)
# Model: 조직 기본 모델
# Sandbox: enabled
# 파일럿 기기 전수에서 소스 표기 스크린샷 수집
```

## 6. 모니터링과 비용 (쓰임을 보고, 비용을 귀속시키기)

- 무엇을 보고 싶은가로 고름

| 항목 | 설명 | 제공 범위 |
|---|---|---|
| Usage monitoring | OTel로 세션, 도구, 토큰 송출 | 전 공급자 지원 |
| Analytics 대시보드 | 사용자별 지표, 기여 추적 | Anthropic 경로 전용 |
| Cost tracking | 지출 한도, 사용 귀속 | Anthropic 경로 전용 |
| 클라우드 경로 | Cost Explorer, GCP Billing, Azure CM | 과금 데이터 직접 활용 |
| 대시보드 주소 | claude.ai/analytics/claude-code | Teams, Enterprise 포함 |

### OTel 설정

```jsonc
// managed-settings.json 의 env 로 전사 배포
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://otel-collector.corp.example:4317",
    "OTEL_RESOURCE_ATTRIBUTES": "department=platform,team=payments"
  }
}
```

### 메트릭 카탈로그

| 카테고리 | 내용 | 용도 |
|---|---|---|
| 세션 | 세션 수, 활성 시간 | 채택률 지표 |
| 토큰 | 입력, 출력, 캐시 읽기/생성 | 비용 근사 원천 |
| 비용 | 추정 비용 카운터 | 모델 단가 반영 |
| 도구 | 도구별 호출 수, 승인/거부 | 정책 마찰 신호 |
| 코드 변화 | 수정 라인, 커밋, PR | 기여 추적 |
| 이벤트 | 프롬프트 제출 등 로그 | SIEM 연계 소스 |

### 비용 최적화 전략

1. **모델 배분** — 탐색은 haiku, 본대는 Sonnet, opus는 선별
2. **캐시 활용** — 프롬프트 캐시 적중 관리, fork의 캐시 공유
3. **컨텍스트 위생** — `/clear` 습관, compact 임계 조정
4. **서브에이전트** — 고볼륨 출력 격리로 메인 토큰 절약
5. **배치 시간대** — 무인 작업은 야간 예약으로 피크 회피
6. **한도 계층** — 그룹 기본 + 개인 예외의 지출 캡

## 7. 신원, 데이터, 컴플라이언스 (감시관의 질문에 답하는 체계)

### 신원 통합의 두 레벨

- 계정 레벨과 클라우드 레벨을 구분
- SSO, SCIM, 좌석 배정은 Claude 계정 레벨에서, Bedrock 접근 권한은 클라우드 IAM 레벨에서 관리됨

### CloudTrail 통합

- Bedrock 호출의 감사 원장

```bash
# InvokeModel은 데이터 이벤트: 트레일에 명시 활성 필요
$ aws cloudtrail put-event-selectors \
  --trail-name org-trail \
  --advanced-event-selectors '[{
    "Name": "BedrockInvoke",
    "FieldSelectors": [
      {"Field":"eventCategory","Equals":["Data"]},
      {"Field":"resources.type","Equals":["AWS::Bedrock::Model"]}
    ]
  }]'
```
