// Marks rentals as overdue once their due date has passed.
// Called before rental lists and dashboard counts are read, so the stored
// status always matches the dates without needing a scheduled job.
const { query } = require('../db/pool');

async function markOverdueRentals(branchId) {
  await query(
    `UPDATE rental SET status = 'overdue'
     WHERE branch_id = $1 AND status = 'active' AND due_date < CURRENT_DATE`,
    [branchId]
  );
}

module.exports = { markOverdueRentals };
