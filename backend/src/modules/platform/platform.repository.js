const { query } = require('../../db/pool');

// ── Platform Users (Super Admin / Admin) ─────────────────────────────────────

async function findAllPlatformUsers(role) {
  const cond = role ? 'WHERE role = $1' : '';
  const params = role ? [role] : [];
  const { rows } = await query(`SELECT id,username,email,role,is_active,created_at FROM platform_user ${cond} ORDER BY id`, params);
  return rows;
}

async function findPlatformUserById(id) {
  const { rows } = await query(`SELECT id,username,email,role,is_active,created_at FROM platform_user WHERE id=$1`, [id]);
  return rows[0] || null;
}

async function createPlatformUser(data) {
  const { username, email, passwordHash, role, createdBy } = data;
  const { rows } = await query(
    `INSERT INTO platform_user (username,email,password_hash,role,created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING id,username,email,role,is_active,created_at`,
    [username, email, passwordHash, role, createdBy]
  );
  return rows[0];
}

async function updatePlatformUser(id, data) {
  const { username, email, isActive } = data;
  const { rows } = await query(
    `UPDATE platform_user SET username=COALESCE($1,username), email=COALESCE($2,email),
     is_active=COALESCE($3,is_active), updated_at=NOW()
     WHERE id=$4 RETURNING id,username,email,role,is_active`,
    [username, email, isActive, id]
  );
  return rows[0] || null;
}

async function updatePlatformPassword(id, passwordHash) {
  await query(`UPDATE platform_user SET password_hash=$1, updated_at=NOW() WHERE id=$2`, [passwordHash, id]);
}

async function deletePlatformUser(id) {
  const { rowCount } = await query(`DELETE FROM platform_user WHERE id=$1`, [id]);
  return rowCount > 0;
}

// ── Owners ───────────────────────────────────────────────────────────────────

async function findAllOwners({ limit, offset }) {
  const { rows } = await query(
    `SELECT o.*, pu.username, pu.email,
       (SELECT MAX(pr.paid_on) FROM payment_record pr
        JOIN subscription s ON pr.subscription_id=s.id
        WHERE s.owner_id=o.id) AS last_payment_date
     FROM owner o
     JOIN platform_user pu ON o.platform_user_id=pu.id
     ORDER BY o.id DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: tot } = await query(`SELECT COUNT(*) FROM owner`);
  return { rows, total: parseInt(tot[0].count) };
}

async function findOwnerById(id) {
  const { rows } = await query(
    `SELECT o.*, pu.username, pu.email
     FROM owner o JOIN platform_user pu ON o.platform_user_id=pu.id
     WHERE o.id=$1`,
    [id]
  );
  return rows[0] || null;
}

async function createOwner(data, client) {
  const db = client || { query: (...a) => query(...a) };
  const { platformUserId, businessName, businessLogoUrl, ownerContactNo,
          defaultBranchAddress, defaultBranchContactNo, maxBranches, createdBy } = data;
  const { rows } = await db.query(
    `INSERT INTO owner (platform_user_id,business_name,business_logo_url,owner_contact_no,
       default_branch_address,default_branch_contact_no,max_branches,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [platformUserId, businessName, businessLogoUrl, ownerContactNo,
     defaultBranchAddress, defaultBranchContactNo, maxBranches || 1, createdBy]
  );
  return rows[0];
}

async function updateOwner(id, data) {
  const { businessName, businessLogoUrl, ownerContactNo,
          defaultBranchAddress, defaultBranchContactNo, maxBranches, isActive } = data;
  const { rows } = await query(
    `UPDATE owner SET
       business_name=COALESCE($1,business_name),
       business_logo_url=COALESCE($2,business_logo_url),
       owner_contact_no=COALESCE($3,owner_contact_no),
       default_branch_address=COALESCE($4,default_branch_address),
       default_branch_contact_no=COALESCE($5,default_branch_contact_no),
       max_branches=COALESCE($6,max_branches),
       is_active=COALESCE($7,is_active),
       updated_at=NOW()
     WHERE id=$8 RETURNING *`,
    [businessName, businessLogoUrl, ownerContactNo,
     defaultBranchAddress, defaultBranchContactNo, maxBranches, isActive, id]
  );
  return rows[0] || null;
}

async function deleteOwner(id) {
  const { rowCount } = await query(`DELETE FROM owner WHERE id=$1`, [id]);
  return rowCount > 0;
}

module.exports = {
  findAllPlatformUsers, findPlatformUserById, createPlatformUser,
  updatePlatformUser, updatePlatformPassword, deletePlatformUser,
  findAllOwners, findOwnerById, createOwner, updateOwner, deleteOwner,
};
