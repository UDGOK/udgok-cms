// Re-export from lib/checkins/actions so the public /c/[token]
// page can import the action via a co-located path. The
// co-location keeps server actions for a route in the route
// folder when the rest of the lib/ tree is the canonical
// place for the underlying logic.
export { toggleCheckInAction } from '@/lib/checkins/actions';
export type { CheckInResult } from '@/lib/checkins/actions';
