import { randomUUID } from 'node:crypto';
import { ensureTables } from '../shared/schema.js';

export class DonationsDomain {
  #db;

  constructor(db) {
    this.#db = db;
  }

  #rowToEntry(row) {
    return {
      id:          String(row.id),
      uid:         String(row.uid || ''),
      songId:      String(row.song_id),
      songTitle:   String(row.song_title || ''),
      songArtist:  String(row.song_artist || ''),
      provider:    String(row.provider),
      currency:    String(row.currency),
      amount:      Number(row.amount),
      tier:        row.tier == null ? null : Number(row.tier),
      status:      String(row.status),
      providerRef: row.provider_ref == null ? null : String(row.provider_ref),
      matchCode:   row.match_code == null ? null : String(row.match_code),
      expiresAt:   row.expires_at == null ? null : Number(row.expires_at),
      createdAt:   Number(row.created_at),
      paidAt:      row.paid_at == null ? null : Number(row.paid_at),
    };
  }

  async createDonation({ uid, songId, songTitle, songArtist, provider, currency, amount, tier, createdAt, matchCode = null, expiresAt = null }) {
    await ensureTables(this.#db, 'donations');

    const id = randomUUID();
    await this.#db.execute({
      sql: `INSERT INTO donations (id, uid, song_id, song_title, song_artist, provider, currency, amount, tier, status, match_code, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      args: [id, String(uid || ''), String(songId), String(songTitle || ''), String(songArtist || ''),
        String(provider), String(currency), Number(amount), tier == null ? null : Number(tier), matchCode, expiresAt, createdAt],
    });

    return this.findById(id);
  }

  async findById(id) {
    await ensureTables(this.#db, 'donations');

    const result = await this.#db.execute({
      sql: `SELECT * FROM donations WHERE id = ?`,
      args: [id],
    });

    const row = result.rows?.[0];
    return row ? this.#rowToEntry(row) : null;
  }

  async findByProviderRef(providerRef) {
    await ensureTables(this.#db, 'donations');

    const result = await this.#db.execute({
      sql: `SELECT * FROM donations WHERE provider_ref = ?`,
      args: [providerRef],
    });

    const row = result.rows?.[0];
    return row ? this.#rowToEntry(row) : null;
  }

  async findByMatchCode(matchCode) {
    await ensureTables(this.#db, 'donations');

    const result = await this.#db.execute({
      sql: `SELECT * FROM donations WHERE match_code = ? AND status = 'pending'`,
      args: [matchCode],
    });

    const row = result.rows?.[0];
    return row ? this.#rowToEntry(row) : null;
  }

  async expirePendingMatches(cutoff) {
    await ensureTables(this.#db, 'donations');

    const result = await this.#db.execute({
      sql: `UPDATE donations SET status = 'expired'
            WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= ?
            RETURNING id`,
      args: [cutoff],
    });

    return (result.rows || []).length;
  }

  async markStatus(id, status, { providerRef = null, paidAt = null, expectedStatus = null } = {}) {
    await ensureTables(this.#db, 'donations');

    const sets = ['status = ?'];
    const args = [status];
    if (providerRef !== null) { sets.push('provider_ref = ?'); args.push(providerRef); }
    if (paidAt !== null)      { sets.push('paid_at = ?');      args.push(paidAt); }
    args.push(id);

    let sql = `UPDATE donations SET ${sets.join(', ')} WHERE id = ?`;
    if (expectedStatus !== null) { sql += ' AND status = ?'; args.push(expectedStatus); }

    const result = await this.#db.execute({ sql: `${sql} RETURNING id`, args });
    if (expectedStatus !== null && !result.rows?.length) return null;

    return this.findById(id);
  }

  async loadDonationHistory({ since = 0, limit = 30, offset = 0 } = {}) {
    await ensureTables(this.#db, 'donations');

    const totalRes = await this.#db.execute({
      sql: `SELECT COUNT(*) AS total FROM donations WHERE created_at >= ?`,
      args: [since],
    });

    const rowsRes = await this.#db.execute({
      sql: `SELECT * FROM donations WHERE created_at >= ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      args: [since, limit, offset],
    });

    return {
      entries: (rowsRes.rows || []).map((row) => this.#rowToEntry(row)),
      total: Number(totalRes.rows?.[0]?.total || 0),
    };
  }

  async listCurrencies() {
    await ensureTables(this.#db, 'donations');

    const result = await this.#db.execute(
      `SELECT DISTINCT currency FROM donations WHERE currency IS NOT NULL AND currency != '' ORDER BY currency`
    );

    return (result.rows || []).map((row) => String(row.currency));
  }

  async purgeDonations(cutoff) {
    await ensureTables(this.#db, 'donations');

    const result = await this.#db.execute({
      sql: `DELETE FROM donations WHERE created_at < ? RETURNING id`,
      args: [cutoff],
    });

    return (result.rows || []).length;
  }
}
