export interface Annotation { id: string; content: string; processedRecordingId: string; startTimeInSeconds: number; endTimeInSeconds: number; [key: string]: unknown }
export interface SnapshotState { actionId: string; actionLevel: number; annotations: Annotation[]; recordings: unknown[]; [key: string]: unknown }
export interface Snapshot { reviewActionId: string; original: SnapshotState; current: SnapshotState; backendBaseUrl: string }
export interface Grade { category: string; score: 1 | 2 | 3; note: string; scoreCap: number; evidence: { count: number; dominantKinds: string[]; samples: Array<{ note: string; before?: string; after?: string }> } }
export interface GradingResult { reviewActionId: string; originalActionId: string; version: string; generatedAt: string; model: string; grades: Grade[] }
