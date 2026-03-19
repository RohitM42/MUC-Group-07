export interface SessionRecord {
  id:             string;
  date:           string;  // ISO timestamp
  durationSecs:   number;
  steps:          number;
  avgPace:        number;  // steps per minute
  percentCorrect: number;  // 0–100, % of readings where roll was in correct range
  walkingPct:     number;  // 0–100, % of session classified as walking
}

// Toggle this to false once real AsyncStorage sessions are wired up
export const USE_MOCK_DATA = true;

export const MOCK_SESSIONS: SessionRecord[] = [
  {
    id:             'mock-1',
    date:           '2026-03-19T09:14:00.000Z',
    durationSecs:   612,
    steps:          847,
    avgPace:        83,
    percentCorrect: 91,
    walkingPct:     78,
  },
  {
    id:             'mock-2',
    date:           '2026-03-18T17:42:00.000Z',
    durationSecs:   430,
    steps:          601,
    avgPace:        79,
    percentCorrect: 74,
    walkingPct:     65,
  },
  {
    id:             'mock-3',
    date:           '2026-03-17T08:05:00.000Z',
    durationSecs:   891,
    steps:          1204,
    avgPace:        87,
    percentCorrect: 88,
    walkingPct:     82,
  },
  {
    id:             'mock-4',
    date:           '2026-03-15T13:27:00.000Z',
    durationSecs:   295,
    steps:          388,
    avgPace:        71,
    percentCorrect: 55,
    walkingPct:     59,
  },
  {
    id:             'mock-5',
    date:           '2026-03-13T10:51:00.000Z',
    durationSecs:   744,
    steps:          1032,
    avgPace:        85,
    percentCorrect: 96,
    walkingPct:     88,
  },
  {
    id:             'mock-6',
    date:           '2026-03-10T16:03:00.000Z',
    durationSecs:   510,
    steps:          703,
    avgPace:        77,
    percentCorrect: 62,
    walkingPct:     70,
  },
];
