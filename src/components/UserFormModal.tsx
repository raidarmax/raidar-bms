import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase, type SystemUserWithRole, type UserRole, type UserGroup } from '../lib/supabase';
import { AuthService } from '../lib/auth';
import bcrypt from 'bcryptjs';

type UserFormModalProps = {
  user: SystemUserWithRole | null;
  roles: UserRole[];
  groups: UserGroup[];
  currentUser: SystemUserWithRole;
  onClose: () => void;
  onSuccess: () => void;
};

export default function UserFormModal({
  user,
  roles,
  groups,
  currentUser,
  onClose,
  onSuccess,
}: UserFormModalProps) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role_id: '',
    is_active: true,
  });
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        confirmPassword: '',
        full_name: user.full_name,
        role_id: user.role_id,
        is_active: user.is_active,
      });
      loadUserGroups();
    } else {
      const defaultRole = roles.find((r) => r.role_name === 'viewer');
      if (defaultRole) {
        setFormData((prev) => ({ ...prev, role_id: defaultRole.id }));
      }
    }
  }, [user, roles]);

  const loadUserGroups = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (data) {
      setSelectedGroups(data.map((m) => m.group_id));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!formData.role_id) {
      newErrors.role_id = 'Role is required';
    }

    if (!user) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else if (formData.password) {
      if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
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
      if (user) {
        const updates: any = {
          username: formData.username,
          email: formData.email,
          full_name: formData.full_name,
          role_id: formData.role_id,
          is_active: formData.is_active,
        };

        if (formData.password) {
          const passwordHash = await bcrypt.hash(formData.password, 10);
          updates.password_hash = passwordHash;
        }

        const { error: updateError } = await supabase
          .from('system_users')
          .update(updates)
          .eq('id', user.id);

        if (updateError) throw updateError;

        await updateUserGroups(user.id);

        await AuthService.logActivity(
          currentUser.id,
          'update',
          'users',
          user.id,
          { username: formData.username, action: 'edit_user' }
        );

        alert('User updated successfully');
      } else {
        const passwordHash = await bcrypt.hash(formData.password, 10);

        const { data: newUser, error: insertError } = await supabase
          .from('system_users')
          .insert({
            username: formData.username,
            email: formData.email,
            password_hash: passwordHash,
            full_name: formData.full_name,
            role_id: formData.role_id,
            is_active: formData.is_active,
            created_by: currentUser.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        if (newUser) {
          await updateUserGroups(newUser.id);

          await AuthService.logActivity(
            currentUser.id,
            'create',
            'users',
            newUser.id,
            { username: formData.username, action: 'create_user' }
          );
        }

        alert('User created successfully');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving user:', error);
      if (error.message?.includes('duplicate key')) {
        if (error.message.includes('username')) {
          setErrors({ username: 'Username already exists' });
        } else if (error.message.includes('email')) {
          setErrors({ email: 'Email already exists' });
        } else {
          alert('A user with this information already exists');
        }
      } else {
        alert('Failed to save user. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateUserGroups = async (userId: string) => {
    await supabase
      .from('user_group_members')
      .delete()
      .eq('user_id', userId);

    if (selectedGroups.length > 0) {
      await supabase
        .from('user_group_members')
        .insert(
          selectedGroups.map((groupId) => ({
            user_id: userId,
            group_id: groupId,
            added_by: currentUser.id,
          }))
        );
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-2xl font-bold text-slate-900">
            {user ? 'Edit User' : 'Add New User'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Username *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className={`w-full px-4 py-3 border ${errors.username ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                placeholder="johndoe"
              />
              {errors.username && (
                <p className="text-red-500 text-sm mt-1">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-3 border ${errors.email ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                placeholder="john@example.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className={`w-full px-4 py-3 border ${errors.full_name ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
              placeholder="John Doe"
            />
            {errors.full_name && (
              <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Role *
            </label>
            <select
              value={formData.role_id}
              onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
              className={`w-full px-4 py-3 border ${errors.role_id ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.display_name} - {role.description}
                </option>
              ))}
            </select>
            {errors.role_id && (
              <p className="text-red-500 text-sm mt-1">{errors.role_id}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Password {!user && '*'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-4 py-3 border ${errors.password ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                placeholder={user ? 'Leave blank to keep current' : 'Enter password'}
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Confirm Password {!user && '*'}
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`w-full px-4 py-3 border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                placeholder="Confirm password"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              User Groups (Optional)
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {groups.length === 0 ? (
                <p className="text-slate-500 text-sm">No groups available</p>
              ) : (
                groups.map((group) => (
                  <label key={group.id} className="flex items-center space-x-3 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-900">{group.group_name}</span>
                      {group.description && (
                        <p className="text-xs text-slate-500">{group.description}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-slate-700 cursor-pointer">
              Active account (user can log in)
            </label>
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
              {loading ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
