const repo    = require('./platform.repository');
const { hashPassword } = require('./auth.service');
const { withTransaction } = require('../../db/transaction');
const { parsePagination } = require('../../utils/pagination');

// ── Admins ───────────────────────────────────────────────────────────────────
async function listAdmins()        { return repo.findAllPlatformUsers('admin'); }
async function getAdmin(id)        { return repo.findPlatformUserById(id); }
async function createAdmin(body, actorId) {
  const passwordHash = await hashPassword(body.password);
  return repo.createPlatformUser({ ...body, passwordHash, role: 'admin', createdBy: actorId });
}
async function updateAdmin(id, body) { return repo.updatePlatformUser(id, body); }
async function changeAdminPassword(id, newPassword) {
  const hash = await hashPassword(newPassword);
  return repo.updatePlatformPassword(id, hash);
}
async function deleteAdmin(id) { return repo.deletePlatformUser(id); }

// ── Owners ───────────────────────────────────────────────────────────────────
async function listOwners(query) {
  const pg = parsePagination(query);
  return repo.findAllOwners(pg);
}
async function getOwner(id) { return repo.findOwnerById(id); }

/**
 * Creating an owner in ONE transaction:
 * 1. platform_user  — login credentials
 * 2. owner          — business record
 * 3. branch         — first branch (always created)
 * 4. branch_settings— auto-seeded
 * 5. staff (role=owner) — shop-layer login, SAME password
 *
 * Body must include:
 *   username, email, password, businessName, ownerContactNo,
 *   branchName, branchAddress, branchPhone,
 *   maxBranches (SA only), businessLogoUrl (optional)
 */
async function createOwner(body, actorId) {
  return withTransaction(async (client) => {
    const passwordHash = await hashPassword(body.password);

    // 1. platform_user (role = 'owner')
    const { rows: uRows } = await client.query(
      `INSERT INTO platform_user (username,email,password_hash,role,created_by)
       VALUES ($1,$2,$3,'owner',$4) RETURNING id`,
      [body.username, body.email, passwordHash, actorId]
    );
    const platformUserId = uRows[0].id;

    // 2. owner record
    const { rows: oRows } = await client.query(
      `INSERT INTO owner
         (platform_user_id,business_name,business_logo_url,owner_contact_no,
          default_branch_address,default_branch_contact_no,max_branches,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [platformUserId, body.businessName, body.businessLogoUrl || null,
       body.ownerContactNo || null, body.branchAddress || null,
       body.branchPhone || null, body.maxBranches || 1, actorId]
    );
    const owner = oRows[0];

    // 3. first branch
    const { rows: bRows } = await client.query(
      `INSERT INTO branch (owner_id,name,address,phone)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [owner.id, body.branchName || body.businessName,
       body.branchAddress || null, body.branchPhone || null]
    );
    const branch = bRows[0];

    // 4. branch_settings (auto-seed with business name)
    await client.query(
      `INSERT INTO branch_settings (branch_id,shop_name,shop_address,shop_contact,logo_url)
       VALUES ($1,$2,$3,$4,$5)`,
      [branch.id, body.businessName, body.branchAddress || null,
       body.branchPhone || null, body.businessLogoUrl || null]
    );

    // 5. staff row (role = 'owner') — this gives the owner their shop-layer JWT
    const { rows: sRows } = await client.query(
      `INSERT INTO staff (branch_id,name,role,email,password_hash,created_by)
       VALUES ($1,$2,'owner',$3,$4,$5) RETURNING id`,
      [branch.id, body.username, body.email, passwordHash, null]
    );

    return {
      ...owner,
      username: body.username,
      email: body.email,
      branchId: branch.id,
      branchName: branch.name,
      staffId: sRows[0].id,
    };
  });
}

async function updateOwner(id, body, actorRole) {
  // Only super_admin can change max_branches
  if (body.maxBranches !== undefined && actorRole !== 'super_admin') {
    delete body.maxBranches;
  }
  return repo.updateOwner(id, body);
}

async function changeOwnerPassword(id, newPassword) {
  const hash = await hashPassword(newPassword);
  const owner = await repo.findOwnerById(id);
  if (!owner) throw { status: 404, message: 'Owner not found' };
  // Update both platform_user AND staff password
  await repo.updatePlatformPassword(owner.platform_user_id, hash);
  // Also update staff row (same email, find by email)
  const { query } = require('../../db/pool');
  await query(
    `UPDATE staff SET password_hash=$1 WHERE email=$2 AND role='owner'`,
    [hash, owner.email]
  );
  return { message: 'Password updated' };
}

async function deleteOwner(id) { return repo.deleteOwner(id); }

// ── Owner context (for frontend branch switcher) ──────────────────────────────
async function getOwnerContext(platformUserId) {
  const { query } = require('../../db/pool');
  // Get owner record
  const { rows: ownerRows } = await query(
    `SELECT o.*, pu.username, pu.email
     FROM owner o JOIN platform_user pu ON o.platform_user_id=pu.id
     WHERE o.platform_user_id=$1`, [platformUserId]
  );
  if (!ownerRows[0]) return null;
  const owner = ownerRows[0];
  // Get all branches
  const { rows: branches } = await query(
    `SELECT b.id, b.name, b.address, b.phone, b.is_active,
            bs.shop_name, bs.shop_address, bs.shop_contact, bs.logo_url,
            bs.purchase_bill_note, bs.rental_bill_note
     FROM branch b
     LEFT JOIN branch_settings bs ON bs.branch_id=b.id
     WHERE b.owner_id=$1 ORDER BY b.id`, [owner.id]
  );
  return { owner, branches };
}

module.exports = {
  listAdmins, getAdmin, createAdmin, updateAdmin, changeAdminPassword, deleteAdmin,
  listOwners, getOwner, createOwner, updateOwner, changeOwnerPassword, deleteOwner,
  getOwnerContext,
};
