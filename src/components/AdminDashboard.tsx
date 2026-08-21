import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  LogOut,
  Search,
  Users,
  Bike,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  Activity,
  DollarSign,
  Menu,
  X,
  Lock,
  Camera,
} from 'lucide-react';
import {
  PoliceStationIcon,
  PoliceBadgeIcon,
  MotorcycleIcon,
  IdentityCardIcon,
  TrafficFineIcon,
  IncidentAlertIcon,
  RevenueVaultIcon,
  AuditLogIcon,
  SettingsGearIcon,
  CommandCenterIcon,
  CommunityIcon,
} from './icons/BrandIcons';
import { supabase, type Owner, type Motorcycle, type Rider, type Verification, type RiderHistory, type SystemUserWithRole, type Incident, type Payment } from '../lib/supabase';
import SearchableList from './SearchableList';
import { usePersistedState } from '../lib/navigationMemory';
import TrackingModal from './TrackingModal';
import OwnerDetailsModal from './OwnerDetailsModal';
import MotorcycleDetailsModal from './MotorcycleDetailsModal';
import RiderDetailsModal from './RiderDetailsModal';
import { RiderRatingChip } from './RiderRatingBadge';
import IncidentDetailsPage from './IncidentDetailsModal';
import IncidentsPanel from './IncidentsPanel';
import AuditLog from './AuditLog';
import RevenueView from './RevenueView';
import AdminHomeOverview from './AdminHomeOverview';
import AdminSettings from './AdminSettings';
import OwnersRidersInsights from './OwnersRidersInsights';
import MotorcyclesInsights from './MotorcyclesInsights';
import PoliceStationManagement from './PoliceStationManagement';
import PoliceOfficerManagement from './PoliceOfficerManagement';
import FinesManagement from './FinesManagement';
import DocumentRevalidateButton from './DocumentRevalidateButton';
import DocumentLink from './DocumentLink';
import { PermissionService, AuthService } from '../lib/auth';
import bcrypt from 'bcryptjs';

type AdminDashboardProps = {
  currentUser: SystemUserWithRole;
  onLogout: () => void;
};

type RegistrationRecord = {
  motorcycle_id: string;
  owner_id: string;
  owner_name: string;
  phone_number: string;
  national_id: string;
  motorcycle_registration: string;
  rider_name: string;
  rider_id: string | null;
  status: string;
  qr_code_data: string;
  created_at: string;
};

type FullRegistrationDetails = {
  owner: Owner;
  motorcycle: Motorcycle;
  rider: Rider | null;
  verification: Verification;
  lastPayment: Payment | null;
  nextPaymentDue: string;
};

export default function AdminDashboard({ currentUser, onLogout }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    totalOwners: 0,
    totalMotorcycles: 0,
    totalRiders: 0,
    pendingVerifications: 0,
    verifiedRecords: 0,
    totalRevenue: 0,
  });
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [selectedMotorcycleForDetails, setSelectedMotorcycleForDetails] = useState<Motorcycle | null>(null);
  const [selectedMotorcycleForTracking, setSelectedMotorcycleForTracking] = useState<Motorcycle | null>(null);
  const [selectedRiderForDetails, setSelectedRiderForDetails] = useState<Rider | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [fullDetails, setFullDetails] = useState<FullRegistrationDetails | null>(null);
  const [riderHistory, setRiderHistory] = useState<RiderHistory[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showRiderForm, setShowRiderForm] = useState(false);
  const [riderFormData, setRiderFormData] = useState({
    name: '',
    idNumber: '',
    countyRegistrationNumber: '',
    saccoId: '',
    stageName: '',
  });
  const [activeTab, setActiveTabRaw] = useState<'home' | 'owners' | 'motorcycles' | 'riders' | 'incidents' | 'revenue' | 'fines' | 'users' | 'groups' | 'audit' | 'settings' | 'police' | 'police-officers' | 'profile'>(() => {
    const saved = localStorage.getItem('adminActiveTab');
    const valid = ['home','owners','motorcycles','riders','incidents','revenue','fines','users','groups','audit','settings','police','police-officers','profile'];
    return (saved && valid.includes(saved) ? saved : 'home') as any;
  });
  const setActiveTab = (tab: typeof activeTab) => {
    localStorage.setItem('adminActiveTab', tab);
    setActiveTabRaw(tab);
  };
  const [ownersView, setOwnersView] = usePersistedState<'insights' | 'directory'>('admin.owners.view', 'insights');
  const [ridersView, setRidersView] = usePersistedState<'insights' | 'directory'>('admin.riders.view', 'insights');
  const [motorcyclesView, setMotorcyclesView] = usePersistedState<'insights' | 'directory'>('admin.motorcycles.view', 'insights');
  const [showTrackingPage, setShowTrackingPage] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState('admin.sidebar.collapsed', false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [photoTick, setPhotoTick] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<RegistrationRecord | null>(null);

  const canManageUsers = PermissionService.canManageUsers(currentUser.role);
  const canViewAuditLogs = PermissionService.canViewAuditLogs(currentUser.role);
  const canDelete = PermissionService.canDelete(currentUser.role);
  const canApprove = PermissionService.canApprove(currentUser.role);
  const canEditAll = PermissionService.canEditAll(currentUser.role);
  const canManagePolice = PermissionService.canManagePolice(currentUser.role);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'home' || activeTab === 'owners' || activeTab === 'motorcycles' || activeTab === 'riders') {
      loadStats();
    }
  }, [activeTab]);

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.current || !passwordForm.newPass || !passwordForm.confirm) {
      setPasswordError('All fields are required');
      return;
    }
    if (passwordForm.newPass.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const isValid = await bcrypt.compare(passwordForm.current, currentUser.password_hash);
      if (!isValid) {
        setPasswordError('Current password is incorrect');
        setChangingPassword(false);
        return;
      }

      const newHash = await bcrypt.hash(passwordForm.newPass, 10);
      const { error } = await supabase
        .from('system_users')
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id);

      if (error) throw error;

      currentUser.password_hash = newHash;
      setPasswordForm({ current: '', newPass: '', confirm: '' });
      setPasswordSuccess('Password changed successfully');
      await AuthService.logActivity(currentUser.id, 'update', 'system', currentUser.id, { action: 'password_change' });
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordError('Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setPhotoSuccess('');

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Image must be smaller than 2 MB');
      return;
    }

    setPhotoUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const { error } = await supabase
        .from('system_users')
        .update({ profile_photo_url: dataUrl, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id);

      if (error) throw error;

      currentUser.profile_photo_url = dataUrl;
      setPhotoTick((t) => t + 1);
      setPhotoSuccess('Profile picture updated');
      await AuthService.logActivity(currentUser.id, 'update', 'system', currentUser.id, { action: 'profile_photo_update' });
    } catch (err) {
      console.error('Photo upload error:', err);
      setPhotoError('Failed to upload photo. Please try again.');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  const loadStats = async () => {
    try {
      const [{ count: ownerCount }, { count: motoCount }, { count: riderCount }, { data: verifications }, { data: payments }] = await Promise.all([
        supabase.from('owners').select('*', { count: 'exact', head: true }),
        supabase.from('motorcycles').select('*', { count: 'exact', head: true }),
        supabase.from('riders').select('*', { count: 'exact', head: true }),
        supabase.from('verifications').select('status'),
        supabase.from('payments').select('amount').eq('payment_status', 'completed'),
      ]);
      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      setStats({
        totalOwners: ownerCount || 0,
        totalMotorcycles: motoCount || 0,
        totalRiders: riderCount || 0,
        pendingVerifications: verifications?.filter((v) => v.status === 'Pending').length || 0,
        verifiedRecords: verifications?.filter((v) => v.status === 'Verified').length || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Search functions for each entity type
  const searchOwners = useCallback(async (query: string): Promise<Owner[]> => {
    const { data } = await supabase
      .from('owners')
      .select('*')
      .or(`full_name.ilike.%${query}%,phone_number.ilike.%${query}%,national_id.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }, []);

  const searchMotorcycles = useCallback(async (query: string): Promise<any[]> => {
    const { data } = await supabase
      .from('motorcycles')
      .select('*, owner:owners(full_name, phone_number), rider:riders!riders_motorcycle_id_fkey(name, id_number, assignment_status)')
      .or(`registration_number.ilike.%${query}%,tracking_device_id.ilike.%${query}%,make.ilike.%${query}%,model.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }, []);

  const searchRiders = useCallback(async (query: string): Promise<any[]> => {
    const { data } = await supabase
      .from('riders')
      .select('*, motorcycle:motorcycles(registration_number, make, model), owner:owners!riders_owner_id_fkey(full_name, phone_number)')
      .or(`name.ilike.%${query}%,id_number.ilike.%${query}%,phone_number.ilike.%${query}%,county_registration_number.ilike.%${query}%,sacco_id.ilike.%${query}%,bms_id.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }, []);

  const loadOwnersPage = useCallback(async (page: number, perPage: number, sort: { field: 'created_at' | 'name'; dir: 'asc' | 'desc' }) => {
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const column = sort.field === 'name' ? 'full_name' : 'created_at';
    const { data, count } = await supabase
      .from('owners')
      .select('*', { count: 'exact' })
      .order(column, { ascending: sort.dir === 'asc' })
      .range(from, to);
    return { data: data || [], total: count || 0 };
  }, []);

  const loadMotorcyclesPage = useCallback(async (page: number, perPage: number, sort: { field: 'created_at' | 'name' | 'incidents'; dir: 'asc' | 'desc' }) => {
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const column =
      sort.field === 'incidents' ? 'pending_incident_count'
      : sort.field === 'name' ? 'registration_number'
      : 'created_at';
    const { data, count } = await supabase
      .from('motorcycles')
      .select('*, owner:owners(full_name, phone_number), rider:riders!riders_motorcycle_id_fkey(name, id_number, assignment_status)', { count: 'exact' })
      .order(column, { ascending: sort.dir === 'asc' })
      .range(from, to);
    return { data: data || [], total: count || 0 };
  }, []);

  const loadRidersPage = useCallback(async (page: number, perPage: number, sort: { field: 'created_at' | 'name' | 'incidents'; dir: 'asc' | 'desc' }) => {
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const column =
      sort.field === 'incidents' ? 'pending_incident_count'
      : sort.field === 'name' ? 'name'
      : 'created_at';
    const { data, count } = await supabase
      .from('riders')
      .select('*, motorcycle:motorcycles(registration_number, make, model), owner:owners!riders_owner_id_fkey(full_name, phone_number)', { count: 'exact' })
      .order(column, { ascending: sort.dir === 'asc' })
      .range(from, to);
    return { data: data || [], total: count || 0 };
  }, []);

  const searchIncidents = useCallback(async (query: string): Promise<any[]> => {
    const { data } = await supabase
      .from('incidents')
      .select('*, motorcycle:motorcycles(registration_number), rider:riders(name, id_number)')
      .or(`incident_type.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%,reporter_name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }, []);

  const loadFullDetails = async (motorcycleId: string, ownerId: string) => {
    setLoadingDetails(true);
    try {
      const { data: owner, error: ownerError } = await supabase
        .from('owners')
        .select('*')
        .eq('id', ownerId)
        .maybeSingle();

      if (ownerError) throw ownerError;

      const { data: motorcycle, error: motorcycleError } = await supabase
        .from('motorcycles')
        .select('*')
        .eq('id', motorcycleId)
        .maybeSingle();

      if (motorcycleError) throw motorcycleError;

      const { data: rider, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('motorcycle_id', motorcycleId)
        .eq('assignment_status', 'Assigned')
        .maybeSingle();

      if (riderError) throw riderError;

      const { data: verification, error: verificationError } = await supabase
        .from('verifications')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (verificationError) throw verificationError;

      const { data: history, error: historyError } = await supabase
        .from('rider_history')
        .select('*')
        .eq('motorcycle_id', motorcycleId)
        .order('assigned_at', { ascending: false });

      if (historyError) throw historyError;

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_type', 'owner')
        .eq('user_id', ownerId)
        .eq('payment_status', 'completed')
        .order('payment_year', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError) throw paymentError;

      let nextPaymentDue = 'N/A';
      if (payment) {
        const lastPaymentYear = payment.payment_year;
        const nextYear = lastPaymentYear + 1;
        nextPaymentDue = `January 1, ${nextYear}`;
      } else if (owner) {
        const registrationYear = new Date(owner.created_at).getFullYear();
        nextPaymentDue = `January 1, ${registrationYear + 1}`;
      }

      if (owner && verification && motorcycle) {
        setFullDetails({ owner, motorcycle, rider, verification, lastPayment: payment, nextPaymentDue });
        setRiderHistory(history || []);
      }
    } catch (error) {
      console.error('Error loading full details:', error);
      alert('Failed to load full details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = async (record: RegistrationRecord) => {
    setSelectedRecord(record);
    await loadFullDetails(record.motorcycle_id, record.owner_id);
  };

  const updateVerificationStatus = async (ownerId: string, status: string) => {
    try {
      if (status === 'Verified' && fullDetails) {
        const motorcycle = fullDetails.motorcycle as any;
        if (!motorcycle.insurance_policy_number) {
          alert('Cannot verify registration: Insurance policy number is missing');
          return;
        }
      }

      const { error } = await supabase
        .from('verifications')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('owner_id', ownerId);

      if (error) throw error;
      await loadStats();
      setSelectedRecord(null);
      setFullDetails(null);
    } catch (error) {
      console.error('Error updating verification status:', error);
      alert('Failed to update status');
    }
  };

  const handleAddEditRider = () => {
    if (fullDetails?.rider) {
      setRiderFormData({
        name: fullDetails.rider.name,
        idNumber: fullDetails.rider.id_number,
        countyRegistrationNumber: fullDetails.rider.county_registration_number || '',
        saccoId: fullDetails.rider.sacco_id || '',
        stageName: fullDetails.rider.stage_name || '',
      });
    } else {
      setRiderFormData({
        name: '',
        idNumber: '',
        countyRegistrationNumber: '',
        saccoId: '',
        stageName: '',
      });
    }
    setShowRiderForm(true);
  };

  const handleSaveRider = async () => {
    if (!fullDetails || !selectedRecord) return;

    if (!riderFormData.name || !riderFormData.idNumber) {
      alert('Rider name and ID number are required');
      return;
    }

    try {
      const motorcycleData = await supabase
        .from('motorcycles')
        .select('id')
        .eq('owner_id', selectedRecord.owner_id)
        .maybeSingle();

      if (fullDetails.rider) {
        const { error } = await supabase
          .from('riders')
          .update({
            name: riderFormData.name,
            id_number: riderFormData.idNumber,
            county_registration_number: riderFormData.countyRegistrationNumber || null,
            sacco_id: riderFormData.saccoId || null,
            stage_name: riderFormData.stageName || null,
            motorcycle_id: motorcycleData.data?.id || null,
          })
          .eq('owner_id', selectedRecord.owner_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('riders')
          .insert({
            owner_id: selectedRecord.owner_id,
            name: riderFormData.name,
            id_number: riderFormData.idNumber,
            county_registration_number: riderFormData.countyRegistrationNumber || null,
            sacco_id: riderFormData.saccoId || null,
            stage_name: riderFormData.stageName || null,
            motorcycle_id: motorcycleData.data?.id || null,
          });

        if (error) throw error;
      }

      await loadFullDetails(selectedRecord.motorcycle_id, selectedRecord.owner_id);
      await loadStats();
      setShowRiderForm(false);
      alert('Rider information saved successfully');
    } catch (error) {
      console.error('Error saving rider:', error);
      alert('Failed to save rider information');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return (
          <span className="flex items-center space-x-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold">
            <CheckCircle className="h-4 w-4" />
            <span>Verified</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="flex items-center space-x-1 bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
            <XCircle className="h-4 w-4" />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-semibold">
            <Clock className="h-4 w-4" />
            <span>Pending</span>
          </span>
        );
    }
  };

  const navItems = [
    { id: 'home' as const, label: 'Dashboard', icon: <CommandCenterIcon className="h-5 w-5" />, show: true },
    { id: 'incidents' as const, label: 'Incidents', icon: <IncidentAlertIcon className="h-5 w-5" />, show: true },
    { id: 'riders' as const, label: 'Riders', icon: <IdentityCardIcon className="h-5 w-5" />, count: stats.totalRiders, show: true },
    { id: 'owners' as const, label: 'Boda Owners', icon: <CommunityIcon className="h-5 w-5" />, count: stats.totalOwners, show: true },
    { id: 'motorcycles' as const, label: 'Motorcycles', icon: <MotorcycleIcon className="h-5 w-5" />, count: stats.totalMotorcycles, show: true },
    { id: 'police' as const, label: 'Police Stations', icon: <PoliceStationIcon className="h-5 w-5" />, show: canManagePolice || canManageUsers },
    { id: 'police-officers' as const, label: 'Police Officers', icon: <PoliceBadgeIcon className="h-5 w-5" />, show: canManagePolice || canManageUsers },
    { id: 'fines' as const, label: 'Fine Management', icon: <TrafficFineIcon className="h-5 w-5" />, show: canManagePolice || canManageUsers },
    { id: 'revenue' as const, label: 'Revenue Report', icon: <RevenueVaultIcon className="h-5 w-5" />, show: true },
    { id: 'audit' as const, label: 'Audit Log', icon: <AuditLogIcon className="h-5 w-5" />, show: canViewAuditLogs },
    { id: 'settings' as const, label: 'Settings', icon: <SettingsGearIcon className="h-5 w-5" />, show: canManageUsers },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-50 transform transition-all duration-200 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-4 border-b border-slate-200 shrink-0 justify-between">
          <div className="flex items-center min-w-0">
            <img
              src="/bms_f_logo.png"
              alt="BMS"
              className="h-10 w-auto max-w-[150px] object-contain flex-shrink-0"
            />
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.filter(item => item.show).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
                setSelectedOwner(null);
                setSelectedMotorcycleForDetails(null);
                setSelectedMotorcycleForTracking(null);
                setSelectedRiderForDetails(null);
                setSelectedIncident(null);
                setSelectedRecord(null);
                setFullDetails(null);
                setShowRiderForm(false);
                setShowTrackingPage(false);
              }}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-left transition-all text-sm font-display ${
                activeTab === item.id
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`flex-shrink-0 ${activeTab === item.id ? 'text-emerald-600' : 'text-slate-400'}`}>
                {item.icon}
              </span>
              {!sidebarCollapsed && <span className="flex-1">{item.label}</span>}
              {!sidebarCollapsed && item.count !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeTab === item.id
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-200 p-3 shrink-0 space-y-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition font-medium"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={() => { localStorage.removeItem('adminActiveTab'); onLogout(); }}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} min-w-0 transition-all duration-200`}>
        {/* Desktop top-right header with profile */}
        <div className="hidden lg:flex sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 items-center justify-end gap-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full transition-all group ${
              activeTab === 'profile'
                ? 'bg-emerald-50 ring-1 ring-emerald-200'
                : 'hover:bg-slate-50'
            }`}
          >
            {currentUser.profile_photo_url ? (
              <img
                src={currentUser.profile_photo_url}
                alt={currentUser.full_name}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-2 ring-white shadow-sm">
                <span className="text-white font-semibold text-sm">{currentUser.full_name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="text-left leading-tight">
              <p className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">{currentUser.full_name}</p>
              <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{currentUser.role.display_name}</p>
            </div>
          </button>
        </div>

        {/* Mobile header */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
            <Menu className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src="/bms_f_logo.png" alt="BMS" className="h-6 w-auto max-w-[80px] object-contain" />
            <h1 className="text-sm font-bold text-slate-900 truncate font-display">BMS Admin</h1>
          </div>
          <button onClick={() => setActiveTab('profile')} className="shrink-0">
            {currentUser.profile_photo_url ? (
              <img
                src={currentUser.profile_photo_url}
                alt={currentUser.full_name}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-2 ring-white shadow-sm">
                <span className="text-white font-semibold text-xs">{currentUser.full_name.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </button>
        </div>

        {/* Stats Bar - shown on home tab or on larger screens */}
        {(activeTab === 'home') && (
          <AdminHomeOverview />
        )}

        {/* Page Content */}
        <div className="p-4 sm:p-6">

        {/* Detail Views - rendered inline instead of tab content */}
        {showTrackingPage && selectedMotorcycleForTracking ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowTrackingPage(false);
                  setSelectedMotorcycleForTracking(null);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium text-sm"
              >
                <span aria-hidden>&larr;</span> Back
              </button>
              <div className="text-right">
                <h1 className="text-lg font-bold text-slate-900">Live Tracking</h1>
                <p className="text-slate-500 text-xs">{selectedMotorcycleForTracking.registration_number}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[calc(100vh-140px)] lg:h-[calc(100vh-180px)]">
              <TrackingModal
                motorcycle={selectedMotorcycleForTracking}
                onClose={() => {
                  setShowTrackingPage(false);
                  setSelectedMotorcycleForTracking(null);
                }}
                fullPage={true}
              />
            </div>
          </div>
        ) : selectedOwner ? (
          <OwnerDetailsModal
            owner={selectedOwner}
            onBack={() => setSelectedOwner(null)}
            onViewMotorcycle={(motorcycle) => {
              setSelectedOwner(null);
              setSelectedMotorcycleForDetails(motorcycle);
            }}
            onViewRider={(rider) => {
              setSelectedOwner(null);
              setSelectedRiderForDetails(rider);
            }}
          />
        ) : selectedMotorcycleForDetails ? (
          <MotorcycleDetailsModal
            motorcycle={selectedMotorcycleForDetails}
            canEdit={canEditAll}
            onBack={() => setSelectedMotorcycleForDetails(null)}
            onViewOwner={(owner) => {
              setSelectedMotorcycleForDetails(null);
              setSelectedOwner(owner);
            }}
            onViewRider={(rider) => {
              setSelectedMotorcycleForDetails(null);
              setSelectedRiderForDetails(rider);
            }}
            onTrack={(motorcycle) => {
              setSelectedMotorcycleForTracking(motorcycle);
              setShowTrackingPage(true);
            }}
            onMotorcycleUpdated={(updated) => {
              setSelectedMotorcycleForDetails(updated);
              loadStats();
            }}
          />
        ) : selectedRiderForDetails ? (
          <RiderDetailsModal
            rider={selectedRiderForDetails}
            onBack={() => setSelectedRiderForDetails(null)}
            onViewMotorcycle={(motorcycle) => {
              setSelectedRiderForDetails(null);
              setSelectedMotorcycleForDetails(motorcycle);
            }}
            onViewOwner={(owner) => {
              setSelectedRiderForDetails(null);
              setSelectedOwner(owner);
            }}
          />
        ) : (
        <>
        {activeTab === 'home' && null}

        {activeTab === 'profile' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6">My Profile</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative group">
                  {currentUser.profile_photo_url ? (
                    <img
                      key={photoTick}
                      src={currentUser.profile_photo_url}
                      alt={currentUser.full_name}
                      className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-4 ring-white shadow">
                      <span className="text-white font-bold text-2xl">{currentUser.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center cursor-pointer hover:bg-slate-50 transition">
                    <Camera className="h-4 w-4 text-slate-700" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoUpload}
                      disabled={photoUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{currentUser.full_name}</p>
                  <p className="text-sm text-slate-500">@{currentUser.username}</p>
                  {photoUploading && <p className="text-xs text-slate-500 mt-1">Uploading photo...</p>}
                  {photoError && <p className="text-xs text-red-600 mt-1">{photoError}</p>}
                  {photoSuccess && <p className="text-xs text-emerald-600 mt-1">{photoSuccess}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Role</p>
                  <p className="text-sm font-semibold text-slate-900">{currentUser.role.display_name}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Username</p>
                  <p className="text-sm font-semibold text-slate-900">{currentUser.username}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Email</p>
                  <p className="text-sm font-semibold text-slate-900">{currentUser.email || 'Not set'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                    <CheckCircle className="h-4 w-4" /> Active
                  </span>
                </div>
              </div>
            </div>

            {/* Password Change */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Lock className="h-5 w-5 text-slate-600" />
                Change Password
              </h3>
              <p className="text-sm text-slate-500 mb-5">Update your account password. You will need to enter your current password for verification.</p>

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => { setPasswordForm({ ...passwordForm, current: e.target.value }); setPasswordError(''); setPasswordSuccess(''); }}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPass}
                    onChange={(e) => { setPasswordForm({ ...passwordForm, newPass: e.target.value }); setPasswordError(''); setPasswordSuccess(''); }}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Enter new password (min 8 characters)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => { setPasswordForm({ ...passwordForm, confirm: e.target.value }); setPasswordError(''); setPasswordSuccess(''); }}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Re-enter new password"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !passwordForm.current || !passwordForm.newPass || !passwordForm.confirm}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {changingPassword ? 'Changing Password...' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'owners' && (
          <div className="space-y-4">
            <SubTabs
              active={ownersView}
              onChange={setOwnersView}
              tabs={[
                { id: 'insights', label: 'Insights' },
                { id: 'directory', label: `Directory (${stats.totalOwners})` },
              ]}
            />
            {ownersView === 'insights' ? (
              <OwnersRidersInsights variant="owners" />
            ) : (
          <SearchableList
            icon="owners"
            title="Owners"
            stateKey="admin.directory.owners"
            totalCount={stats.totalOwners}
            placeholder="Search by name, phone number, or national ID..."
            onSearch={searchOwners}
            onLoadPage={loadOwnersPage}
            nameLabel="Name"
            stats={[
              { label: 'Total Owners', value: stats.totalOwners, color: 'text-slate-900' },
              { label: 'Verified', value: stats.verifiedRecords, color: 'text-emerald-600' },
              { label: 'Pending', value: stats.pendingVerifications, color: 'text-amber-600' },
              { label: 'Revenue', value: `KES ${stats.totalRevenue.toLocaleString()}`, color: 'text-blue-600' },
            ]}
            renderResults={(results: Owner[]) => (
              <div>
                <div className="hidden lg:grid grid-cols-[44px_1fr_76px] gap-4 items-center px-4 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 rounded-t-lg">
                  <span />
                  <div className="grid grid-cols-4 gap-x-4 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    <span>Owner</span>
                    <span>National ID</span>
                    <span>Next of Kin</span>
                    <span>Registered</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-right">Action</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {results.map((owner) => {
                    const initials = (owner.full_name || '?')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase();
                    return (
                      <li
                        key={owner.id}
                        className="group grid grid-cols-[44px_1fr_76px] gap-4 items-center px-4 sm:px-5 py-3.5 hover:bg-emerald-50/40 transition-colors"
                      >
                        {owner.profile_photo_url ? (
                          <img
                            src={owner.profile_photo_url}
                            alt={owner.full_name}
                            className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200 shadow-sm"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center font-semibold text-sm shadow-sm">
                            {initials || '?'}
                          </div>
                        )}
                        <div className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-0.5 items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{owner.full_name || 'Unnamed'}</p>
                            <p className="text-xs text-slate-500 truncate">{owner.phone_number || 'No phone'}</p>
                          </div>
                          <p className="text-sm font-mono text-slate-700 truncate hidden sm:block">
                            {owner.national_id || '—'}
                          </p>
                          <div className="min-w-0 hidden lg:block">
                            <p className="text-sm text-slate-700 truncate">{owner.next_of_kin_name || '—'}</p>
                            {owner.next_of_kin_phone && (
                              <p className="text-xs text-slate-500 truncate">{owner.next_of_kin_phone}</p>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 hidden lg:block">
                            {new Date(owner.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedOwner(owner)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors justify-self-end"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          />
            )}
          </div>
        )}

        {activeTab === 'motorcycles' && (
          <div className="space-y-4">
            <SubTabs
              active={motorcyclesView}
              onChange={setMotorcyclesView}
              tabs={[
                { id: 'insights', label: 'Insights' },
                { id: 'directory', label: `Directory (${stats.totalMotorcycles})` },
              ]}
            />
            {motorcyclesView === 'insights' ? (
              <MotorcyclesInsights />
            ) : (
          <SearchableList
            icon="motorcycles"
            title="Motorcycles"
            stateKey="admin.directory.motorcycles"
            totalCount={stats.totalMotorcycles}
            placeholder="Search by registration number, make, model, or serial number..."
            onSearch={searchMotorcycles}
            onLoadPage={loadMotorcyclesPage}
            nameLabel="Reg #"
            stats={[
              { label: 'Total Bikes', value: stats.totalMotorcycles, color: 'text-slate-900' },
              { label: 'Verified', value: stats.verifiedRecords, color: 'text-emerald-600' },
              { label: 'Pending', value: stats.pendingVerifications, color: 'text-amber-600' },
              { label: 'Total Riders', value: stats.totalRiders, color: 'text-blue-600' },
            ]}
            renderResults={(results: any[]) => (
              <div>
                <div className="hidden lg:grid grid-cols-[44px_1fr_76px] gap-4 items-center px-4 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 rounded-t-lg">
                  <span />
                  <div className="grid grid-cols-4 gap-x-4 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    <span>Motorcycle</span>
                    <span>Owner</span>
                    <span>Rider</span>
                    <span>Status</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-right">Action</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {results.map((motorcycle: any) => {
                    const assignedRider = Array.isArray(motorcycle.rider)
                      ? motorcycle.rider.find?.((r: any) => r.assignment_status === 'Assigned')
                      : motorcycle.rider;
                    const isVerified = motorcycle.status === 'verified';
                    return (
                      <li
                        key={motorcycle.id}
                        className="group grid grid-cols-[44px_1fr_76px] gap-4 items-center px-4 sm:px-5 py-3.5 hover:bg-emerald-50/40 transition-colors"
                      >
                        <div className="relative">
                          {motorcycle.bike_photo_url ? (
                            <img
                              src={motorcycle.bike_photo_url}
                              alt={motorcycle.registration_number}
                              className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200 shadow-sm"
                            />
                          ) : (
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center shadow-sm">
                              <Bike className="h-5 w-5" />
                            </div>
                          )}
                          {motorcycle.pending_incident_count > 0 && (
                            <span
                              title={`${motorcycle.pending_incident_count} pending incident${motorcycle.pending_incident_count === 1 ? '' : 's'}`}
                              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-sm"
                            >
                              {motorcycle.pending_incident_count > 99 ? '99+' : motorcycle.pending_incident_count}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-0.5 items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 tracking-wide truncate">{motorcycle.registration_number}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {motorcycle.make || motorcycle.model
                                ? `${motorcycle.make || ''} ${motorcycle.model || ''}`.trim()
                                : 'Make / model not set'}
                            </p>
                          </div>
                          <div className="min-w-0 hidden sm:block">
                            <p className="text-sm text-slate-700 truncate">{motorcycle.owner?.full_name || 'Unknown'}</p>
                            {motorcycle.owner?.phone_number && (
                              <p className="text-xs text-slate-500 truncate">{motorcycle.owner.phone_number}</p>
                            )}
                          </div>
                          <div className="min-w-0 hidden lg:block">
                            {assignedRider ? (
                              <>
                                <p className="text-sm text-slate-700 truncate">{assignedRider.name}</p>
                                <p className="text-xs text-slate-500 truncate font-mono">{assignedRider.id_number}</p>
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                                Not assigned
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 hidden lg:block">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                isVerified
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              {isVerified ? 'Verified' : 'Pending'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedMotorcycleForDetails(motorcycle)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors justify-self-end"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          />
            )}
          </div>
        )}

        {activeTab === 'riders' && (
          <div className="space-y-4">
            <SubTabs
              active={ridersView}
              onChange={setRidersView}
              tabs={[
                { id: 'insights', label: 'Insights' },
                { id: 'directory', label: `Directory (${stats.totalRiders})` },
              ]}
            />
            {ridersView === 'insights' ? (
              <OwnersRidersInsights variant="riders" />
            ) : (
          <SearchableList
            icon="riders"
            title="Riders"
            stateKey="admin.directory.riders"
            totalCount={stats.totalRiders}
            placeholder="Search by name, ID number, phone, BMS ID, or SACCO..."
            onSearch={searchRiders}
            onLoadPage={loadRidersPage}
            nameLabel="Name"
            stats={[
              { label: 'Total Riders', value: stats.totalRiders, color: 'text-slate-900' },
              { label: 'Motorcycles', value: stats.totalMotorcycles, color: 'text-emerald-600' },
              { label: 'Owners', value: stats.totalOwners, color: 'text-blue-600' },
            ]}
            renderResults={(results: any[]) => (
              <div>
                <div className="hidden lg:grid grid-cols-[44px_1fr_76px] gap-4 items-center px-4 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 rounded-t-lg">
                  <span />
                  <div className="grid grid-cols-4 gap-x-4 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    <span>Rider</span>
                    <span>ID Number</span>
                    <span>Motorcycle</span>
                    <span>Status</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-right">Action</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {results.map((rider: any) => {
                    const initials = (rider.name || '?')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w: string) => w[0])
                      .join('')
                      .toUpperCase();
                    const isAssigned = rider.assignment_status === 'Assigned';
                    return (
                      <li
                        key={rider.id}
                        className="group grid grid-cols-[44px_1fr_76px] gap-4 items-center px-4 sm:px-5 py-3.5 hover:bg-emerald-50/40 transition-colors"
                      >
                        <div className="relative">
                          {rider.photo_url ? (
                            <img
                              src={rider.photo_url}
                              alt={rider.name}
                              className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200 shadow-sm"
                            />
                          ) : (
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-semibold text-sm shadow-sm">
                              {initials || '?'}
                            </div>
                          )}
                          {rider.pending_incident_count > 0 && (
                            <span
                              title={`${rider.pending_incident_count} pending incident${rider.pending_incident_count === 1 ? '' : 's'}`}
                              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-sm"
                            >
                              {rider.pending_incident_count > 99 ? '99+' : rider.pending_incident_count}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-0.5 items-center">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{rider.name || 'Unnamed'}</p>
                              <RiderRatingChip score={rider.rating_score} tier={rider.rating_tier} className="shrink-0" />
                            </div>
                            <p className="text-xs text-slate-500 truncate">{rider.phone_number || 'No phone'}</p>
                            {rider.bms_id && (
                              <p className="text-[11px] text-blue-600 font-mono truncate">{rider.bms_id}</p>
                            )}
                          </div>
                          <p className="text-sm font-mono text-slate-700 truncate hidden sm:block">
                            {rider.id_number || '—'}
                          </p>
                          <div className="min-w-0 hidden lg:block">
                            {rider.motorcycle ? (
                              <>
                                <p className="text-sm text-slate-700 truncate">{rider.motorcycle.registration_number}</p>
                                {(rider.motorcycle.make || rider.motorcycle.model) && (
                                  <p className="text-xs text-slate-500 truncate">
                                    {`${rider.motorcycle.make || ''} ${rider.motorcycle.model || ''}`.trim()}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                                Not assigned
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 hidden lg:flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                isAssigned
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${isAssigned ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {rider.assignment_status || 'Unassigned'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedRiderForDetails(rider)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors justify-self-end"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          />
            )}
          </div>
        )}

        {activeTab === 'incidents' && !selectedIncident && (
          <IncidentsPanel
            onViewIncident={(incident) => setSelectedIncident(incident)}
            searchIncidents={searchIncidents}
          />
        )}

        {activeTab === 'incidents' && selectedIncident && (
          <IncidentDetailsPage
            incident={selectedIncident}
            onBack={() => {
              setSelectedIncident(null);
              if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
            }}
            onUpdate={() => {
              loadStats();
            }}
          />
        )}

        {activeTab === 'users' && canManageUsers && (
          <AdminSettings currentUsername={currentUser.username} currentUser={currentUser} onDataChanged={loadStats} />
        )}

        {activeTab === 'groups' && canManageUsers && (
          <AdminSettings currentUsername={currentUser.username} currentUser={currentUser} onDataChanged={loadStats} />
        )}

        {activeTab === 'revenue' && (
          <RevenueView />
        )}

        {activeTab === 'fines' && (canManagePolice || canManageUsers) && (
          <FinesManagement />
        )}

        {activeTab === 'audit' && canViewAuditLogs && (
          <AuditLog />
        )}

        {activeTab === 'police' && (canManagePolice || canManageUsers) && (
          <PoliceStationManagement currentUser={currentUser} />
        )}

        {activeTab === 'police-officers' && (canManagePolice || canManageUsers) && (
          <PoliceOfficerManagement currentUser={currentUser} />
        )}

        {activeTab === 'settings' && canManageUsers && (
          <AdminSettings currentUsername={currentUser.username} currentUser={currentUser} onDataChanged={loadStats} />
        )}
        </>
        )}
        </div>
      </main>

      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-2xl font-bold text-slate-900">Full Registration Details</h3>
              <button
                onClick={() => {
                  setSelectedRecord(null);
                  setFullDetails(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading full details...</p>
              </div>
            ) : fullDetails ? (
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-emerald-600" />
                    Owner Information
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Full Name</p>
                        <p className="font-semibold">{fullDetails.owner.full_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Phone Number</p>
                        <p className="font-semibold">{fullDetails.owner.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">National ID</p>
                        <p className="font-semibold">{fullDetails.owner.national_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">OTP Verified</p>
                        <p className="font-semibold">
                          {fullDetails.owner.otp_verified ? (
                            <span className="text-emerald-600">Yes</span>
                          ) : (
                            <span className="text-red-600">No</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Next of Kin</p>
                        <p className="font-semibold">{fullDetails.owner.next_of_kin_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Next of Kin Phone</p>
                        <p className="font-semibold">{fullDetails.owner.next_of_kin_phone}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center">
                    <Bike className="h-5 w-5 mr-2 text-emerald-600" />
                    Motorcycle Information
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Registration Number</p>
                        <p className="font-semibold">{fullDetails.motorcycle.registration_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Serial Number</p>
                        <p className="font-semibold">{fullDetails.motorcycle.tracking_device_id || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Insurance Policy Number</p>
                        {(fullDetails.motorcycle as any).insurance_policy_number ? (
                          <p className="font-semibold">{(fullDetails.motorcycle as any).insurance_policy_number}</p>
                        ) : (
                          <p className="font-semibold text-red-600">Missing Valid Insurance</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Insurance Expiry Date</p>
                        {(fullDetails.motorcycle as any).insurance_expiry_date ? (
                          <p className="font-semibold">{new Date((fullDetails.motorcycle as any).insurance_expiry_date).toLocaleDateString()}</p>
                        ) : (
                          <p className="font-semibold text-slate-400">N/A</p>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-3 mt-3">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Uploaded Documents</p>
                      <div className="space-y-3">
                        {fullDetails.motorcycle.logbook_url ? (
                          <div className="flex flex-col gap-1.5">
                            <DocumentLink fileUrl={fullDetails.motorcycle.logbook_url} label="View Logbook" userType="owner" userId={fullDetails.motorcycle.owner_id} documentType="logbook" />
                            <DocumentRevalidateButton
                              userType="owner" userId={fullDetails.motorcycle.owner_id}
                              documentType="logbook"
                              fileUrl={fullDetails.motorcycle.logbook_url} fileName="logbook"
                              expectedName={fullDetails.owner?.full_name} expectedIdNumber={fullDetails.owner?.national_id}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No logbook uploaded</p>
                        )}
                        {fullDetails.motorcycle.kra_pin_url ? (
                          <div className="flex flex-col gap-1.5">
                            <DocumentLink fileUrl={fullDetails.motorcycle.kra_pin_url} label="View KRA PIN Certificate" userType="owner" userId={fullDetails.motorcycle.owner_id} documentType="kra_pin_doc" />
                            <DocumentRevalidateButton
                              userType="owner" userId={fullDetails.motorcycle.owner_id}
                              documentType="kra_pin_doc"
                              fileUrl={fullDetails.motorcycle.kra_pin_url} fileName="kra_pin_doc"
                              expectedName={fullDetails.owner?.full_name} expectedIdNumber={fullDetails.owner?.national_id}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No KRA PIN uploaded</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-slate-900 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-emerald-600" />
                      Rider Information
                    </h4>
                    <button
                      onClick={handleAddEditRider}
                      className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                    >
                      {fullDetails.rider ? 'Edit Rider' : 'Add Rider'}
                    </button>
                  </div>
                  {fullDetails.rider ? (
                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">Rider Name</p>
                          <p className="font-semibold">{fullDetails.rider.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">ID Number</p>
                          <p className="font-semibold">{fullDetails.rider.id_number}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">County Registration Number</p>
                          <p className="font-semibold">{fullDetails.rider.county_registration_number || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Sacco ID</p>
                          <p className="font-semibold">{fullDetails.rider.sacco_id || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Stage Name</p>
                          <p className="font-semibold">{fullDetails.rider.stage_name || 'N/A'}</p>
                        </div>
                      </div>

                      {fullDetails.rider.photo_url && (
                        <div className="border-t border-slate-200 pt-3 mt-3">
                          <p className="text-sm font-semibold text-slate-700 mb-2">Rider Photo</p>
                          <img
                            src={fullDetails.rider.photo_url}
                            alt="Rider"
                            className="w-40 h-40 object-cover rounded-lg border-2 border-slate-200"
                          />
                        </div>
                      )}

                      <div className="border-t border-slate-200 pt-3 mt-3">
                        <p className="text-sm font-semibold text-slate-700 mb-2">Uploaded Documents</p>
                        <div className="space-y-3">
                          {fullDetails.rider.license_url ? (
                            <div className="flex flex-col gap-1.5">
                              <DocumentLink fileUrl={fullDetails.rider.license_url} label="View Driving License" userType="rider" userId={fullDetails.rider.id} documentType="driving_license" />
                              <DocumentRevalidateButton
                                userType="rider" userId={fullDetails.rider.id}
                                documentType="driving_license"
                                fileUrl={fullDetails.rider.license_url} fileName="license"
                                expectedName={fullDetails.rider.name} expectedIdNumber={fullDetails.rider.id_number}
                                knownExpiryDate={fullDetails.rider.license_expiry ?? null}
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">No license uploaded</p>
                          )}
                          {fullDetails.rider.good_conduct_url ? (
                            <div className="flex flex-col gap-1.5">
                              <DocumentLink fileUrl={fullDetails.rider.good_conduct_url} label="View Good Conduct Certificate" userType="rider" userId={fullDetails.rider.id} documentType="good_conduct" />
                              <DocumentRevalidateButton
                                userType="rider" userId={fullDetails.rider.id}
                                documentType="good_conduct"
                                fileUrl={fullDetails.rider.good_conduct_url} fileName="good_conduct"
                                expectedName={fullDetails.rider.name} expectedIdNumber={fullDetails.rider.id_number}
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">No good conduct certificate uploaded</p>
                          )}
                          {(fullDetails.rider as any).id_copy_url ? (
                            <div className="flex flex-col gap-1.5">
                              <DocumentLink fileUrl={(fullDetails.rider as any).id_copy_url} label="View ID Copy" userType="rider" userId={fullDetails.rider.id} documentType="national_id" />
                              <DocumentRevalidateButton
                                userType="rider" userId={fullDetails.rider.id}
                                documentType="national_id"
                                fileUrl={(fullDetails.rider as any).id_copy_url} fileName="id_copy"
                                expectedName={fullDetails.rider.name} expectedIdNumber={fullDetails.rider.id_number}
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">No ID copy uploaded</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                      <p className="text-amber-800">No rider assigned to this registration</p>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-3">Rider Assignment History</h4>
                  <div className="bg-slate-50 rounded-lg p-4">
                    {riderHistory.length > 0 ? (
                      <div className="space-y-3">
                        {riderHistory.map((history) => (
                          <div
                            key={history.id}
                            className={`bg-white rounded-lg p-3 border ${
                              history.removed_at ? 'border-slate-200' : 'border-blue-300'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-semibold text-slate-900">{history.rider_name}</p>
                                <p className="text-sm text-slate-600">ID: {history.rider_id_number}</p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  history.removed_at
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {history.removed_at ? 'Past' : 'Current'}
                              </span>
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="flex items-center text-slate-600">
                                <span className="font-semibold mr-2">Assigned:</span>
                                <span>{new Date(history.assigned_at).toLocaleString()}</span>
                              </div>
                              {history.removed_at && (
                                <>
                                  <div className="flex items-center text-slate-600">
                                    <span className="font-semibold mr-2">Removed:</span>
                                    <span>{new Date(history.removed_at).toLocaleString()}</span>
                                  </div>
                                  {history.removal_reason && (
                                    <div className="flex items-center text-slate-600">
                                      <span className="font-semibold mr-2">Reason:</span>
                                      <span>{history.removal_reason}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No rider history available for this motorcycle</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-3">Verification Status</h4>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-600">Current Status:</span>
                      {getStatusBadge(fullDetails.verification.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">QR Code ID</p>
                        <p className="font-mono text-xs bg-white px-2 py-1 rounded border border-slate-200 mt-1">
                          {fullDetails.verification.qr_code_data}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Registration Date</p>
                        <p className="font-semibold">{new Date(fullDetails.verification.created_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Last Updated</p>
                        <p className="font-semibold">{new Date(fullDetails.verification.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-emerald-600" />
                    Payment Information
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Last Payment</p>
                        <p className="font-semibold">
                          {fullDetails.lastPayment
                            ? `KES ${Number(fullDetails.lastPayment.amount).toFixed(2)} (${fullDetails.lastPayment.payment_year})`
                            : 'No payment record'}
                        </p>
                      </div>
                      <div>
                        {(() => {
                          const currentYear = new Date().getFullYear();
                          const lastYear = fullDetails.lastPayment?.payment_year;
                          const isDue = !lastYear || lastYear < currentYear;
                          return (
                            <>
                              <p className="text-slate-600">{isDue ? 'Payment Status' : 'Next Payment Due'}</p>
                              {isDue ? (
                                <span className="inline-flex items-center space-x-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold mt-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{currentYear} Fee Due</span>
                                </span>
                              ) : (
                                <p className="font-semibold text-emerald-600">{fullDetails.nextPaymentDue}</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      {fullDetails.lastPayment && (
                        <div>
                          <p className="text-slate-600">Payment Method</p>
                          <p className="font-semibold capitalize">{fullDetails.lastPayment.payment_method}</p>
                        </div>
                      )}
                      {fullDetails.lastPayment && (
                        <div>
                          <p className="text-slate-600">Transaction Ref</p>
                          <p className="font-mono text-xs bg-white px-2 py-1 rounded border border-slate-200 mt-1">
                            {fullDetails.lastPayment.transaction_reference}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  {fullDetails.verification.status !== 'Verified' && (
                    <button
                      onClick={() => updateVerificationStatus(selectedRecord.owner_id, 'Verified')}
                      className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition flex items-center justify-center"
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Approve
                    </button>
                  )}
                  {fullDetails.verification.status !== 'Rejected' && (
                    <button
                      onClick={() => updateVerificationStatus(selectedRecord.owner_id, 'Rejected')}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center"
                    >
                      <XCircle className="h-5 w-5 mr-2" />
                      Reject
                    </button>
                  )}
                  {fullDetails.verification.status !== 'Pending' && (
                    <button
                      onClick={() => updateVerificationStatus(selectedRecord.owner_id, 'Pending')}
                      className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition flex items-center justify-center"
                    >
                      <Clock className="h-5 w-5 mr-2" />
                      Mark Pending
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showRiderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">
                {fullDetails?.rider ? 'Edit Rider Information' : 'Add Rider Information'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Rider Name *
                  </label>
                  <input
                    type="text"
                    value={riderFormData.name}
                    onChange={(e) => setRiderFormData({ ...riderFormData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    ID Number *
                  </label>
                  <input
                    type="text"
                    value={riderFormData.idNumber}
                    onChange={(e) => setRiderFormData({ ...riderFormData, idNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="12345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    County Registration Number
                  </label>
                  <input
                    type="text"
                    value={riderFormData.countyRegistrationNumber}
                    onChange={(e) => setRiderFormData({ ...riderFormData, countyRegistrationNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="CR-2024-1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Sacco ID
                  </label>
                  <input
                    type="text"
                    value={riderFormData.saccoId}
                    onChange={(e) => setRiderFormData({ ...riderFormData, saccoId: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="SACCO-5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Stage Name
                  </label>
                  <input
                    type="text"
                    value={riderFormData.stageName}
                    onChange={(e) => setRiderFormData({ ...riderFormData, stageName: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="City Center Stage"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  onClick={() => setShowRiderForm(false)}
                  className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRider}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                >
                  Save Rider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function SubTabs<T extends string>({
  active,
  onChange,
  tabs,
}: {
  active: T;
  onChange: (id: T) => void;
  tabs: { id: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
