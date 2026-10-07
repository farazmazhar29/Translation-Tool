import type { SegmentOut } from '@/shared/api/generated'

export type Segment = SegmentOut
/** The side panel under the toolbar: quality check, release history or none. */
export type Panel = 'quality' | 'history' | null
/** Runs an API call and then refreshes the project data (a "please wait" dialog is shown meanwhile). */
export type Run = (fn: () => Promise<unknown>) => void
