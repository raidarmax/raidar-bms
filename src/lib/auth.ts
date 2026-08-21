import { supabase, type SystemUser, type SystemUserWithRole, type UserRole } from './supabase';
import bcrypt from 'bcryptjs';

export class AuthService {
  static async validateCredentials(username: string, password: string): Promise<{ user: SystemUserWithRole | null; error: string | null }> {
    try {
      const { data: user, error: queryError } = await supabase
        .from('system_users')
        .select(`
          *,
          role:user_roles(*)
        `)
        .eq('username', username)
        .maybeSingle();

      if (queryError) {
        return { user: null, error: 'An error occurred during login' };
      }

      if (!user) {
        return { user: null, error: 'Invalid username or password' };
      }

      if (!user.is_active) {
        return { user: null, error: 'Account is inactive. Contact administrator.' };
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return { user: null, error: 'Account is temporarily locked. Try again later.' };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        await this.incrementFailedLoginAttempts(user.id);
        return { user: null, error: 'Invalid username or password' };
      }

      return { user: user as SystemUserWithRole, error: null };
    } catch (err) {
      console.error('Login error:', err);
      return { user: null, error: 'An error occurred during login' };
    }
  }

  static async completeLogin(userId: string): Promise<void> {
    await this.resetFailedLoginAttempts(userId);
    await this.updateLastLogin(userId);
    await this.logActivity(userId, 'login', 'system', null, { success: true });
  }

  static async login(username: string, password: string): Promise<{ user: SystemUserWithRole | null; error: string | null }> {
    const result = await this.validateCredentials(username, password);
    if (result.user) {
      await this.completeLogin(result.user.id);
    }
    return result;
  }

  static async incrementFailedLoginAttempts(userId: string): Promise<void> {
    const { data: user } = await supabase
      .from('system_users')
      .select('failed_login_attempts')
      .eq('id', userId)
      .maybeSingle();

    if (user) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const updates: any = { failed_login_attempts: newAttempts };

      if (newAttempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);
        updates.locked_until = lockUntil.toISOString();
      }

      await supabase
        .from('system_users')
        .update(updates)
        .eq('id', userId);
    }
  }

  static async resetFailedLoginAttempts(userId: string): Promise<void> {
    await supabase
      .from('system_users')
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq('id', userId);
  }

  static async updateLastLogin(userId: string): Promise<void> {
    await supabase
      .from('system_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);
  }

  static async logActivity(
    userId: string,
    actionType: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'view' | 'export',
    module: 'owners' | 'motorcycles' | 'riders' | 'verifications' | 'users' | 'groups' | 'settings' | 'system',
    recordId: string | null,
    details: any
  ): Promise<void> {
    await supabase.from('user_activity_logs').insert({
      user_id: userId,
      action_type: actionType,
      module,
      record_id: recordId,
      details,
      ip_address: null,
      user_agent: navigator.userAgent,
    });
  }

  static async getCurrentUser(userId: string): Promise<SystemUserWithRole | null> {
    const { data } = await supabase
      .from('system_users')
      .select(`
        *,
        role:user_roles(*)
      `)
      .eq('id', userId)
      .maybeSingle();

    return data as SystemUserWithRole | null;
  }
}

export class PermissionService {
  static canViewAll(role: UserRole): boolean {
    return role.can_view_all;
  }

  static canEditAll(role: UserRole): boolean {
    return role.can_edit_all;
  }

  static canDelete(role: UserRole): boolean {
    return role.can_delete;
  }

  static canApprove(role: UserRole): boolean {
    return role.can_approve;
  }

  static canManageUsers(role: UserRole): boolean {
    return role.can_manage_users;
  }

  static canViewAuditLogs(role: UserRole): boolean {
    return role.can_view_audit_logs;
  }

  static canExportData(role: UserRole): boolean {
    return role.can_export_data;
  }

  static canManagePolice(role: UserRole): boolean {
    return role.can_manage_police;
  }

  static isReadOnly(role: UserRole): boolean {
    return role.can_view_all && !role.can_edit_all && !role.can_delete;
  }

  static isSuperAdmin(role: UserRole): boolean {
    return role.role_name === 'super_admin';
  }

  static hasPermission(role: UserRole, permission: keyof Omit<UserRole, 'id' | 'role_name' | 'display_name' | 'description' | 'created_at' | 'updated_at'>): boolean {
    return role[permission];
  }
}
