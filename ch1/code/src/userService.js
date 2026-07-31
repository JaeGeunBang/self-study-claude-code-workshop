import { users } from "./users.js";

export function getUserPlan(userId) {
  const user = users.find((u) => u.id === userId);
  return user?.plan ?? "unknown";
}
