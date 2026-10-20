import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { createAnalystMatchUploadFixture, SYNTHETIC_PARTICIPATION_CASES,
  SYNTHETIC_VIDEO_URL } from '../analyst-match-upload-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });

afterAll(async () => { await pool.end(); });

describe('Feature 011 synthetic fixture on isolated PostgreSQL', () => {
  it('inserts only valid match/custody states and rolls all rows back', async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature011_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      const fixture = await createAnalystMatchUploadFixture(client);
      const matches = await client.query<{ id: string; state: string; unitState: string; version: number }>(
        'SELECT id, state, "unitState", version FROM "FirstMatch" WHERE id = ANY($1::uuid[])',
        [[fixture.waitingMatchId, fixture.rescheduledMatchId, fixture.canceledMatchId,
          fixture.loadedMatchId, fixture.otherMatchId, fixture.unassignedMatchId, fixture.nonActiveMatchId]],
      );
      expect(matches.rows).toHaveLength(7);
      expect(matches.rows.find((row) => row.id === fixture.waitingMatchId)).toMatchObject({ state: 'WAITING', unitState: 'RESERVED' });
      expect(matches.rows.find((row) => row.id === fixture.rescheduledMatchId)).toMatchObject({ state: 'WAITING', unitState: 'RESERVED', version: 2 });
      expect(matches.rows.find((row) => row.id === fixture.canceledMatchId)).toMatchObject({ state: 'CANCELED', unitState: 'RELEASED' });
      expect(matches.rows.find((row) => row.id === fixture.loadedMatchId)).toMatchObject({ state: 'LOADED', unitState: 'USED' });
      expect(SYNTHETIC_PARTICIPATION_CASES.addedTime).toMatchObject({ totalMinutesPlayed: 97, videoMinute: '90+7' });
      expect(SYNTHETIC_PARTICIPATION_CASES.lateSubstitute.totalMinutesPlayed)
        .toBeLessThan(Number(SYNTHETIC_PARTICIPATION_CASES.lateSubstitute.videoMinute));
      expect(SYNTHETIC_PARTICIPATION_CASES.didNotParticipate).toMatchObject({ totalMinutesPlayed: 0, events: [] });
      expect(SYNTHETIC_VIDEO_URL).toMatch(/^https:\/\/youtu\.be\//);
      expect(fixture.otherAnalystId).not.toBe(fixture.analystId);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
