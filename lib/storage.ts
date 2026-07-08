const APPROVER_NAME_KEY = "rebuno.approverName";

export function getApproverName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(APPROVER_NAME_KEY) ?? "";
}

export function setApproverName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPROVER_NAME_KEY, name);
}
