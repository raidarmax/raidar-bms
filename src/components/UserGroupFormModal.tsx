import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase, type UserGroup, type UserRole, type SystemUserWithRole } from '../lib/supabase';
import { AuthService } from '../lib/auth';

type UserGroupFormModalProps = {
  group: UserGroup | null;
  roles: UserRole[];
  currentUser: SystemUserWithRole;
  onClose: () => void;
  onSuccess: () => void;
};

export default function UserGroupFormModal({
  group,
  roles,
  currentUser,
  onClose,
  onSuccess,
}: UserGroupFormModalProps) {
  const [formData, setFormData] = useState({
    group_name: '',
    description: '',
    default_role_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (group) {
      setFormData({
        group_name: group.group_name,
        description: group.description || '',
        default_role_id: group.default_role_id || '',
      });
    }
  }, [group]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.group_name.trim()) {
      newErrors.group_name = 'Group name is required';
    } else if (formData.group_name.length < 3) {
      newErrors.group_name = 'Group name must be at least 3 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const groupData = {
        group_name: formData.group_name.trim(),
        description: formData.description.trim() || null,
        default_role_id: formData.default_role_id || null,
      };

      if (group) {
        const { error: updateError } = await supabase
          .from('user_groups')
          .update(groupData)
          .eq('id', group.id);

        if (updateError) throw updateError;

        await AuthService.logActivity(
          currentUser.id,
          'update',
          'groups',
          group.id,
          { group_name: formData.group_name, action: 'edit_group' }
        );

        alert('Group updated successfully');
      } else {
        const { data: newGroup, error: insertError } = await supabase
          .from('user_groups')
          .insert(groupData)
          .select()
          .single();

        if (insertError) throw insertError;

        if (newGroup) {
          await AuthService.logActivity(
            currentUser.id,
            'create',
            'groups',
            newGroup.id,
            { group_name: formData.group_name, action: 'create_group' }
          );
        }

        alert('Group created successfully');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving group:', error);
      if (error.message?.includes('duplicate key') && error.message.includes('group_name')) {
        setErrors({ group_name: 'A group with this name already exists' });
      } else {
        alert('Failed to save group. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-slate-900">
            {group ? 'Edit Group' : 'Add New Group'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              value={formData.group_name}
              onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
              className={`w-full px-4 py-3 border ${errors.group_name ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
              placeholder="e.g., Regional Administrators"
            />
            {errors.group_name && (
              <p className="text-red-500 text-sm mt-1">{errors.group_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Describe the purpose of this group..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Default Role (Optional)
            </label>
            <select
              value={formData.default_role_id}
              onChange={(e) => setFormData({ ...formData, default_role_id: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">No default role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.display_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              When users are added to this group, they can be assigned this role by default
            </p>
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : group ? 'Update Group' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
