import { createContext, useContext } from "react";

export const StoryReplayContext = createContext<(() => void) | null>(null);

export function useStoryReplay(): (() => void) | null {
  return useContext(StoryReplayContext);
}
