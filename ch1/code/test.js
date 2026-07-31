import { getUserPlan } from "./src/userService.js";

function check(name, fn, expected) {
  const actual = fn();
  console.log(`${name}: ${actual === expected ? "PASS" : `FAIL (got ${actual})`}`);
}

check("Test 1 - pro 플랜 사용자", () => getUserPlan(1), "pro");
check("Test 2 - free 플랜 사용자", () => getUserPlan(2), "free");
check("Test 3 - profile 없는 사용자", () => getUserPlan(3), "unknown");
