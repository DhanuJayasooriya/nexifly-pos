import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, http } from '../api';

const AuthContext = createContext(null);

const d = (r) => r.data.data;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchSettings, setBranchSettings] = useState({});

  // ── Rehydrate on page refresh ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('nxf_token');
    const stored = localStorage.getItem('nxf_user');
    const bid = localStorage.getItem('nxf_branch_id');
    const blist = localStorage.getItem('nxf_branches');

    if (token && stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        if (blist) setBranches(JSON.parse(blist));
        if (bid) {
          setActiveBranchId(parseInt(bid));
          // Use branch-scoped key to prevent cross-owner settings leakage
          const scoped = localStorage.getItem(`nxf_branch_settings_${bid}`);
          if (scoped) setBranchSettings(JSON.parse(scoped));
        }
      } catch {
        /* ignore bad JSON */
      }
    }
    setLoading(false);
  }, []);

  // ── Load branch settings whenever activeBranchId changes ────────────────────
  const loadBranchSettings = useCallback(async (branchId) => {
    if (!branchId) return;
    try {
      const data = await http.get(`/branches/${branchId}/context`).then(d);
      setBranchSettings(data);
      // Scope by branchId so different owners/branches don't share settings
      localStorage.setItem(`nxf_branch_settings_${branchId}`, JSON.stringify(data));
      localStorage.setItem('nxf_branch_settings', JSON.stringify(data));
    } catch {
      /* non-fatal */
    }
  }, []);

  // ── Switch active branch (owner multi-branch) ────────────────────────────────
  const switchBranch = useCallback(
    async (branchId) => {
      const bid = parseInt(branchId);
      setActiveBranchId(bid);
      localStorage.setItem('nxf_branch_id', bid);
      await loadBranchSettings(bid);
    },
    [loadBranchSettings],
  );

  // ── Login ────────────────────────────────────────────────────────────────────
  async function login(email, password) {
    let result;
    // Platform login first (super_admin / admin / owner)
    try {
      result = await authApi.platformLogin({ email, password });
    } catch (platformErr) {
      // Fall through to staff login (manager / cashier)
      try {
        result = await authApi.staffLogin({ email, password });
      } catch (staffErr) {
        const msg =
          staffErr.response?.data?.message ||
          platformErr.response?.data?.message ||
          'Invalid email or password';
        throw new Error(msg);
      }
    }

    const { token, user: userData } = result;
    localStorage.setItem('nxf_token', token);
    localStorage.setItem('nxf_user', JSON.stringify(userData));
    setUser(userData);

    // Set up branch context
    const branchList = userData.branches || [];
    const firstBranch = userData.activeBranchId || userData.branchId || null;

    setBranches(branchList);
    localStorage.setItem('nxf_branches', JSON.stringify(branchList));

    if (firstBranch) {
      setActiveBranchId(firstBranch);
      localStorage.setItem('nxf_branch_id', firstBranch);
      // Clear any previous owner's settings before loading fresh ones
      setBranchSettings({});
      localStorage.removeItem('nxf_branch_settings');
      localStorage.removeItem('nxf_bill_logo');
      // Load fresh branch settings from DB
      await loadBranchSettings(firstBranch);
    }

    return userData;
  }

  // ── Logout ───────────────────────────────────────────────────────────────────
  function logout() {
    // Clear all branch-scoped settings keys
    Object.keys(localStorage)
      .filter((k) => k.startsWith('nxf_branch_settings'))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('nxf_token');
    localStorage.removeItem('nxf_user');
    localStorage.removeItem('nxf_branch_id');
    localStorage.removeItem('nxf_branches');
    localStorage.removeItem('nxf_bill_logo');
    setBranchSettings({});
    setUser(null);
    setActiveBranchId(null);
    setBranches([]);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const isPlatform =
    user && ['super_admin', 'admin', 'owner'].includes(user.role) && user.layer === 'platform';
  const isShop = user && user.layer === 'shop';
  const isOwner = user?.role === 'owner';
  const isSA = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const canManageStaff = isOwner;
  const canManageBranches = isOwner;

  // The branch ID to use in all API calls — owner uses activeBranchId, staff uses their fixed branchId
  const effectiveBranchId = activeBranchId || user?.branchId || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        activeBranchId: effectiveBranchId,
        rawActiveBranchId: activeBranchId,
        branches,
        switchBranch,
        branchSettings,
        isPlatform,
        isShop,
        isOwner,
        isSA,
        isAdmin,
        canManageStaff,
        canManageBranches,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
