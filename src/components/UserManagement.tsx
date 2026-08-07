import { useState, useEffect } from 'react';
import { Search, UserPlus, Edit, Trash2, Lock, Unlock, Shield, Users as UsersIcon } from 'lucide-react';
import { supabase, type SystemUserWithRole, type UserRole, type UserGroup } from '../lib/supabase';
import { AuthService } from '../lib/auth';
import UserFormModal from './UserFormModal';

type UserManagementProps = {
  currentUser: SystemUserWithRole;
};

export default function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<SystemUserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SystemUserWithRole[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUserWithRole | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users, filterRole, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResult, rolesResult, groupsResult] = await Promise.all([
        supabase.from('system_users').select(`
          *,
          role:user_roles(*)
        `).order('created_at', { ascending: false }),
        supabase.from('user_roles').select('*').order('display_name'),
        supabase.from('user_groups').select('*').order('group_name')
      ]);

      if (usersResult.data) setUsers(usersResult.data as SystemUserWithRole[]);
      if (rolesResult.data) setRoles(rolesResult.data);
      if (groupsResult.data) setGroups(groupsResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.username.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.full_name.toLowerCase().includes(query)
      );
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter((user) => user.role_id === filterRole);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((user) =>
        filterStatus === 'active' ? user.is_active : !user.is_active
      );
    }

    setFilteredUsers(filtered);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setShowUserForm(true);
  };

  const handleEditUser = (user: SystemUserWithRole) => {
    setSelectedUser(user);
    setShowUserForm(true);
  };

  const handleDeleteUser = async (user: SystemUserWithRole) => {
    if (user.id === currentUser.id) {
      alert('You cannot delete your own account');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('system_users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      await AuthService.logActivity(
        currentUser.id,
        'delete',
        'users',
        user.id,
        { username: user.username }
      );

      alert('User deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const handleToggleStatus = async (user: SystemUserWithRole) => {
    if (user.id === currentUser.id) {
      alert('You cannot deactivate your own account');
      return;
    }

    const newStatus = !user.is_active;
    const action = newStatus ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${action} user "${user.username}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('system_users')
        .update({ is_active: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      await AuthService.logActivity(
        currentUser.id,
        'update',
        'users',
        user.id,
        { action, username: user.username }
      );

      alert(`User ${action}d successfully`);
      loadData();
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      alert(`Failed to ${action} user`);
    }
  };

  const handleFormSuccess = async () => {
    setShowUserForm(false);
    setSelectedUser(null);
    await loadData();
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'manager':
        return 'bg-emerald-100 text-emerald-800';
      case 'editor':
        return 'bg-amber-100 text-amber-800';
      case 'viewer':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-600 mt-1">Manage system users and their permissions</p>
        </div>
        <button
          onClick={handleAddUser}
          className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
        >
          <UserPlus className="h-5 w-5" />
          <span>Add User</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username, email, or name..."
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.display_name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">User</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Last Login</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-semibold text-slate-900">{user.full_name}</div>
                        <div className="text-sm text-slate-500">@{user.username}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-900">{user.email}</td>
                    <td className="px-4 py-4">
                      <span className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getRoleBadgeColor(user.role.role_name)}`}>
                        <Shield className="h-3 w-3" />
                        <span>{user.role.display_name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {user.is_active ? (
                        <span className="flex items-center space-x-1 text-emerald-700 font-semibold text-sm">
                          <Unlock className="h-4 w-4" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-red-700 font-semibold text-sm">
                          <Lock className="h-4 w-4" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`p-2 ${user.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'} rounded-lg transition`}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                          disabled={user.id === currentUser.id}
                        >
                          {user.is_active ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete user"
                          disabled={user.id === currentUser.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUserForm && (
        <UserFormModal
          user={selectedUser}
          roles={roles}
          groups={groups}
          currentUser={currentUser}
          onClose={() => {
            setShowUserForm(false);
            setSelectedUser(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
