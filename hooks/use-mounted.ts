import { useSyncExternalStore } from "react"

const noop = () => () => {}

/** False during SSR and hydration, true afterwards — for values only the client knows (e.g. theme). */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false)
}
