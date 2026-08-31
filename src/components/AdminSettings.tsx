import { useState, useEffect } from 'react';
import {
  Save,
  RefreshCw,
  Key,
  MessageSquare,
  Settings2,
  Bell,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Server,
  FileText,
  UserCog,
  Shield,
  Star,
  TrendingDown,
  TrendingUp,
  Database,
  Fingerprint,
  Cpu,
  ChevronLeft,
} from 'lucide-react';
import { supabase, type SystemUserWithRole } from '../lib/supabase';
import UserManagement from './UserManagement';
import UserGroupManagement from './UserGroupManagement';
import DemoContentManager from './DemoContentManager';
import DocumentSamplesManager from './DocumentSamplesManager';
import DeviceManagement from './DeviceManagement';

type Setting = {
  id: string;
  category: string;
  key: string;
  value: string;
  label: string;
  description: string;
  is_secret: boolean;
  updated_at: string;
  updated_by: string | null;
};

type CategoryMeta = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const CATEGORIES: CategoryMeta[] = [
  { id: 'users', label: 'Users', description: 'Manage system users, roles, and access permissions', icon: <UserCog className="h-5 w-5" /> },
  { id: 'groups', label: 'Groups', description: 'Organise users into groups for scoped access', icon: <Shield className="h-5 w-5" /> },
  { id: 'api_keys', label: 'API Keys', description: 'Third-party API credentials for government verification services', icon: <Key className="h-5 w-5" /> },
  { id: 'identity_kyc', label: 'Identity KYC (Didit)', description: 'Configure the didit.me identity verification integration used across owner, rider and business onboarding', icon: <Fingerprint className="h-5 w-5" /> },
  { id: 'sms', label: 'SMS & OTP', description: 'SMS gateway and OTP delivery configuration', icon: <MessageSquare className="h-5 w-5" /> },
  { id: 'templates', label: 'Message Templates', description: 'Customise the content of SMS messages sent to riders and owners', icon: <FileText className="h-5 w-5" /> },
  { id: 'verification', label: 'Verification', description: 'Document verification requirements and sandbox mode', icon: <ShieldCheck className="h-5 w-5" /> },
  { id: 'document_samples', label: 'Document Samples', description: 'Reference samples that guide OCR validation for IDs, passports, licences and more', icon: <FileText className="h-5 w-5" /> },
  { id: 'general', label: 'General', description: 'System name, fees, and contact information', icon: <Settings2 className="h-5 w-5" /> },
  { id: 'rating', label: 'Rider Rating', description: 'Configure point deductions, bonuses, and tier thresholds for the rider rating score', icon: <Star className="h-5 w-5" /> },
  { id: 'gps_devices', label: 'GPS Devices', description: 'Manage GPS tracking devices and their motorcycle assignments', icon: <Cpu className="h-5 w-5" /> },
  { id: 'notifications', label: 'Notifications', description: 'Automated notification preferences', icon: <Bell className="h-5 w-5" /> },
  { id: 'demo', label: 'Demo Content', description: 'Generate or wipe demo data for training, screenshots, and QA', icon: <Database className="h-5 w-5" /> },
];

type AdminSettingsProps = {
  currentUsername: string;
  currentUser: SystemUserWithRole;
  onDataChanged?: () => void;
};

export default function AdminSettings({ currentUsername, currentUser, onDataChanged }: AdminSettingsProps) {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('users');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('system_settings')
      .select('*')
      .order('category')
      .order('key');

    if (fetchError) {
      setError('Failed to load settings');
      console.error(fetchError);
    } else if (data) {
      setSettings(data);
      const values: Record<string, string> = {};
      data.forEach((s: Setting) => {
        values[`${s.category}:${s.key}`] = s.value ?? '';
      });
      setEditedValues(values);
    }
    setLoading(false);
  }

  function handleChange(category: string, key: string, value: string) {
    setEditedValues((prev) => ({ ...prev, [`${category}:${key}`]: value }));
    setSaveSuccess(false);
  }

  function toggleReveal(settingKey: string) {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(settingKey)) {
        next.delete(settingKey);
      } else {
        next.add(settingKey);
      }
      return next;
    });
  }

  function hasChanges(): boolean {
    return settings.some((s) => {
      const editedVal = editedValues[`${s.category}:${s.key}`] ?? '';
      return editedVal !== (s.value ?? '');
    });
  }

  function getChangedSettings(): Setting[] {
    return settings.filter((s) => {
      const editedVal = editedValues[`${s.category}:${s.key}`] ?? '';
      return editedVal !== (s.value ?? '');
    });
  }

  async function handleSave() {
    const changed = getChangedSettings();
    if (changed.length === 0) return;

    setSaving(true);
    setError('');

    try {
      for (const setting of changed) {
        const newValue = editedValues[`${setting.category}:${setting.key}`] ?? '';
        const { error: updateError } = await supabase
          .from('system_settings')
          .update({
            value: newValue,
            updated_at: new Date().toISOString(),
            updated_by: currentUsername,
          })
          .eq('id', setting.id);

        if (updateError) throw updateError;
      }

      await loadSettings();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save settings. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(service: string) {
    setTestingConnection(service);
    setConnectionResults((prev) => {
      const next = { ...prev };
      delete next[service];
      return next;
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    let result: { success: boolean; message: string };

    if (service === 'gavaconnect') {
      const clientId = editedValues['api_keys:gavaconnect_client_id'] ?? '';
      const clientSecret = editedValues['api_keys:gavaconnect_client_secret'] ?? '';
      if (!clientId || !clientSecret) {
        result = { success: false, message: 'Client ID and Secret are required' };
      } else {
        result = { success: true, message: 'Credentials saved. Connection will be tested on next verification request.' };
      }
    } else if (service === 'ntsa') {
      const apiKey = editedValues['api_keys:ntsa_api_key'] ?? '';
      if (!apiKey) {
        result = { success: false, message: 'API Key is required' };
      } else {
        result = { success: true, message: 'API Key saved. Connection will be tested on next license verification.' };
      }
    } else if (service === 'bulkke') {
      const apiKey = editedValues['sms:bulkke_api_key'] ?? '';
      if (!apiKey) {
        result = { success: false, message: 'API Key is required. OTP SMS delivery will fail without a configured key.' };
      } else {
        result = { success: true, message: 'API Key saved. SMS delivery will be tested on next OTP request.' };
      }
    } else {
      result = { success: true, message: 'Configuration saved.' };
    }

    setConnectionResults((prev) => ({ ...prev, [service]: result }));
    setTestingConnection(null);
  }

  function renderSettingInput(setting: Setting) {
    const compositeKey = `${setting.category}:${setting.key}`;
    const currentValue = editedValues[compositeKey] ?? '';
    const isRevealed = revealedSecrets.has(compositeKey);
    const originalValue = setting.value ?? '';
    const isChanged = currentValue !== originalValue;

    if (setting.category === 'templates') {
      return (
        <textarea
          value={currentValue}
          onChange={(e) => handleChange(setting.category, setting.key, e.target.value)}
          rows={5}
          placeholder="Enter message template..."
          className={`w-full px-4 py-3 border rounded-lg text-sm font-mono leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y ${
            isChanged ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'
          }`}
        />
      );
    }

    if (currentValue === 'true' || currentValue === 'false') {
      return (
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleChange(setting.category, setting.key, currentValue === 'true' ? 'false' : 'true')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              currentValue === 'true' ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                currentValue === 'true' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-slate-600">{currentValue === 'true' ? 'Enabled' : 'Disabled'}</span>
        </div>
      );
    }

    if (setting.is_secret) {
      return (
        <div className="relative">
          <input
            type={isRevealed ? 'text' : 'password'}
            value={currentValue}
            onChange={(e) => handleChange(setting.category, setting.key, e.target.value)}
            placeholder="Enter value..."
            className={`w-full px-4 py-2.5 pr-10 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
              isChanged ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
            }`}
          />
          <button
            onClick={() => toggleReveal(compositeKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      );
    }

    return (
      <input
        type="text"
        value={currentValue}
        onChange={(e) => handleChange(setting.category, setting.key, e.target.value)}
        placeholder="Enter value..."
        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
          isChanged ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
        }`}
      />
    );
  }

  function renderCategoryContent(categoryId: string) {
    if (categoryId === 'users') {
      return <UserManagement currentUser={currentUser} />;
    }
    if (categoryId === 'groups') {
      return <UserGroupManagement currentUser={currentUser} />;
    }
    if (categoryId === 'demo') {
      return <DemoContentManager currentUsername={currentUsername} onDataChanged={onDataChanged} />;
    }
    if (categoryId === 'document_samples') {
      return <DocumentSamplesManager currentUsername={currentUsername} />;
    }
    if (categoryId === 'gps_devices') {
      return <DeviceManagement />;
    }

    const categorySettings = settings.filter((s) => s.category === categoryId);

    if (categoryId === 'identity_kyc') {
      const enabled = (editedValues['identity_kyc:didit_enabled'] ?? 'true') === 'true';
      const sections: { title: string; description: string; keys: string[] }[] = [
        {
          title: 'Connection',
          description: 'Base URL and API credentials issued by the didit Business Console.',
          keys: ['didit_enabled', 'didit_api_base_url', 'didit_api_key', 'didit_webhook_secret'],
        },
        {
          title: 'Workflows',
          description: 'Paste the workflow IDs from Didit → Workflows. Each role uses its own workflow so you can toggle features (ID, liveness, AML, KYB) independently.',
          keys: ['didit_workflow_id_rider', 'didit_workflow_id_owner', 'didit_workflow_id_business'],
        },
      ];

      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/didit-webhook`;

      return (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-slate-900">Didit.me Identity Verification</h4>
                <p className="text-sm text-slate-500 mt-0.5">
                  Powers ID capture, face-match, liveness, AML screening and KYB for owners, riders and business fleets. When a
                  session finishes, didit calls the webhook below and our system flips the subject's verification status.
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Webhook URL</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs font-mono text-slate-800 break-all">{webhookUrl}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(webhookUrl)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Paste this into the Didit → API & Webhooks page.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Get workflow IDs</p>
                <p className="text-xs text-slate-700 mt-1">
                  Sign in at <a href="https://business.didit.me" target="_blank" rel="noreferrer" className="text-emerald-600 font-medium hover:underline">business.didit.me</a>, open
                  Workflows, then copy the UUID for each.
                </p>
              </div>
            </div>
          </div>

          {sections.map((section) => {
            const rows = section.keys
              .map((key) => categorySettings.find((s) => s.key === key))
              .filter((s): s is Setting => Boolean(s));

            if (rows.length === 0) return null;

            return (
              <div key={section.title} className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="font-semibold text-slate-900">{section.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">{section.description}</p>
                <div className="space-y-4">
                  {rows.map((setting) => (
                    <div key={setting.id}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{setting.label}</label>
                      {setting.description && <p className="text-xs text-slate-500 mb-1.5">{setting.description}</p>}
                      {renderSettingInput(setting)}
                      {setting.updated_by && (
                        <p className="text-xs text-slate-400 mt-1.5">
                          Last updated by {setting.updated_by} on {new Date(setting.updated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (categoryId === 'api_keys') {
      return (
        <div className="space-y-8">
          {/* GavaConnect Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Server className="h-4 w-4 text-blue-600" />
                  GavaConnect (IPRS & KRA)
                </h4>
                <p className="text-sm text-slate-500 mt-0.5">National ID verification via IPRS and KRA PIN validation</p>
              </div>
              <button
                onClick={() => testConnection('gavaconnect')}
                disabled={testingConnection === 'gavaconnect'}
                className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {testingConnection === 'gavaconnect' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Test
              </button>
            </div>
            {connectionResults.gavaconnect && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                connectionResults.gavaconnect.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {connectionResults.gavaconnect.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {connectionResults.gavaconnect.message}
              </div>
            )}
            <div className="space-y-4">
              {categorySettings
                .filter((s) => s.key.startsWith('gavaconnect'))
                .map((setting) => (
                  <div key={setting.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{setting.label}</label>
                    {setting.description && <p className="text-xs text-slate-500 mb-1.5">{setting.description}</p>}
                    {renderSettingInput(setting)}
                  </div>
                ))}
            </div>
          </div>

          {/* NTSA Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Server className="h-4 w-4 text-amber-600" />
                  NTSA TIMS
                </h4>
                <p className="text-sm text-slate-500 mt-0.5">Driving license verification via NTSA Transport Integrated Management System</p>
              </div>
              <button
                onClick={() => testConnection('ntsa')}
                disabled={testingConnection === 'ntsa'}
                className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {testingConnection === 'ntsa' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Test
              </button>
            </div>
            {connectionResults.ntsa && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                connectionResults.ntsa.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {connectionResults.ntsa.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {connectionResults.ntsa.message}
              </div>
            )}
            <div className="space-y-4">
              {categorySettings
                .filter((s) => s.key.startsWith('ntsa'))
                .map((setting) => (
                  <div key={setting.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{setting.label}</label>
                    {setting.description && <p className="text-xs text-slate-500 mb-1.5">{setting.description}</p>}
                    {renderSettingInput(setting)}
                  </div>
                ))}
            </div>
          </div>
        </div>
      );
    }

    if (categoryId === 'sms') {      return (
        <div className="space-y-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Server className="h-4 w-4 text-emerald-600" />
                  Bulk.ke SMS Gateway
                </h4>
                <p className="text-sm text-slate-500 mt-0.5">SMS delivery for OTP codes and notifications</p>
              </div>
              <button
                onClick={() => testConnection('bulkke')}
                disabled={testingConnection === 'bulkke'}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {testingConnection === 'bulkke' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Test
              </button>
            </div>
            {connectionResults.bulkke && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                connectionResults.bulkke.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {connectionResults.bulkke.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {connectionResults.bulkke.message}
              </div>
            )}
            <div className="space-y-4">
              {categorySettings
                .filter((s) => s.key.startsWith('bulkke'))
                .map((setting) => (
                  <div key={setting.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{setting.label}</label>
                    {setting.description && <p className="text-xs text-slate-500 mb-1.5">{setting.description}</p>}
                    {renderSettingInput(setting)}
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h4 className="font-semibold text-slate-900 mb-4">OTP Configuration</h4>
            <div className="space-y-4">
              {categorySettings
                .filter((s) => s.key.startsWith('otp'))
                .map((setting) => (
                  <div key={setting.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{setting.label}</label>
                    {setting.description && <p className="text-xs text-slate-500 mb-1.5">{setting.description}</p>}
                    {renderSettingInput(setting)}
                  </div>
                ))}
            </div>
          </div>
        </div>
      );
    }

    if (categoryId === 'templates') {
      const TEMPLATE_VARS: Record<string, { label: string; vars: string[] }> = {
        otp_message: {
          label: 'OTP Verification',
          vars: ['{otp}', '{expiry_minutes}'],
        },
        fine_rider_message: {
          label: 'Traffic Fine — Rider',
          vars: ['{fine_reference}', '{fine_amount}', '{offence_name}', '{due_date}', '{officer_service_number}', '{station_name}'],
        },
        fine_owner_message: {
          label: 'Traffic Fine — Owner',
          vars: ['{fine_reference}', '{fine_amount}', '{rider_name}', '{offence_name}', '{due_date}', '{station_name}'],
        },
      };

      return (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
            <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <span>
              Use <code className="bg-blue-100 px-1 rounded font-mono text-xs">{'{variable}'}</code> placeholders in your templates.
              Each template shows which variables are available — they are replaced with live data when the SMS is sent.
            </span>
          </div>

          {categorySettings.map((setting) => {
            const meta = TEMPLATE_VARS[setting.key] ?? { label: setting.label, vars: [] };
            const compositeKey = `${setting.category}:${setting.key}`;
            const isChanged = (editedValues[compositeKey] ?? '') !== (setting.value ?? '');

            return (
              <div key={setting.id} className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-semibold text-slate-900">{setting.label}</h4>
                    {setting.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{setting.description}</p>
                    )}
                  </div>
                  {isChanged && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full flex-shrink-0">Unsaved</span>
                  )}
                </div>

                {renderSettingInput(setting)}

                {meta.vars.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Available variables</p>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.vars.map((v) => (
                        <code
                          key={v}
                          className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition"
                          title="Click to copy"
                          onClick={() => navigator.clipboard?.writeText(v)}
                        >
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {setting.updated_by && (
                  <p className="text-xs text-slate-400 mt-3">
                    Last updated by {setting.updated_by} on {new Date(setting.updated_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // Default: render all settings in the category as a simple list
    if (categoryId === 'rating') {
      const bySection: Record<string, Setting[]> = {
        deductions: categorySettings.filter((s) => s.key.startsWith('deduct_')),
        bonuses: categorySettings.filter((s) => s.key.startsWith('bonus_')),
        tiers: categorySettings.filter((s) => s.key.startsWith('tier_')),
      };

      const sections: { id: keyof typeof bySection; title: string; description: string; icon: React.ReactNode; tone: string; }[] = [
        { id: 'deductions', title: 'Deductions', description: 'Points removed for negative behaviours or missing compliance', icon: <TrendingDown className="h-4 w-4 text-rose-600" />, tone: 'text-rose-600' },
        { id: 'bonuses',    title: 'Bonuses',    description: 'Points awarded for positive behaviours and completeness',  icon: <TrendingUp className="h-4 w-4 text-emerald-600" />, tone: 'text-emerald-600' },
        { id: 'tiers',      title: 'Tier thresholds', description: 'Minimum score needed to earn each rating tier (0-100 scale)', icon: <Star className="h-4 w-4 text-amber-500" />, tone: 'text-amber-600' },
      ];

      return (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
            <Star className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">Every rider starts at 100 points.</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Deductions and bonuses shift the score from that baseline. Scores are clamped to 0-100 and every rider's rating is
                recomputed automatically when these values change.
              </p>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                  {section.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{section.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {bySection[section.id].length === 0 && (
                  <p className="px-6 py-4 text-sm text-slate-400">No settings configured.</p>
                )}
                {bySection[section.id].map((setting) => {
                  const compositeKey = `${setting.category}:${setting.key}`;
                  const currentValue = editedValues[compositeKey] ?? '';
                  const isChanged = currentValue !== (setting.value ?? '');
                  return (
                    <div key={setting.id} className="px-6 py-4 grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4 items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800">{setting.label}</p>
                          {isChanged && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Unsaved</span>
                          )}
                        </div>
                        {setting.description && <p className="text-xs text-slate-500 mt-0.5">{setting.description}</p>}
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          value={currentValue}
                          onChange={(e) => handleChange(setting.category, setting.key, e.target.value)}
                          className={`w-full pl-3 pr-10 py-2 border rounded-lg text-sm font-semibold tabular-nums text-right focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                            isChanged ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
                          }`}
                        />
                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider ${section.tone}`}>
                          pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Default: render all settings in the category as a simple list
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="space-y-5">
          {categorySettings.map((setting) => (
            <div key={setting.id} className="pb-5 border-b border-slate-100 last:border-0 last:pb-0">
              <label className="block text-sm font-medium text-slate-700 mb-1">{setting.label}</label>
              {setting.description && <p className="text-xs text-slate-500 mb-2">{setting.description}</p>}
              {renderSettingInput(setting)}
              {setting.updated_by && (
                <p className="text-xs text-slate-400 mt-1.5">
                  Last updated by {setting.updated_by} on {new Date(setting.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  const activeCategoryMeta = CATEGORIES.find((c) => c.id === activeCategory);
  const isSelfManagedCategory = activeCategory === 'users' || activeCategory === 'groups' || activeCategory === 'demo' || activeCategory === 'document_samples' || activeCategory === 'gps_devices';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">System Settings</h2>
          <p className="text-sm text-slate-500 mt-1">Manage users, groups, API integrations, fees, and system configuration</p>
        </div>
        {!isSelfManagedCategory && (
          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-sm text-emerald-600 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                Saved successfully
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges()}
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${
                hasChanges()
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!isSelfManagedCategory && hasChanges() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          You have unsaved changes. Click "Save Changes" to apply them.
        </div>
      )}

      {/* Sidebar + Content Layout */}
      <div className="flex gap-6 items-start">
        {/* Vertical sidebar nav */}
        <nav className={`${sidebarCollapsed ? 'w-14' : 'w-52'} flex-shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden transition-all duration-200`}>
          {CATEGORIES.map((cat, idx) => {
            const catSettings = settings.filter((s) => s.category === cat.id);
            const catHasChanges = catSettings.some((s) => {
              const editedVal = editedValues[`${s.category}:${s.key}`] ?? '';
              return editedVal !== (s.value ?? '');
            });
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                title={sidebarCollapsed ? cat.label : undefined}
                className={`w-full flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-0' : 'px-4'} py-2.5 text-sm font-medium text-left transition-colors relative
                  ${idx !== 0 ? 'border-t border-slate-100' : ''}
                  ${isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-500 rounded-r-full" />
                )}
                <span className={`flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {cat.icon}
                </span>
                {!sidebarCollapsed && <span className="flex-1 truncate">{cat.label}</span>}
                {!sidebarCollapsed && catHasChanges && (
                  <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-2'} py-2.5 border-t border-slate-200 text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition`}
            title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {activeCategoryMeta && (
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">{activeCategoryMeta.label}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{activeCategoryMeta.description}</p>
            </div>
          )}
          {renderCategoryContent(activeCategory)}
        </div>
      </div>
    </div>
  );
}
