import { useState, useEffect } from 'react';
import { User, ArrowLeft, CheckCircle, XCircle, Clock, Phone, ExternalLink, CreditCard as Edit, Save, X, Upload, Eye, Download, AlertCircle, MessageSquare, MapPin, Image, Menu, LogOut, ChevronLeft } from 'lucide-react';
import {
  MotorcycleIcon,
  TrafficFineIcon,
  IncidentAlertIcon,
  DocumentValidatedIcon,
  PaymentCardIcon,
  BellAlertIcon,
  RevenueVaultIcon,
  CommandCenterIcon,
} from './icons/BrandIcons';
import PaymentModal from './PaymentModal';
import PaymentReceiptModal from './PaymentReceiptModal';
import FineReceiptModal, { type FineReceiptData } from './FineReceiptModal';
import { supabase, type Incident, type Payment, type IncidentNotification } from '../lib/supabase';
import { generateBMSId } from '../lib/bmsId';
import { generateBMSCardPDF } from '../lib/pdfGenerator';
import BMSCard from './BMSCard';
import Footer from './Footer';
import RiderProfileCompletion from './RiderProfileCompletion';
import RiderRatingCard from './RiderRatingBadge';
import DocumentLink from './DocumentLink';
import IncidentsPanel, { type IncidentPanelTab } from './incidents/IncidentsPanel';
import IncidentCaseModal from './incidents/IncidentCaseModal';

type RiderDashboardProps = {
  riderId: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
};

type AssignmentRequest = {
  id: string;
  motorcycle_id: string;
  owner_id: string;
  status: string;
  requested_at: string;
  responded_at: string | null;
  previous_motorcycle_id: string | null;
  motorcycle?: {
    registration_number: string;
    tracking_device_id: string | null;
    insurance_policy_number: string | null;
  };
  owner?: {
    full_name: string;
    phone_number: string;
  };
};

type Rider = {
  id: string;
  name: string;
  id_number: string;
  phone_number: string;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  county_registration_number: string | null;
  sacco_id: string | null;
  stage_name: string | null;
  photo_url: string | null;
  license_url: string | null;
  good_conduct_url: string | null;
  id_copy_url: string | null;
  assignment_status: string;
  motorcycle_id: string | null;
  owner_id: string | null;
  bms_id: string | null;
};

type Motorcycle = {
  registration_number: string;
};

type Owner = {
  full_name: string;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: any;
  created_at: string;
};

type WorkHistory = {
  id: string;
  motorcycle_registration: string;
  owner_name: string;
  owner_phone: string;
  assigned_at: string;
  removed_at: string | null;
  removal_reason: string | null;
};

export default function RiderDashboard({ riderId, onNavigate, onLogout }: RiderDashboardProps) {
  const [rider, setRider] = useState<Rider | null>(null);
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [requests, setRequests] = useState<AssignmentRequest[]>([]);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [nextPaymentDue, setNextPaymentDue] = useState<string>('N/A');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Rider>>({});
  const [saving, setSaving] = useState(false);
  const [showBikeChangeRequest, setShowBikeChangeRequest] = useState(false);
  const [newBikeRegNumber, setNewBikeRegNumber] = useState('');
  const [bikeChangeLoading, setBikeChangeLoading] = useState(false);
  const [showBMSCard, setShowBMSCard] = useState(false);
  const [generatingBMSId, setGeneratingBMSId] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeSection, setActiveSectionRaw] = useState<'home' | 'bike' | 'incidents' | 'fines' | 'profile'>(() => {
    const saved = localStorage.getItem('riderActiveSection');
    const valid = ['home','bike','incidents','fines','profile'];
    return (saved && valid.includes(saved) ? saved : 'home') as any;
  });
  const setActiveSection = (s: typeof activeSection) => {
    localStorage.setItem('riderActiveSection', s);
    setActiveSectionRaw(s);
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('rider.sidebar.collapsed') === 'true');
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('rider.sidebar.collapsed', String(next));
  };
  const [incidentNotifications, setIncidentNotifications] = useState<IncidentNotification[]>([]);
  const [availableMotorcycles, setAvailableMotorcycles] = useState<Array<{id: string; registration_number: string; owner_name: string}>>([]);
  const [searchingBikes, setSearchingBikes] = useState(false);
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidentModalTab, setIncidentModalTab] = useState<IncidentPanelTab>('overview');
  const [fines, setFines] = useState<any[]>([]);
  const [finesLoading, setFinesLoading] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [receiptFine, setReceiptFine] = useState<FineReceiptData | null>(null);
  const [payingFine, setPayingFine] = useState<any | null>(null);
  const [finePaymentStep, setFinePaymentStep] = useState<'method' | 'details' | 'processing' | 'success' | 'failed'>('method');
  const [finePaymentMethod, setFinePaymentMethod] = useState<'mpesa' | 'salamapay' | ''>('');
  const [finePaymentPhone, setFinePaymentPhone] = useState('');
  const [finePaymentError, setFinePaymentError] = useState('');

  useEffect(() => {
    loadRiderData();
    loadFines();
  }, [riderId]);

  useEffect(() => {
    if (activeSection === 'fines') loadFines();
  }, [activeSection]);

  const loadRiderData = async () => {
    setLoading(true);
    try {
      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('id', riderId)
        .maybeSingle();

      if (riderError) throw riderError;

      if (riderData) {
        setRider(riderData);

        if (riderData.motorcycle_id) {
          const { data: motorcycleData } = await supabase
            .from('motorcycles')
            .select('registration_number')
            .eq('id', riderData.motorcycle_id)
            .maybeSingle();

          setMotorcycle(motorcycleData);
        } else {
          setMotorcycle(null);
        }

        if (riderData.owner_id) {
          const { data: ownerData } = await supabase
            .from('owners')
            .select('full_name')
            .eq('id', riderData.owner_id)
            .maybeSingle();

          setOwner(ownerData);
        } else {
          setOwner(null);
        }
      }

      const { data: requestsData, error: requestsError } = await supabase
        .from('assignment_requests')
        .select('*')
        .eq('rider_id', riderId)
        .order('requested_at', { ascending: false });

      if (requestsError) throw requestsError;

      if (requestsData && requestsData.length > 0) {
        const motorcycleIds = requestsData.map((r) => r.motorcycle_id);
        const ownerIds = requestsData.map((r) => r.owner_id);

        const { data: motorcyclesData } = await supabase
          .from('motorcycles')
          .select('*')
          .in('id', motorcycleIds);

        const { data: ownersData } = await supabase
          .from('owners')
          .select('*')
          .in('id', ownerIds);

        const enrichedRequests = requestsData.map((request) => ({
          ...request,
          motorcycle: motorcyclesData?.find((m) => m.id === request.motorcycle_id),
          owner: ownersData?.find((o) => o.id === request.owner_id),
        }));

        setRequests(enrichedRequests);
      } else {
        setRequests([]);
      }

      const { data: notificationsData, error: notificationsError } = await supabase
        .from('rider_notifications')
        .select('*')
        .eq('rider_id', riderId)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      if (notificationsData) {
        setNotifications(notificationsData);
      } else {
        setNotifications([]);
      }

      const { data: historyData, error: historyError } = await supabase
        .from('rider_history')
        .select(`
          id,
          assigned_at,
          removed_at,
          removal_reason,
          motorcycles!rider_history_motorcycle_id_fkey(registration_number),
          owners!rider_history_owner_id_fkey(full_name, phone_number)
        `)
        .eq('rider_id', riderId)
        .order('assigned_at', { ascending: false });

      if (historyError) {
        console.error('Error loading work history:', historyError);
        setWorkHistory([]);
      } else if (historyData) {
        const formattedHistory = historyData.map((entry: any) => ({
          id: entry.id,
          motorcycle_registration: entry.motorcycles?.registration_number || 'Unknown',
          owner_name: entry.owners?.full_name || 'Unknown',
          owner_phone: entry.owners?.phone_number || 'N/A',
          assigned_at: entry.assigned_at,
          removed_at: entry.removed_at,
          removal_reason: entry.removal_reason,
        }));
        setWorkHistory(formattedHistory);
      } else {
        setWorkHistory([]);
      }

      const { data: incidentsData, error: incidentsError } = await supabase
        .from('incidents')
        .select('*')
        .eq('rider_id', riderId)
        .order('incident_date', { ascending: false });

      if (incidentsError) {
        console.error('Error loading incidents:', incidentsError);
        setIncidents([]);
      } else {
        setIncidents(incidentsData || []);
      }

      const { data: incidentNotifsData } = await supabase
        .from('incident_notifications')
        .select('*')
        .eq('user_type', 'rider')
        .eq('user_id', riderId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      setIncidentNotifications(incidentNotifsData || []);

      if (riderData) {
        const { data: paymentData } = await supabase
          .from('payments')
          .select('*')
          .eq('user_type', 'rider')
          .eq('user_id', riderId)
          .eq('payment_status', 'completed')
          .order('payment_year', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (paymentData) {
          setLastPayment(paymentData);
          const lastPaymentYear = paymentData.payment_year;
          const nextYear = lastPaymentYear + 1;
          setNextPaymentDue(`January 1, ${nextYear}`);
        } else if (riderData) {
          const registrationYear = new Date(riderData.created_at).getFullYear();
          setNextPaymentDue(`January 1, ${registrationYear + 1}`);
        }
      }
    } catch (error) {
      console.error('Error loading rider data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFines = async () => {
    setFinesLoading(true);
    const finesSelect = `
      id, fine_reference, fine_amount, status, issued_at, paid_at, due_date,
      payment_reference, rider_name, rider_phone, rider_national_id,
      location_description, notes,
      offence:traffic_offences(offence_name, offence_code, category),
      officer:police_officers!fines_issued_by_officer_id_fkey(full_name, rank, badge_number),
      station:police_stations!fines_station_id_fkey(station_name)
    `;
    const { data: byId } = await supabase
      .from('fines')
      .select(finesSelect)
      .eq('rider_id', riderId)
      .order('issued_at', { ascending: false });

    let allFines = byId || [];

    if (rider?.phone_number) {
      const normalized = rider.phone_number.replace(/\s+/g, '');
      const { data: byPhone } = await supabase
        .from('fines')
        .select(finesSelect)
        .is('rider_id', null)
        .eq('rider_phone', normalized)
        .order('issued_at', { ascending: false });
      if (byPhone) {
        const existingIds = new Set(allFines.map(f => f.id));
        allFines = [...allFines, ...byPhone.filter(f => !existingIds.has(f.id))];
      }
    }

    setFines(allFines);
    setFinesLoading(false);
  };

  const handleFinePayment = async () => {
    if (!payingFine || !finePaymentMethod) return;
    if (!finePaymentPhone || !/^(?:\+254|0)[17]\d{8}$/.test(finePaymentPhone)) {
      setFinePaymentError('Enter a valid Kenyan phone number');
      return;
    }
    setFinePaymentError('');
    setFinePaymentStep('processing');

    const normalized = finePaymentPhone.startsWith('0') ? '+254' + finePaymentPhone.substring(1) : finePaymentPhone;
    const txnRef = `FN-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    setTimeout(async () => {
      const success = Math.random() > 0.05;
      if (success) {
        await supabase
          .from('fines')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_reference: txnRef,
          })
          .eq('id', payingFine.id);

        setFinePaymentStep('success');
        setTimeout(() => {
          setPayingFine(null);
          setFinePaymentStep('method');
          setFinePaymentMethod('');
          setFinePaymentPhone('');
          loadFines();
        }, 2000);
      } else {
        setFinePaymentStep('failed');
      }
    }, 3000);
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('rider_notifications')
        .update({ read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleEditClick = () => {
    if (rider) {
      setEditForm({
        phone_number: rider.phone_number,
        sacco_id: rider.sacco_id,
        stage_name: rider.stage_name,
        next_of_kin_name: rider.next_of_kin_name,
        next_of_kin_phone: rider.next_of_kin_phone,
      });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('riders')
        .update({
          phone_number: editForm.phone_number,
          next_of_kin_name: editForm.next_of_kin_name,
          next_of_kin_phone: editForm.next_of_kin_phone,
          sacco_id: editForm.sacco_id,
          stage_name: editForm.stage_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', riderId);

      if (error) throw error;

      alert('Profile updated successfully!');
      setIsEditing(false);
      await loadRiderData();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async (documentType: 'license' | 'good_conduct' | 'id_copy' | 'photo', file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${riderId}_${documentType}_${Date.now()}.${fileExt}`;
      const filePath = `riders/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const columnName = documentType === 'license' ? 'license_url' :
                        documentType === 'good_conduct' ? 'good_conduct_url' :
                        documentType === 'id_copy' ? 'id_copy_url' : 'photo_url';

      const { error: updateError } = await supabase
        .from('riders')
        .update({
          [columnName]: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', riderId);

      if (updateError) throw updateError;

      alert('Document uploaded successfully!');
      await loadRiderData();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    }
  };

  const handleGenerateBMSId = async () => {
    if (!rider) return;

    setGeneratingBMSId(true);
    try {
      const { count } = await supabase
        .from('riders')
        .select('*', { count: 'exact', head: true });

      const bmsId = generateBMSId(count || 0);

      const { error } = await supabase
        .from('riders')
        .update({
          bms_id: bmsId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', riderId);

      if (error) throw error;

      await loadRiderData();
      alert('BMS ID generated successfully!');
    } catch (error) {
      console.error('Error generating BMS ID:', error);
      alert('Failed to generate BMS ID. Please try again.');
    } finally {
      setGeneratingBMSId(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!rider?.bms_id) {
      alert('Please generate a BMS ID first.');
      return;
    }

    const wasCardVisible = showBMSCard;

    if (!showBMSCard) {
      setShowBMSCard(true);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      await generateBMSCardPDF(rider.bms_id);

      if (!wasCardVisible) {
        setShowBMSCard(false);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');

      if (!wasCardVisible) {
        setShowBMSCard(false);
      }
    }
  };

  const searchMotorcycles = async (query: string) => {
    if (query.length < 2) {
      setAvailableMotorcycles([]);
      return;
    }

    setSearchingBikes(true);
    try {
      const { data: motorcycles, error } = await supabase
        .from('motorcycles')
        .select('id, registration_number, owner_id')
        .ilike('registration_number', `%${query}%`)
        .limit(10);

      if (error) throw error;

      if (motorcycles && motorcycles.length > 0) {
        const ownerIds = motorcycles.map((m) => m.owner_id);
        const { data: owners } = await supabase
          .from('owners')
          .select('id, full_name')
          .in('id', ownerIds);

        const enrichedMotorcycles = motorcycles.map((m) => ({
          id: m.id,
          registration_number: m.registration_number,
          owner_name: owners?.find((o) => o.id === m.owner_id)?.full_name || 'Unknown',
        }));

        setAvailableMotorcycles(enrichedMotorcycles);
      } else {
        setAvailableMotorcycles([]);
      }
    } catch (error) {
      console.error('Error searching motorcycles:', error);
      setAvailableMotorcycles([]);
    } finally {
      setSearchingBikes(false);
    }
  };

  const handleRequestBikeChange = async () => {
    if (!newBikeRegNumber.trim()) {
      alert('Please enter a motorcycle registration number');
      return;
    }

    setBikeChangeLoading(true);
    try {
      const { data: motorcycle, error: bikeError } = await supabase
        .from('motorcycles')
        .select('id, owner_id, registration_number')
        .eq('registration_number', newBikeRegNumber.trim())
        .maybeSingle();

      if (bikeError) throw bikeError;

      if (!motorcycle) {
        alert('Motorcycle not found. Please check the registration number.');
        setBikeChangeLoading(false);
        return;
      }

      const { data: existingRequest, error: checkError } = await supabase
        .from('assignment_requests')
        .select('id, status')
        .eq('rider_id', riderId)
        .eq('motorcycle_id', motorcycle.id)
        .eq('status', 'Pending')
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (existingRequest) {
        alert('You already have a pending request for this motorcycle.');
        setBikeChangeLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('assignment_requests')
        .insert({
          rider_id: riderId,
          motorcycle_id: motorcycle.id,
          owner_id: motorcycle.owner_id,
          previous_motorcycle_id: rider?.motorcycle_id || null,
          status: 'Pending',
          requested_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      alert(`Bike change request sent successfully! Waiting for ${motorcycle.registration_number} owner approval.`);
      setShowBikeChangeRequest(false);
      setNewBikeRegNumber('');
      await loadRiderData();
    } catch (error) {
      console.error('Error requesting bike change:', error);
      alert('Failed to send bike change request. Please try again.');
    } finally {
      setBikeChangeLoading(false);
    }
  };

  const handleRequestResponse = async (requestId: string, status: 'Approved' | 'Rejected') => {
    try {
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;

      if (status === 'Approved') {
        if (rider?.assignment_status === 'Assigned' && rider?.motorcycle_id && !request.previous_motorcycle_id) {
          alert('You already have an active assignment. Your current assignment must be terminated before accepting a new one. Please contact your current motorcycle owner to remove you, or request a bike change instead.');
          return;
        }
      }

      const { error: requestError } = await supabase
        .from('assignment_requests')
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      if (status === 'Approved') {
        if (request.previous_motorcycle_id) {
          const { error: historyError } = await supabase
            .from('rider_history')
            .update({
              removed_at: new Date().toISOString(),
              removal_reason: 'Rider requested bike change',
              updated_at: new Date().toISOString(),
            })
            .eq('motorcycle_id', request.previous_motorcycle_id)
            .eq('rider_id', riderId)
            .is('removed_at', null);

          if (historyError) throw historyError;
        }

        const { error: riderError } = await supabase
          .from('riders')
          .update({
            motorcycle_id: request.motorcycle_id,
            owner_id: request.owner_id,
            assignment_status: 'Assigned',
            updated_at: new Date().toISOString(),
          })
          .eq('id', riderId);

        if (riderError) throw riderError;

        const { error: historyError } = await supabase
          .from('rider_history')
          .insert({
            motorcycle_id: request.motorcycle_id,
            rider_id: riderId,
            owner_id: request.owner_id,
            rider_name: rider?.name || '',
            rider_id_number: rider?.id_number || '',
            assigned_at: new Date().toISOString(),
          });

        if (historyError) throw historyError;

        alert('Assignment approved! You are now assigned to this motorcycle.');
      } else {
        alert('Assignment request rejected.');
      }

      await loadRiderData();
    } catch (error) {
      console.error('Error responding to request:', error);
      alert('Failed to respond to request. Please try again.');
    }
  };

  const markIncidentNotificationAsRead = async (incidentId: string) => {
    try {
      const notificationToMark = incidentNotifications.find(n => n.incident_id === incidentId);
      if (notificationToMark) {
        await supabase
          .from('incident_notifications')
          .update({ is_read: true })
          .eq('id', notificationToMark.id);

        setIncidentNotifications(prev => prev.filter(n => n.id !== notificationToMark.id));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="flex items-center space-x-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold">
            <CheckCircle className="h-4 w-4" />
            <span>Approved</span>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-50 transform transition-all duration-200 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-4 border-b border-slate-200 shrink-0 justify-between">
          <div className="flex items-center min-w-0">
            <img src="/government-of-kenya-emblem-gok-logo-png_seeklogo-318197 (1).png" alt="Government of Kenya" className="h-10 w-10 object-contain mr-2 flex-shrink-0" />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">BMS</h1>
                <p className="text-[10px] text-slate-500 truncate">Rider Portal</p>
              </div>
            )}
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {[
            { id: 'home' as const, label: 'Dashboard', icon: <CommandCenterIcon className="h-5 w-5" /> },
            { id: 'bike' as const, label: 'My Motorcycle', icon: <MotorcycleIcon className="h-5 w-5" /> },
            { id: 'incidents' as const, label: 'Incidents', icon: <IncidentAlertIcon className="h-5 w-5" />, count: incidents.filter(i => i.status !== 'resolved').length || undefined },
            { id: 'fines' as const, label: 'Fines', icon: <TrafficFineIcon className="h-5 w-5" />, count: fines.filter(f => f.status === 'issued' || f.status === 'overdue').length || undefined },
            { id: 'profile' as const, label: 'My Profile', icon: <User className="h-5 w-5" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
                setSelectedIncident(null);
                setShowPaymentModal(false);
                setShowBikeChangeRequest(false);
                setShowBMSCard(false);
                setShowNotifications(false);
                setPayingFine(null);
                setReceiptPayment(null);
                setReceiptFine(null);
                setIsEditing(false);
              }}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-left transition-all text-sm font-display ${
                activeSection === item.id
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`flex-shrink-0 ${activeSection === item.id ? 'text-emerald-600' : 'text-slate-400'}`}>
                {item.icon}
              </span>
              {!sidebarCollapsed && <span className="flex-1">{item.label}</span>}
              {!sidebarCollapsed && item.count !== undefined && item.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeSection === item.id
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}

          <div className="pt-2 mt-2 border-t border-slate-100">
            <button
              onClick={() => { localStorage.removeItem('riderActiveSection'); onLogout(); }}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
              className={`w-full flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-left transition-all text-sm font-display text-slate-600 hover:text-red-600 hover:bg-red-50`}
            >
              <span className="text-slate-400 flex-shrink-0"><LogOut className="h-5 w-5" /></span>
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </nav>

        <div className="border-t border-slate-200 p-3 shrink-0 space-y-2 hidden lg:block">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition font-medium"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            {rider?.photo_url ? (
              <img src={rider.photo_url} alt={rider.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-emerald-700 font-semibold text-sm">
                  {rider?.name?.charAt(0).toUpperCase() || 'R'}
                </span>
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{rider?.name}</p>
                <p className="text-xs text-slate-500 truncate">{rider?.bms_id || 'Rider'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} min-w-0 pb-16 lg:pb-0 transition-all duration-200`}>
        {/* Mobile Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
            <Menu className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src="/government-of-kenya-emblem-gok-logo-png_seeklogo-318197 (1).png" alt="" className="h-7 w-7 object-contain" />
            <h1 className="text-sm font-bold text-slate-900 truncate font-display">Rider Dashboard</h1>
          </div>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <BellAlertIcon className="h-5 w-5" />
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Incident Alert Banner */}
        {incidents.filter(inc => inc.status !== 'resolved').length > 0 && (
          <div className="mx-4 sm:mx-6 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" />
                <span className="text-sm font-semibold text-amber-900 truncate">
                  {incidents.filter(inc => inc.status !== 'resolved').length} unresolved incident{incidents.filter(inc => inc.status !== 'resolved').length === 1 ? '' : 's'}
                </span>
                <span className="text-xs text-amber-600 hidden sm:inline">· submit evidence or appeal if needed</span>
              </div>
              <button
                onClick={() => setActiveSection('incidents')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 flex-shrink-0 transition"
              >
                View
              </button>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6">

        {/* Profile Section */}
        {activeSection === 'profile' && rider && (
          <RiderProfileCompletion
            rider={rider as any}
            onUpdate={loadRiderData}
          />
        )}

        {/* ===== HOME DASHBOARD (summaries only) ===== */}
        {activeSection === 'home' && (
        <>
        {/* Rider Rating */}
        {rider && (
          <RiderRatingCard
            stats={{
              rating_score: rider.rating_score,
              rating_tier: rider.rating_tier,
              pending_incident_count: rider.pending_incident_count,
              confirmed_incident_count: rider.confirmed_incident_count,
              total_incident_count: rider.total_incident_count,
              total_fines_count: rider.total_fines_count,
              unpaid_fines_count: rider.unpaid_fines_count,
              license_verified: rider.license_verified,
              license_expiry: rider.license_expiry,
              id_verified: rider.id_verified,
              payment_status: rider.payment_status === 'completed' ? 'Paid' : 'Pending',
              photo_url: rider.photo_url,
              next_of_kin_name: rider.next_of_kin_name,
              next_of_kin_phone: rider.next_of_kin_phone,
              good_conduct_url: rider.good_conduct_url,
              id_copy_url: rider.id_copy_url,
              license_url: rider.license_url,
              kra_pin: rider.kra_pin,
              kra_pin_verified: rider.kra_pin_verified,
              sacco_id: rider.sacco_id,
              bms_id: rider.bms_id,
              assignment_status: rider.assignment_status,
              created_at: rider.created_at,
            }}
          />
        )}
        {/* Profile completion banner */}
        {activeSection === 'home' && rider && (() => {
          const weights: Record<string, number> = { name:5,id_number:5,phone_number:5,id_verified:10,kra_pin:5,kra_pin_verified:5,license_number:8,license_verified:7,next_of_kin_name:5,next_of_kin_phone:5,county:5,photo_url:8,license_url:8,good_conduct_url:8,id_copy_url:6 };
          let pct = 0;
          if (rider.name) pct += weights.name;
          if (rider.id_number) pct += weights.id_number;
          if (rider.phone_number) pct += weights.phone_number;
          if (rider.id_verified) pct += weights.id_verified;
          if (rider.kra_pin) pct += weights.kra_pin;
          if (rider.kra_pin_verified) pct += weights.kra_pin_verified;
          if (rider.license_number) pct += weights.license_number;
          if (rider.license_verified) pct += weights.license_verified;
          if (rider.next_of_kin_name) pct += weights.next_of_kin_name;
          if (rider.next_of_kin_phone) pct += weights.next_of_kin_phone;
          if ((rider as any).county_id) pct += weights.county;
          if (rider.photo_url) pct += weights.photo_url;
          if (rider.license_url) pct += weights.license_url;
          if (rider.good_conduct_url) pct += weights.good_conduct_url;
          if (rider.id_copy_url) pct += weights.id_copy_url;
          if (pct >= 100) return null;
          return (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg width="48" height="48" className="-rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="#fde68a" strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray={2*Math.PI*20} strokeDashoffset={2*Math.PI*20*(1-pct/100)} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-700">{pct}%</span>
                </div>
                <div>
                  <p className="font-semibold text-amber-900 text-sm">Profile {pct}% complete</p>
                  <p className="text-xs text-amber-700">Complete your profile to get matched with motorcycle owners</p>
                </div>
              </div>
              <button
                onClick={() => setActiveSection('profile')}
                className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Complete Profile
              </button>
            </div>
          );
        })()}

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <button onClick={() => setActiveSection('bike')} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition"><MotorcycleIcon className="h-4 w-4 text-emerald-600" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{motorcycle ? '1' : '0'}</p>
            <p className="text-xs text-slate-500 mt-0.5">My Motorcycle</p>
          </button>
          <button onClick={() => setActiveSection('incidents')} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-amber-300 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition"><IncidentAlertIcon className="h-4 w-4 text-amber-600" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{incidents.filter(i => i.status !== 'resolved').length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Open Incidents</p>
          </button>
          <button onClick={() => setActiveSection('fines')} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-red-300 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition"><TrafficFineIcon className="h-4 w-4 text-red-600" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fines.filter(f => f.status === 'issued' || f.status === 'overdue').length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Unpaid Fines</p>
          </button>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center"><DocumentValidatedIcon className="h-4 w-4 text-blue-600" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{(() => { const isPaymentDue = !lastPayment || lastPayment.payment_year < new Date().getFullYear(); return isPaymentDue ? 'Due' : 'Paid'; })()}</p>
            <p className="text-xs text-slate-500 mt-0.5">Annual Fee</p>
          </div>
        </div>

        {/* Key Issues */}
        {(incidents.filter(i => i.status !== 'resolved').length > 0 || fines.filter(f => f.status === 'issued' || f.status === 'overdue').length > 0) && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Needs Attention
            </h3>
            <div className="space-y-2">
              {fines.filter(f => f.status === 'issued' || f.status === 'overdue').slice(0, 3).map((fine) => (
                <button
                  key={fine.id}
                  onClick={() => setActiveSection('fines')}
                  className="w-full bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-3 text-left hover:bg-red-100 transition"
                >
                  <TrafficFineIcon className="h-5 w-5 text-red-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-red-800 truncate">{fine.violation_type || fine.description || 'Traffic Violation'}</p>
                    <p className="text-xs text-red-600">KES {Number(fine.amount).toLocaleString()} — {fine.status === 'overdue' ? 'Overdue' : 'Unpaid'}</p>
                  </div>
                </button>
              ))}
              {incidents.filter(i => i.status !== 'resolved').slice(0, 3).map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => setActiveSection('incidents')}
                  className="w-full bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-center gap-3 text-left hover:bg-amber-100 transition"
                >
                  <IncidentAlertIcon className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-800 truncate">{inc.incident_type || 'Incident'}</p>
                    <p className="text-xs text-amber-600">{inc.status} — {new Date(inc.incident_date || inc.created_at).toLocaleDateString()}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        </>
        )}

        {/* ===== BIKE SECTION ===== */}
        {activeSection === 'bike' && (
        <>
        {(() => {
          const currentYear = new Date().getFullYear();
          const isPaymentDue = !lastPayment || lastPayment.payment_year < currentYear;
          return (
            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 ${isPaymentDue ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-emerald-400'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isPaymentDue ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                    <RevenueVaultIcon className={`h-4 w-4 ${isPaymentDue ? 'text-amber-600' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Annual Fee</p>
                    <p className="text-sm font-bold text-slate-900">KES 100 / year</p>
                  </div>
                </div>
                {isPaymentDue ? (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">Due {currentYear}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <CheckCircle className="h-3.5 w-3.5" /> Paid
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-slate-500 mb-0.5">Last Payment</p>
                  <p className="font-semibold text-slate-900">
                    {lastPayment ? `KES ${Number(lastPayment.amount).toFixed(0)}` : '—'}
                  </p>
                  {lastPayment && <p className="text-xs text-slate-400">Year {lastPayment.payment_year}</p>}
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-slate-500 mb-0.5">{isPaymentDue ? 'Status' : 'Next Due'}</p>
                  <p className={`font-semibold text-sm ${isPaymentDue ? 'text-amber-700' : 'text-slate-900'}`}>
                    {isPaymentDue ? 'Overdue' : nextPaymentDue}
                  </p>
                  <p className="text-xs text-slate-400">{isPaymentDue ? `Fee for ${currentYear}` : 'Annual renewal'}</p>
                </div>
              </div>

              {isPaymentDue && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <RevenueVaultIcon className="h-4 w-4" />
                  Pay Annual Fee — KES 100
                </button>
              )}

              {!isPaymentDue && lastPayment && (
                <button
                  onClick={() => setReceiptPayment(lastPayment)}
                  className="w-full py-2 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <TrafficFineIcon className="h-4 w-4" />
                  View Receipt — Year {lastPayment.payment_year}
                </button>
              )}
            </div>
          );
        })()}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center">
              <User className="h-6 w-6 mr-2 text-emerald-600" />
              Your Profile
            </h2>
            {!isEditing ? (
              <button
                onClick={handleEditClick}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-start space-x-6">
            {rider?.photo_url && (
              <img
                src={rider.photo_url}
                alt={rider.name}
                className="w-24 h-24 rounded-lg object-cover border-2 border-slate-200"
              />
            )}

            <div className="flex-1 grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Name</p>
                <p className="font-semibold text-slate-900">{rider?.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">ID Number</p>
                <p className="font-semibold text-slate-900">{rider?.id_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Phone</p>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.phone_number || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  <p className="font-semibold text-slate-900">{rider?.phone_number}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Next of Kin</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.next_of_kin_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, next_of_kin_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter next of kin name"
                  />
                ) : (
                  <p className="font-semibold text-slate-900">{rider?.next_of_kin_name || 'N/A'}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Next of Kin Phone</p>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.next_of_kin_phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, next_of_kin_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter next of kin phone"
                  />
                ) : (
                  <p className="font-semibold text-slate-900">{rider?.next_of_kin_phone || 'N/A'}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">County Reg</p>
                <p className="font-semibold text-slate-900">{rider?.county_registration_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Sacco ID</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.sacco_id || ''}
                    onChange={(e) => setEditForm({ ...editForm, sacco_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter SACCO ID"
                  />
                ) : (
                  <p className="font-semibold text-slate-900">{rider?.sacco_id || 'N/A'}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Stage</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.stage_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, stage_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter stage name"
                  />
                ) : (
                  <p className="font-semibold text-slate-900">{rider?.stage_name || 'N/A'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Assignment Status</p>
              {rider?.assignment_status === 'Assigned' && (
                <button
                  onClick={() => setShowBikeChangeRequest(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition text-sm font-semibold"
                >
                  <MotorcycleIcon className="h-4 w-4" />
                  <span>Request Bike Change</span>
                </button>
              )}
            </div>
            <div className="mt-1">
              {rider?.assignment_status === 'Assigned' ? (
                <div>
                  <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold">
                    <CheckCircle className="h-4 w-4" />
                    <span>Currently Assigned</span>
                  </span>
                  {motorcycle && owner && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-600 mb-1">Motorcycle</p>
                          <p className="font-semibold text-slate-900 flex items-center">
                            <MotorcycleIcon className="h-4 w-4 mr-1 text-emerald-600" />
                            {motorcycle.registration_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 mb-1">Owner</p>
                          <p className="font-semibold text-slate-900 flex items-center">
                            <User className="h-4 w-4 mr-1 text-emerald-600" />
                            {owner.full_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : rider?.assignment_status === 'Pending' ? (
                <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-semibold">
                  <Clock className="h-4 w-4" />
                  <span>Pending Assignment</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-sm font-semibold">
                  <span>Unassigned</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center">
            <DocumentValidatedIcon className="h-6 w-6 mr-2 text-emerald-600" />
            My Documents
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">Driving License</p>
                {rider?.license_url && (
                  <DocumentLink
                    fileUrl={rider.license_url}
                    label="View"
                    userType="rider"
                    userId={rider.id}
                    documentType="driving_license"
                    className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 text-sm"
                  />
                )}
              </div>
              {rider?.license_url ? (
                <p className="text-xs text-slate-500 mb-2">Document uploaded</p>
              ) : (
                <p className="text-xs text-slate-500 mb-2">No document uploaded</p>
              )}
              <label className="flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer text-sm font-semibold">
                <Upload className="h-4 w-4" />
                <span>{rider?.license_url ? 'Update' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => e.target.files?.[0] && handleDocumentUpload('license', e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">Good Conduct Certificate</p>
                {rider?.good_conduct_url && (
                  <DocumentLink
                    fileUrl={rider.good_conduct_url}
                    label="View"
                    userType="rider"
                    userId={rider.id}
                    documentType="good_conduct"
                    className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 text-sm"
                  />
                )}
              </div>
              {rider?.good_conduct_url ? (
                <p className="text-xs text-slate-500 mb-2">Document uploaded</p>
              ) : (
                <p className="text-xs text-slate-500 mb-2">No document uploaded</p>
              )}
              <label className="flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer text-sm font-semibold">
                <Upload className="h-4 w-4" />
                <span>{rider?.good_conduct_url ? 'Update' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => e.target.files?.[0] && handleDocumentUpload('good_conduct', e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">ID Copy</p>
                {rider?.id_copy_url && (
                  <DocumentLink
                    fileUrl={rider.id_copy_url}
                    label="View"
                    userType="rider"
                    userId={rider.id}
                    documentType="national_id"
                    className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 text-sm"
                  />
                )}
              </div>
              {rider?.id_copy_url ? (
                <p className="text-xs text-slate-500 mb-2">Document uploaded</p>
              ) : (
                <p className="text-xs text-slate-500 mb-2">No document uploaded</p>
              )}
              <label className="flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer text-sm font-semibold">
                <Upload className="h-4 w-4" />
                <span>{rider?.id_copy_url ? 'Update' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => e.target.files?.[0] && handleDocumentUpload('id_copy', e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">Profile Photo</p>
                {rider?.photo_url && (
                  <a
                    href={rider.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 text-sm"
                  >
                    <Eye className="h-4 w-4" />
                    <span>View</span>
                  </a>
                )}
              </div>
              {rider?.photo_url ? (
                <p className="text-xs text-slate-500 mb-2">Document uploaded</p>
              ) : (
                <p className="text-xs text-slate-500 mb-2">No document uploaded</p>
              )}
              <label className="flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer text-sm font-semibold">
                <Upload className="h-4 w-4" />
                <span>{rider?.photo_url ? 'Update' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleDocumentUpload('photo', e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center">
            <PaymentCardIcon className="h-6 w-6 mr-2 text-emerald-600" />
            BMS Identification Card
          </h2>

          {!rider?.bms_id ? (
            <div className="text-center py-8">
              <PaymentCardIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">You don't have a BMS ID yet</p>
              <button
                onClick={handleGenerateBMSId}
                disabled={generatingBMSId}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300"
              >
                {generatingBMSId ? 'Generating...' : 'Generate BMS ID'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Your BMS ID</p>
                  <p className="text-2xl font-bold text-emerald-600">{rider.bms_id}</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowBMSCard(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Preview Card</span>
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {showBMSCard && rider?.bms_id && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-100 rounded-xl shadow-xl max-w-4xl w-full p-6 my-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900">BMS Card Preview</h3>
                <button
                  onClick={() => setShowBMSCard(false)}
                  className="p-2 hover:bg-slate-200 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <BMSCard
                bmsId={rider.bms_id}
                riderName={rider.name}
                idNumber={rider.id_number}
                phoneNumber={rider.phone_number}
                countyReg={rider.county_registration_number}
                photoUrl={rider.photo_url}
                motorcycle={motorcycle?.registration_number}
                owner={owner?.full_name}
              />
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={() => setShowBMSCard(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showBikeChangeRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Request Bike Change</h3>
              <p className="text-sm text-slate-600 mb-4">
                Search for a motorcycle by registration number. The new owner will need to approve this request.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-600 mb-2">
                  Search Motorcycle Registration
                </label>
                <input
                  type="text"
                  value={newBikeRegNumber}
                  onChange={(e) => {
                    setNewBikeRegNumber(e.target.value);
                    searchMotorcycles(e.target.value);
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Start typing... e.g., KAA"
                />
                {searchingBikes && (
                  <p className="text-xs text-slate-500 mt-2">Searching...</p>
                )}
                {availableMotorcycles.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                    {availableMotorcycles.map((bike) => (
                      <button
                        key={bike.id}
                        onClick={() => {
                          setNewBikeRegNumber(bike.registration_number);
                          setAvailableMotorcycles([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition"
                      >
                        <p className="font-semibold text-slate-900">{bike.registration_number}</p>
                        <p className="text-xs text-slate-500">Owner: {bike.owner_name}</p>
                      </button>
                    ))}
                  </div>
                )}
                {newBikeRegNumber.length >= 2 && !searchingBikes && availableMotorcycles.length === 0 && (
                  <p className="text-xs text-slate-500 mt-2">No motorcycles found</p>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleRequestBikeChange}
                  disabled={bikeChangeLoading || !newBikeRegNumber.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300"
                >
                  {bikeChangeLoading ? 'Sending...' : 'Send Request'}
                </button>
                <button
                  onClick={() => {
                    setShowBikeChangeRequest(false);
                    setNewBikeRegNumber('');
                    setAvailableMotorcycles([]);
                  }}
                  disabled={bikeChangeLoading}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center">
            <MotorcycleIcon className="h-6 w-6 mr-2 text-emerald-600" />
            Assignment Requests ({requests.length})
          </h2>

          {requests.length === 0 ? (
            <div className="text-center py-12">
              <MotorcycleIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No assignment requests yet</p>
              <p className="text-sm text-slate-500 mt-2">
                Motorcycle owners can search for you and send assignment requests
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <MotorcycleIcon className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-900 text-lg">
                          {request.motorcycle?.registration_number || 'N/A'}
                        </h3>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>
                          <User className="h-4 w-4 inline mr-1" />
                          Owner: <span className="font-semibold text-slate-900">{request.owner?.full_name}</span>
                        </p>
                        <p>
                          <Phone className="h-4 w-4 inline mr-1" />
                          Contact: <span className="font-semibold text-slate-900">{request.owner?.phone_number}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Requested: {new Date(request.requested_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div>{getStatusBadge(request.status)}</div>
                  </div>

                  {request.motorcycle && (
                    <div className="bg-white rounded-lg p-3 mb-3">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Motorcycle Details</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-600">Serial Number:</span>
                          <span className="ml-2 font-semibold text-slate-900">
                            {request.motorcycle.tracking_device_id || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Insurance:</span>
                          <span className="ml-2 font-semibold text-slate-900">
                            {request.motorcycle.insurance_policy_number || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {request.status === 'Pending' && (
                    <div className="space-y-2">
                      {rider?.assignment_status === 'Assigned' && rider?.motorcycle_id && !request.previous_motorcycle_id && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs text-amber-800">
                            <AlertCircle className="h-4 w-4 inline mr-1" />
                            You already have an active assignment. Your current assignment must be terminated before accepting a new one.
                          </p>
                        </div>
                      )}
                      <div className="flex space-x-2 pt-3 border-t border-slate-200">
                        <button
                          onClick={() => handleRequestResponse(request.id, 'Approved')}
                          disabled={rider?.assignment_status === 'Assigned' && rider?.motorcycle_id && !request.previous_motorcycle_id}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Accept Assignment</span>
                        </button>
                        <button
                          onClick={() => handleRequestResponse(request.id, 'Rejected')}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {request.status !== 'Pending' && request.responded_at && (
                    <p className="text-xs text-slate-500 pt-3 border-t border-slate-200">
                      Responded: {new Date(request.responded_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center">
            <DocumentValidatedIcon className="h-6 w-6 mr-2 text-blue-600" />
            Work History ({workHistory.length})
          </h2>

          {workHistory.length === 0 ? (
            <div className="text-center py-12">
              <DocumentValidatedIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No work history yet</p>
              <p className="text-sm text-slate-500 mt-2">
                Your assignment history will appear here once you start working
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {workHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border ${
                    entry.removed_at
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-blue-50 border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <MotorcycleIcon className="h-5 w-5 text-blue-600" />
                        <h3 className="font-bold text-slate-900 text-lg">
                          {entry.motorcycle_registration}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            entry.removed_at
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {entry.removed_at ? 'Past' : 'Current'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>
                          <User className="h-4 w-4 inline mr-1" />
                          Owner: <span className="font-semibold text-slate-900">{entry.owner_name}</span>
                        </p>
                        <p>
                          <Phone className="h-4 w-4 inline mr-1" />
                          Contact: <span className="font-semibold text-slate-900">{entry.owner_phone}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 mt-3 space-y-2 text-sm">
                    <div className="flex items-center text-slate-600">
                      <Clock className="h-4 w-4 mr-2" />
                      <span className="font-semibold mr-2">Assigned:</span>
                      <span>{new Date(entry.assigned_at).toLocaleDateString()}</span>
                    </div>
                    {entry.removed_at && (
                      <>
                        <div className="flex items-center text-slate-600">
                          <Clock className="h-4 w-4 mr-2" />
                          <span className="font-semibold mr-2">Removed:</span>
                          <span>{new Date(entry.removed_at).toLocaleDateString()}</span>
                        </div>
                        {entry.removal_reason && (
                          <div className="bg-white rounded-lg p-3 mt-2">
                            <p className="text-xs font-semibold text-slate-700 mb-1">Reason for Removal:</p>
                            <p className="text-sm text-slate-600">{entry.removal_reason}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {activeSection === 'incidents' && (
          <div className="mb-6">
            <IncidentsPanel
              role="rider"
              incidents={incidents}
              unreadIncidentIds={new Set(incidentNotifications.filter(n => !n.is_read).map(n => n.incident_id))}
              onOpen={(incident, tab) => {
                setSelectedIncident(incident);
                setIncidentModalTab(tab ?? 'overview');
                markIncidentNotificationAsRead(incident.id);
              }}
            />
          </div>
        )}
      </div>

      {showNotifications && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold flex items-center">
                <BellAlertIcon className="h-6 w-6 mr-2" />
                Notifications ({notifications.filter((n) => !n.read).length} unread)
              </h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-white hover:bg-blue-700 p-1 rounded-lg transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <BellAlertIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 text-lg">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`border rounded-lg p-4 transition ${
                        notification.read
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-red-50 border-red-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {notification.type === 'removal' && (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          <h4 className="font-semibold text-slate-900">{notification.title}</h4>
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => markNotificationAsRead(notification.id)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 mb-3">{notification.message}</p>
                      {notification.metadata?.motorcycle_registration && (
                        <div className="text-xs text-slate-600 space-y-1">
                          <p>
                            <strong>Motorcycle:</strong> {notification.metadata.motorcycle_registration}
                          </p>
                          {notification.metadata.removed_at && (
                            <p>
                              <strong>Date:</strong>{' '}
                              {new Date(notification.metadata.removed_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'fines' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center">
              <TrafficFineIcon className="h-6 w-6 mr-2 text-amber-600" />
              My Fines ({fines.length})
            </h2>
            {fines.filter(f => f.status === 'issued' || f.status === 'overdue').length > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                {fines.filter(f => f.status === 'issued' || f.status === 'overdue').length} Unpaid
              </span>
            )}
          </div>

          {finesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-3"></div>
              <p className="text-slate-500 text-sm">Loading fines...</p>
            </div>
          ) : fines.length === 0 ? (
            <div className="text-center py-12">
              <TrafficFineIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No fines on record</p>
              <p className="text-sm text-slate-500 mt-2">
                Traffic fines issued to you will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fines.map((fine) => (
                <div
                  key={fine.id}
                  className={`p-4 rounded-lg border ${
                    fine.status === 'paid' ? 'bg-emerald-50 border-emerald-200' :
                    fine.status === 'overdue' ? 'bg-red-50 border-red-200' :
                    fine.status === 'cancelled' ? 'bg-slate-50 border-slate-200' :
                    'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900 text-sm">
                          {fine.offence?.offence_name || 'Traffic Offence'}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          fine.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                          fine.status === 'overdue' ? 'bg-red-100 text-red-800' :
                          fine.status === 'cancelled' ? 'bg-slate-200 text-slate-600' :
                          fine.status === 'disputed' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {fine.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-2">
                        <span>Ref: {fine.fine_reference}</span>
                        <span>Issued: {new Date(fine.issued_at).toLocaleDateString()}</span>
                        {fine.due_date && <span>Due: {new Date(fine.due_date).toLocaleDateString()}</span>}
                        {fine.location_description && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{fine.location_description}</span>}
                      </div>
                      {fine.notes && (
                        <p className="text-xs text-slate-500 mt-2 italic">{fine.notes}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-slate-900">KES {fine.fine_amount.toLocaleString()}</p>
                      {fine.status === 'paid' && fine.paid_at && (
                        <p className="text-xs text-emerald-600 mt-1">Paid: {new Date(fine.paid_at).toLocaleDateString()}</p>
                      )}
                      {(fine.status === 'issued' || fine.status === 'overdue') && (
                        <button
                          onClick={() => { setPayingFine(fine); setFinePaymentStep('method'); setFinePaymentMethod(''); setFinePaymentPhone(''); setFinePaymentError(''); }}
                          className="mt-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
                        >
                          Pay Now
                        </button>
                      )}
                      <button
                        onClick={() => setReceiptFine({
                          id: fine.id,
                          fine_reference: fine.fine_reference,
                          fine_amount: fine.fine_amount,
                          status: fine.status,
                          issued_at: fine.issued_at,
                          paid_at: fine.paid_at,
                          due_date: fine.due_date,
                          payment_reference: fine.payment_reference,
                          rider_name: fine.rider_name,
                          rider_phone: fine.rider_phone,
                          rider_national_id: fine.rider_national_id,
                          location_description: fine.location_description,
                          notes: fine.notes,
                          officer_name: fine.officer?.full_name ?? null,
                          officer_rank: fine.officer?.rank ?? null,
                          officer_badge: fine.officer?.badge_number ?? null,
                          station_name: fine.station?.station_name ?? null,
                          offence_name: fine.offence?.offence_name ?? null,
                          offence_code: fine.offence?.offence_code ?? null,
                        })}
                        className="mt-2 ml-2 inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition"
                      >
                        <TrafficFineIcon className="h-3 w-3" />
                        Receipt
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Summary */}
              {fines.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">Total Fines</p>
                      <p className="font-bold text-slate-900">{fines.length}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-600">Unpaid Amount</p>
                      <p className="font-bold text-red-700">
                        KES {fines.filter(f => f.status === 'issued' || f.status === 'overdue').reduce((sum: number, f: any) => sum + f.fine_amount, 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-emerald-600">Paid</p>
                      <p className="font-bold text-emerald-700">
                        KES {fines.filter(f => f.status === 'paid').reduce((sum: number, f: any) => sum + f.fine_amount, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedIncident && (
        <IncidentCaseModal
          role="rider"
          incident={selectedIncident}
          initialTab={incidentModalTab}
          riderId={riderId}
          onClose={() => setSelectedIncident(null)}
          onRefresh={loadRiderData}
        />
      )}

      {/* Fine Payment Modal */}
      {payingFine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Pay Fine</h3>
                <p className="text-emerald-100 text-sm">{payingFine.offence?.offence_name || 'Traffic Fine'}</p>
              </div>
              <button onClick={() => setPayingFine(null)} className="p-1 hover:bg-emerald-700 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {finePaymentStep === 'method' && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold text-slate-900">KES {payingFine.fine_amount.toLocaleString()}</p>
                    <p className="text-sm text-slate-500 mt-1">Ref: {payingFine.fine_reference}</p>
                  </div>
                  <p className="text-sm text-slate-600 font-medium">Select payment method:</p>
                  <button onClick={() => { setFinePaymentMethod('mpesa'); setFinePaymentStep('details'); }} className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center"><PaymentCardIcon className="h-5 w-5 text-green-600" /></div>
                    <div className="text-left"><p className="font-semibold text-slate-900">M-Pesa</p><p className="text-xs text-slate-500">Pay via Safaricom M-Pesa</p></div>
                  </button>
                  <button onClick={() => { setFinePaymentMethod('salamapay'); setFinePaymentStep('details'); }} className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center"><PaymentCardIcon className="h-5 w-5 text-blue-600" /></div>
                    <div className="text-left"><p className="font-semibold text-slate-900">SalamaPay</p><p className="text-xs text-slate-500">Pay via SalamaPay wallet</p></div>
                  </button>
                </div>
              )}
              {finePaymentStep === 'details' && (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-2xl font-bold text-slate-900">KES {payingFine.fine_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <input type="tel" value={finePaymentPhone} onChange={(e) => setFinePaymentPhone(e.target.value)} placeholder="0712345678" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg" />
                  </div>
                  {finePaymentError && <p className="text-sm text-red-600">{finePaymentError}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setFinePaymentStep('method')} className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium">Back</button>
                    <button onClick={handleFinePayment} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold">Pay KES {payingFine.fine_amount.toLocaleString()}</button>
                  </div>
                </div>
              )}
              {finePaymentStep === 'processing' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                  <p className="text-slate-900 font-semibold">Processing payment...</p>
                  <p className="text-sm text-slate-500 mt-2">Please confirm on your phone</p>
                </div>
              )}
              {finePaymentStep === 'success' && (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                  <p className="text-xl font-bold text-slate-900">Payment Successful</p>
                  <p className="text-sm text-slate-500 mt-2">Fine has been cleared</p>
                </div>
              )}
              {finePaymentStep === 'failed' && (
                <div className="text-center py-8">
                  <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <p className="text-xl font-bold text-slate-900">Payment Failed</p>
                  <p className="text-sm text-slate-500 mt-2">Please try again</p>
                  <button onClick={() => setFinePaymentStep('method')} className="mt-4 px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium">Try Again</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />

      {showPaymentModal && rider && (
        <PaymentModal
          userType="rider"
          userId={riderId}
          userName={rider.name}
          onSuccess={(payment) => {
            setLastPayment(payment);
            setNextPaymentDue(`January 1, ${payment.payment_year + 1}`);
            setShowPaymentModal(false);
          }}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {receiptPayment && rider && (
        <PaymentReceiptModal
          payment={receiptPayment}
          payerName={rider.name}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {receiptFine && (
        <FineReceiptModal
          fine={receiptFine}
          onClose={() => setReceiptFine(null)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-800 border-t border-slate-700 safe-area-pb shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <div className="flex items-stretch">
          {[
            { id: 'home' as const, label: 'Home', icon: <CommandCenterIcon className="h-5 w-5" /> },
            { id: 'bike' as const, label: 'My Bike', icon: <MotorcycleIcon className="h-5 w-5" /> },
            { id: 'incidents' as const, label: 'Incidents', icon: <IncidentAlertIcon className="h-5 w-5" />, count: incidents.filter(i => i.status !== 'resolved').length || undefined },
            { id: 'fines' as const, label: 'Fines', icon: <TrafficFineIcon className="h-5 w-5" />, count: fines.filter(f => f.status === 'issued' || f.status === 'overdue').length || undefined },
            { id: 'profile' as const, label: 'Profile', icon: <User className="h-5 w-5" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
                setSelectedIncident(null);
                setShowPaymentModal(false);
                setShowBikeChangeRequest(false);
                setShowBMSCard(false);
                setShowNotifications(false);
                setPayingFine(null);
                setReceiptPayment(null);
                setReceiptFine(null);
                setIsEditing(false);
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 pt-2.5 relative transition-colors ${
                activeSection === item.id
                  ? 'text-emerald-400'
                  : 'text-slate-400 active:text-slate-300'
              }`}
            >
              {activeSection === item.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-400 rounded-full" />
              )}
              <span className="relative">
                {item.icon}
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
                    {item.count > 9 ? '9+' : item.count}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      </main>
    </div>
  );
}
