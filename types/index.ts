export interface Slide {
  pageNumber: number;
  text: string;
  title: string;
}

export interface LinkupSource {
  name: string;
  url: string;
  snippet: string;
}

export interface LinkupResult {
  query: string;
  answer: string;
  sources: LinkupSource[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  linkupResults?: LinkupResult[];
}

export type TeachingMode = "Professor" | "Beginner" | "Exam Prep" | "Interview Prep";

export interface TeachRequest {
  slideText: string;
  slideTitle: string;
  slideNumber: number;
  highlightedText: string;
  userRequest: string;
  mode: TeachingMode;
  nearbyContext: string;
}

export interface LinkupDecision {
  needs_linkup: boolean;
  reason: string;
  search_queries: string[];
  goal_for_linkup: string;
}
