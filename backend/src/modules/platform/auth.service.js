const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query } = require('../../db/pool');

/**
 * Login for Super Admin / Admin / Owner (platform_user table).
 * For owner role: also fetches their owner record + first branch
 * so the frontend can bootstrap without a second API call.
 */
async function loginPlatform(email, password) {
  const { rows } = await query(
    `SELECT id, username, email, password_hash, role, is_active
     FROM platform_user WHERE email = $1`,
    [email]
  );
  const user = rows[0];
  if (!user || !user.is_active) throw { status: 401, message: 'Invalid credentials' };
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw { status: 401, message: 'Invalid credentials' };

  let ownerContext = null;
  if (user.role === 'owner') {
    // Fetch owner record + branches for frontend context
    const { rows: ownerRows } = await query(
      `SELECT o.id AS owner_id, o.business_name, o.max_branches,
              o.business_logo_url, o.owner_contact_no
       FROM owner o WHERE o.platform_user_id=$1`, [user.id]
    );
    if (ownerRows[0]) {
      const ownerId = ownerRows[0].owner_id;
      const { rows: branches } = await query(
        `SELECT b.id, b.name, b.address, b.phone,
                bs.shop_name, bs.shop_address, bs.shop_contact,
                bs.logo_url, bs.purchase_bill_note, bs.rental_bill_note
         FROM branch b
         LEFT JOIN branch_settings bs ON bs.branch_id=b.id
         WHERE b.owner_id=$1 AND b.is_active=TRUE ORDER BY b.id`,
        [ownerId]
      );
      // Find their staff id for the first branch
      const { rows: staffRows } = await query(
        `SELECT id FROM staff WHERE email=$1 AND role='owner' LIMIT 1`, [email]
      );
      ownerContext = {
        ownerId,
        businessName: ownerRows[0].business_name,
        maxBranches: ownerRows[0].max_branches,
        logoUrl: ownerRows[0].business_logo_url,
        staffId: staffRows[0]?.id || null,
        branches,
        activeBranchId: branches[0]?.id || null,
      };
    }
  }

  const tokenPayload = { id: user.id, role: user.role, layer: 'platform' };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      layer: 'platform',
      ...ownerContext,
    },
  };
}

/**
 * Login for Manager / Cashier (staff table — role != owner).
 * Owner uses platform login instead.
 */
async function loginStaff(email, password) {
  const { rows } = await query(
    `SELECT s.id, s.name, s.email, s.password_hash, s.role, s.is_active,
            s.branch_id, b.owner_id,
            bs.shop_name, bs.shop_address, bs.shop_contact, bs.logo_url,
            bs.purchase_bill_note, bs.rental_bill_note,
            o.business_name, o.max_branches
     FROM staff s
     JOIN branch b ON s.branch_id = b.id
     LEFT JOIN branch_settings bs ON bs.branch_id = b.id
     LEFT JOIN owner o ON o.id = b.owner_id
     WHERE s.email = $1`,
    [email]
  );
  const staff = rows[0];
  if (!staff || !staff.is_active) throw { status: 401, message: 'Invalid credentials' };
  const valid = await bcrypt.compare(password, staff.password_hash);
  if (!valid) throw { status: 401, message: 'Invalid credentials' };

  const token = jwt.sign(
    { id: staff.id, role: staff.role, branchId: staff.branch_id,
      ownerId: staff.owner_id, layer: 'shop' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return {
    token,
    user: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      layer: 'shop',
      branchId: staff.branch_id,
      ownerId: staff.owner_id,
      activeBranchId: staff.branch_id,
      // Branch settings for bill printing
      shopName: staff.shop_name,
      shopAddress: staff.shop_address,
      shopContact: staff.shop_contact,
      logoUrl: staff.logo_url,
      purchaseBillNote: staff.purchase_bill_note,
      rentalBillNote: staff.rental_bill_note,
      businessName: staff.business_name,
      maxBranches: staff.max_branches,
    },
  };
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

module.exports = { loginPlatform, loginStaff, hashPassword };
