# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code 워크샵 실습용 사용자 서비스 모듈. 사용자 조회와 요금제(plan) 확인 기능을 제공한다.

Note: 현재 저장소에는 `package.json`과 `test.js`만 존재하며, `test.js`가 참조하는 `src/userService.js`(및 사용자 데이터를 담을 `src/users.js`)는 아직 작성되지 않았다. 이 파일들을 만드는 것이 이 실습의 목표다.

## Tech Stack

- Node.js 18+, ES Modules(`type: "module"`) 사용, 외부 의존성 없음

## Commands

- 테스트 실행: `npm test` (`node test.js` 실행)

## Architecture

- `test.js`는 `src/userService.js`에서 `getUserPlan(userId)`를 import해 3가지 케이스를 검증한다:
  - user 1 → `"pro"`
  - user 2 → `"free"`
  - user 3(프로필 없음) → `"unknown"`
- 즉 `getUserPlan`은 존재하지 않는 사용자에 대해 예외를 던지지 않고 기본값 `"unknown"`을 반환해야 한다.
- 사용자 데이터는 `src/users.js`에 두고, `userService.js`가 이를 조회하는 서비스 계층 역할을 하는 구조를 따른다.

## Conventions

- ES Modules(import/export)만 사용, CommonJS(require) 금지
- 존재하지 않는 데이터는 예외를 던지지 말고 기본값을 반환
- 모든 수정에는 `test.js`의 테스트 통과가 동반되어야 함

## Don't

- `src/users.js`의 데이터 구조를 임의로 변경하지 않기
- 새 npm 패키지를 추가하지 않기
