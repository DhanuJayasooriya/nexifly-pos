import axios from 'axios';

// CRA proxy in package.json routes /api → http://localhost:4000
export const http = axios.create({ baseURL: '/api/v1' });

// Attach stored branchId as header on every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('nxf_token');
  const branchId = localStorage.getItem('nxf_branch_id');
  if (token) config.headers['Authorization'] = 'Bearer ' + token;
  if (branchId) config.headers['x-branch-id'] = branchId;
  return config;
});

// Attach JWT on every request
http.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('nxf_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// 401 → clear storage
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nxf_token');
      localStorage.removeItem('nxf_user');
    }
    return Promise.reject(err);
  },
);

// Unwrap standard { success, data } envelope
const d = (r) => r.data.data;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  platformLogin: (body) => http.post('/auth/platform/login', body).then(d),
  staffLogin: (body) => http.post('/auth/staff/login', body).then(d),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashApi = {
  get: (branchId) => http.get(`/branches/${branchId}/dashboard`).then(d),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productApi = {
  listBrands: (bid) => http.get(`/branches/${bid}/brands`).then(d),
  createBrand: (bid, name) => http.post(`/branches/${bid}/brands`, { name }).then(d),
  updateBrand: (id, body) => http.patch(`/brands/${id}`, body).then(d),
  deleteBrand: (id) => http.delete(`/brands/${id}`),
  listCategories: (bid) => http.get(`/branches/${bid}/categories`).then(d),
  createCategory: (bid, body) => http.post(`/branches/${bid}/categories`, body).then(d),
  updateCategory: (id, body) => http.patch(`/categories/${id}`, body).then(d),
  deleteCategory: (id) => http.delete(`/categories/${id}`),
  listAttrTypes: (bid) => http.get(`/branches/${bid}/attribute-types`).then(d),
  createAttrType: (bid, name) => http.post(`/branches/${bid}/attribute-types`, { name }).then(d),
  createAttrValue: (tid, body) => http.post(`/attribute-types/${tid}/values`, body).then(d),
  deleteAttrValue: (id) => http.delete(`/attribute-values/${id}`),
  list: (bid, p) => http.get(`/branches/${bid}/products`, { params: p }).then(d),
  create: (bid, body) => http.post(`/branches/${bid}/products`, body).then(d),
  update: (id, body) => http.patch(`/products/${id}`, body).then(d),
  delete: (id) => http.delete(`/products/${id}`),
  listVariants: (pid) => http.get(`/products/${pid}/variants`).then(d),
  createVariant: (pid, body) => http.post(`/products/${pid}/variants`, body).then(d),
  updateVariant: (id, body) => http.patch(`/variants/${id}`, body).then(d),
  deleteVariant: (id) => http.delete(`/variants/${id}`),
  lookupBarcode: (bc, branchId) =>
    http.get(`/lookup/barcode/${bc}`, { params: branchId ? { branchId } : {} }).then(d),
  lookupSku: (sku, branchId) =>
    http
      .get(`/lookup/sku/${encodeURIComponent(sku)}`, { params: branchId ? { branchId } : {} })
      .then(d),
  searchVariants: (branchId, q) =>
    http.get(`/branches/${branchId}/variants/search`, { params: { q } }).then(d),
};

// ── SKU Sequence ──────────────────────────────────────────────────────────────
export const skuApi = {
  // Suggest a SKU from attributes — pure computation, no DB write, no sequence
  suggest: (branchId, body) => http.post(`/branches/${branchId}/sku/suggest`, body).then(d),
  // Check if a SKU already exists in this branch
  check: (branchId, sku) =>
    http.get(`/branches/${branchId}/sku/check`, { params: { sku } }).then(d),
  // Kept for backwards compatibility
  next: (branchId, body) => http.post(`/branches/${branchId}/sku/next`, body).then(d),
};

// ── Branches ──────────────────────────────────────────────────────────────────
export const branchApi = {
  list: () => http.get('/branches').then(d),
  get: (id) => http.get(`/branches/${id}`).then(d),
  create: (body) => http.post('/branches', body).then(d),
  update: (id, body) => http.patch(`/branches/${id}`, body).then(d),
  updateSettings: (id, body) => http.patch(`/branches/${id}/settings`, body).then(d),
  delete: (id) => http.delete(`/branches/${id}`),
  // Staff (cashiers / managers)
  listStaff: (branchId) => http.get(`/branches/${branchId}/staff`).then(d),
  createStaff: (branchId, body) => http.post(`/branches/${branchId}/staff`, body).then(d),
  updateStaff: (id, body) => http.patch(`/staff/${id}`, body).then(d),
  resetPassword: (id, body) => http.patch(`/staff/${id}/password`, body).then(d),
  deleteStaff: (id) => http.delete(`/staff/${id}`),
  // Devices
  listDevices: (branchId) => http.get(`/branches/${branchId}/devices`).then(d),
  upsertDevice: (branchId, body) => http.put(`/branches/${branchId}/devices`, body).then(d),
};

// ── GRN ───────────────────────────────────────────────────────────────────────
export const grnApi = {
  listSuppliers: (bid) => http.get(`/branches/${bid}/suppliers`).then(d),
  createSupplier: (bid, body) => http.post(`/branches/${bid}/suppliers`, body).then(d),
  updateSupplier: (id, body) => http.patch(`/suppliers/${id}`, body).then(d),
  deleteSupplier: (id) => http.delete(`/suppliers/${id}`),
  listPOs: (bid, p) => http.get(`/branches/${bid}/purchase-orders`, { params: p }).then(d),
  getPO: (id) => http.get(`/purchase-orders/${id}`).then(d),
  createPO: (bid, body) => http.post(`/branches/${bid}/purchase-orders`, body).then(d),
  updatePO: (id, body) => http.patch(`/purchase-orders/${id}`, body).then(d),
  deletePO: (id) => http.delete(`/purchase-orders/${id}`),
  listGRNs: (bid, p) => http.get(`/branches/${bid}/grn`, { params: p }).then(d),
  getGRN: (id) => http.get(`/grn/${id}`).then(d),
  lookupGRN: (bid, no) => http.get(`/grn/lookup/${bid}/${no}`).then(d),
  createGRN: (bid, body) => http.post(`/branches/${bid}/grn`, body).then(d),
  updateGRN: (id, body) => http.patch(`/grn/${id}`, body).then(d),
  deleteGRN: (id) => http.delete(`/grn/${id}`),
  getItemBarcodes: (itemId) => http.get(`/grn-items/${itemId}/barcodes`).then(d),
  markPrinted: (barcodeId) => http.post(`/barcodes/${barcodeId}/printed`).then(d),
  printAllGRN: (grnId) => http.post(`/grn/${grnId}/print-all`).then(d),
};

// ── Billing / Sessions ────────────────────────────────────────────────────────
export const billingApi = {
  listSessions: () => http.get('/sessions').then(d),
  createSession: (body) => http.post('/sessions', body).then(d),
  addItem: (sid, body) => http.post(`/sessions/${sid}/items`, body).then(d),
  removeItem: (sid, iid) => http.delete(`/sessions/${sid}/items/${iid}`),
  applyTaxDisc: (sid, body) => http.patch(`/sessions/${sid}/summary`, body).then(d),
  hold: (sid) => http.post(`/sessions/${sid}/hold`).then(d),
  resume: (sid) => http.post(`/sessions/${sid}/resume`).then(d),
  checkout: (sid, payments) => http.post(`/sessions/${sid}/checkout`, { payments }).then(d),
  listSales: (bid, p) => http.get(`/branches/${bid}/sales`, { params: p }).then(d),
  getSale: (id) => http.get(`/sales/${id}`).then(d),
  createReturn: (bid, body) => http.post(`/branches/${bid}/returns`, body).then(d),
};

// ── Discounts ─────────────────────────────────────────────────────────────────
export const discountApi = {
  list: (bid) => http.get(`/branches/${bid}/discounts`).then(d),
  get: (id) => http.get(`/discounts/${id}`).then(d),
  create: (bid, body) => http.post(`/branches/${bid}/discounts`, body).then(d),
  update: (id, body) => http.patch(`/discounts/${id}`, body).then(d),
  delete: (id) => http.delete(`/discounts/${id}`),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customerApi = {
  list: (bid, p) => http.get(`/branches/${bid}/customers`, { params: p }).then(d),
  get: (id) => http.get(`/customers/${id}`).then(d),
  create: (bid, body) => http.post(`/branches/${bid}/customers`, body).then(d),
  update: (id, body) => http.patch(`/customers/${id}`, body).then(d),
  delete: (id) => http.delete(`/customers/${id}`),
  loyalty: (id, body) => http.post(`/customers/${id}/loyalty`, body).then(d),
};

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expenseApi = {
  listCats: (bid) => http.get(`/branches/${bid}/expense-categories`).then(d),
  list: (bid, p) => http.get(`/branches/${bid}/expenses`, { params: p }).then(d),
  create: (bid, body) => http.post(`/branches/${bid}/expenses`, body).then(d),
  update: (id, body) => http.patch(`/expenses/${id}`, body).then(d),
  approve: (id) => http.patch(`/expenses/${id}/approve`).then(d),
  delete: (id) => http.delete(`/expenses/${id}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifApi = {
  list: (p) => http.get('/notifications', { params: p }).then(d),
  markRead: (id) => http.patch(`/notifications/${id}/read`).then(d),
  markAllRead: () => http.patch('/notifications/read-all').then(d),
};

// ── Rentals ───────────────────────────────────────────────────────────────────
export const rentalApi = {
  list: (bid, p) => http.get(`/branches/${bid}/rentals`, { params: p }).then(d),
  search: (bid, q) => http.get(`/branches/${bid}/rentals/search`, { params: { q } }).then(d),
  get: (id) => http.get(`/rentals/${id}`).then(d),
  create: (bid, body) => http.post(`/branches/${bid}/rentals`, body).then(d),
  update: (id, body) => http.patch(`/rentals/${id}`, body).then(d),
  receive: (id, body) => http.post(`/rentals/${id}/receive`, body).then(d),
  convertToSale: (id, body) => http.post(`/rentals/${id}/convert-to-sale`, body).then(d),
  addCharge: (id, body) => http.post(`/rentals/${id}/charges`, body).then(d),
  listPayments: (id) => http.get(`/rentals/${id}/payments`).then(d),
  addPayment: (id, body) => http.post(`/rentals/${id}/payments`, body).then(d),
};

// ── Owner context ────────────────────────────────────────────────────────────
export const ownerApi = {
  me: () => http.get('/owners/me').then(d),
  branchContext: (branchId) => http.get(`/branches/${branchId}/context`).then(d),
};

// ── Platform (Super Admin / Admin) ────────────────────────────────────────────
export const platformApi = {
  listAdmins: (p) => http.get('/admins', { params: p }).then(d),
  createAdmin: (body) => http.post('/admins', body).then(d),
  updateAdmin: (id, body) => http.patch(`/admins/${id}`, body).then(d),
  deleteAdmin: (id) => http.delete(`/admins/${id}`),
  resetAdminPwd: (id, body) => http.patch(`/admins/${id}/password`, body).then(d),
  listOwners: (p) => http.get('/owners', { params: p }).then(d),
  createOwner: (body) => http.post('/owners', body).then(d),
  updateOwner: (id, body) => http.patch(`/owners/${id}`, body).then(d),
  deleteOwner: (id) => http.delete(`/owners/${id}`),
  resetOwnerPwd: (id, body) => http.patch(`/owners/${id}/password`, body).then(d),
};
