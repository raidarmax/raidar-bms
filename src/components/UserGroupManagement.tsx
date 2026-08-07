import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Users as UsersIcon, Shield } from 'lucide-react';
import { supabase, type UserGroup, type UserRole, type SystemUserWithRole } from '../lib/supabase';
import { AuthService } from '../lib/auth';
import UserGroupFormModal from './UserGroupFormModal';

type UserGroupManagementProps = {
  currentUser: SystemUserWithRole;
};

export default function UserGroupManagement({ currentUser }: UserGroupManagementProps) {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<UserGroup[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterGroups();
  }, [searchQuery, groups]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsResult, rolesResult] = await Promise.all([
        supabase.from('user_groups').select('*').order('group_name'),
        supabase.from('user_roles').select('*').order('display_name'),
      ]);

      if (groupsResult.data) {
        setGroups(groupsResult.data);
        await loadMemberCounts(groupsResult.data);
      }
      if (rolesResult.data) setRoles(rolesResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMemberCounts = async (groupsList: UserGroup[]) => {
    const counts: Record<string, number> = {};

    for (const group of groupsList) {
      const { count } = await supabase
        .from('user_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);

      counts[group.id] = count || 0;
    }

    setGroupMemberCounts(counts);
  };

  const filterGroups = () => {
    if (searchQuery.trim() === '') {
      setFilteredGroups(groups);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = groups.filter(
        (group) =>
          group.group_name.toLowerCase().includes(query) ||
          (group.description && group.description.toLowerCase().includes(query))
      );
      setFilteredGroups(filtered);
    }
  };

  const handleAddGroup = () => {
    setSelectedGroup(null);
    setShowGroupForm(true);
  };

  const handleEditGroup = (group: UserGroup) => {
    setSelectedGroup(group);
    setShowGroupForm(true);
  };

  const handleDeleteGroup = async (group: UserGroup) => {
    const memberCount = groupMemberCounts[group.id] || 0;

    if (memberCount > 0) {
      if (!confirm(`This group has ${memberCount} member(s). Are you sure you want to delete it? Members will be removed from the group.`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete group "${group.group_name}"?`)) {
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('user_groups')
        .delete()
        .eq('id', group.id);

      if (error) throw error;

      await AuthService.logActivity(
        currentUser.id,
        'delete',
        'groups',
        group.id,
        { group_name: group.group_name }
      );

      alert('Group deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Failed to delete group');
    }
  };

  const handleFormSuccess = async () => {
    setShowGroupForm(false);
    setSelectedGroup(null);
    await loadData();
  };

  const getDefaultRoleName = (roleId: string | null) => {
    if (!roleId) return 'None';
    const role = roles.find((r) => r.id === roleId);
    return role ? role.display_name : 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Groups</h2>
          <p className="text-slate-600 mt-1">Organize users into logical groups for easier management</p>
        </div>
        <button
          onClick={handleAddGroup}
          className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
        >
          <Plus className="h-5 w-5" />
          <span>Add Group</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups by name or description..."
            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading groups...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">No groups found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{group.group_name}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {group.description || 'No description'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Members:</span>
                    <span className="font-semibold text-slate-900">
                      {groupMemberCounts[group.id] || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Default Role:</span>
                    <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
                      <Shield className="h-3 w-3" />
                      <span>{getDefaultRoleName(group.default_role_id)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-3 border-t border-slate-200">
                  <button
                    onClick={() => handleEditGroup(group)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition font-semibold"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-semibold"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showGroupForm && (
        <UserGroupFormModal
          group={selectedGroup}
          roles={roles}
          currentUser={currentUser}
          onClose={() => {
            setShowGroupForm(false);
            setSelectedGroup(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
