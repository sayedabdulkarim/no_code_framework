export type MessageCategory =
  | "requirement"
  | "analysis"
  | "plan"
  | "feedback"
  | "prd"
  | "error";

export interface Message {
  type: "user" | "agent";
  content: string;
  category?: MessageCategory;
}
