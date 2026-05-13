const { query } = require('../config/db');

const create = async ({ actorUserId, actorRole, action, entityType, entityId, description, metadata, ipAddress }) => {
  await query(
    `
      INSERT INTO audit_logs (
        actor_user_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        metadata,
        ip_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [actorUserId, actorRole, action, entityType, entityId, description, JSON.stringify(metadata || {}), ipAddress]
  );
};

const list = async ({ limit = 100 } = {}) => {
  const result = await query(
    `
      SELECT
        a.id,
        a.actor_user_id,
        a.actor_role,
        a.action,
        a.entity_type,
        a.entity_id,
        a.description,
        a.metadata,
        a.ip_address,
        a.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_user_id
      ORDER BY a.created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    actorName: row.first_name ? `${row.first_name} ${row.last_name}` : row.email || 'System',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    description: row.description,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    createdAt: row.created_at
  }));
};

const listByEntity = async ({ entityType, entityId } = {}) => {
  const result = await query(
    `
      SELECT
        a.id,
        a.actor_user_id,
        a.actor_role,
        a.action,
        a.entity_type,
        a.entity_id,
        a.description,
        a.metadata,
        a.ip_address,
        a.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.entity_type = $1 AND a.entity_id = $2
      ORDER BY a.created_at ASC
    `,
    [entityType, String(entityId)]
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    actorName: row.first_name ? `${row.first_name} ${row.last_name}` : row.email || 'System',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    description: row.description,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    createdAt: row.created_at
  }));
};

module.exports = {
  create,
  list,
  listByEntity
};
