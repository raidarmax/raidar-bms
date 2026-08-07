import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRightLeft, User, CreditCard as Edit, Save, X, Plus, Trash2, Download, QrCode, ExternalLink, Upload, ChevronDown, ChevronUp, Eye, Clock, MapPin, MessageSquare, Image, Menu, LogOut, CheckCircle, AlertCircle, Navigation, Camera } from 'lucide-react';
import { MotorcycleIcon, TrafficFineIcon, IncidentAlertIcon, DocumentValidatedIcon, RevenueVaultIcon, CommandCenterIcon, GpsBeaconIcon } from './icons/BrandIcons';
import TrackingModal from './TrackingModal';
import { supabase, type Owner, type Motorcycle, type Rider, type Verification, type RiderHistory, type Payment, type Incident, type IncidentNotification } from '../lib/supabase';
import { usePersistedState } from '../lib/navigationMemory';
import { generateQRCode } from '../lib/qrcode';
import Footer from './Footer';
import PaymentModal from './PaymentModal';
import PaymentReceiptModal from './PaymentReceiptModal';
import OwnerProfileCompletion from './OwnerProfileCompletion';
import BikeTransferModal from './BikeTransferModal';
import AdditionalBikePaymentModal from './AdditionalBikePaymentModal';
import MotorcycleIncidentsSection from './MotorcycleIncidentsSection';
import DocumentLink from './DocumentLink';
import IncidentsPanel, { type IncidentPanelTab } from './incidents/IncidentsPanel';
import IncidentCaseModal from './incidents/IncidentCaseModal';
import BmsIdLink from './BmsIdLink';

type UserDashboardProps = {
  ownerId: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
};

type AssignmentRequest = {
  id: string;
  rider_id: string;
  motorcycle_id: string;
  owner_id: string;
  status: string;
  requested_at: string;
  responded_at: string | null;
  rider_name?: string;
  motorcycle_registration?: string;
};

export default function UserDashboard({ ownerId, onNavigate, onLogout }: UserDashboardProps) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [motorcycleHistory, setMotorcycleHistory] = useState<Record<string, RiderHistory[]>>({});
  const [verification, setVerification] = useState<Verification | null>(null);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [nextPaymentDue, setNextPaymentDue] = useState<string>('N/A');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingOwner, setEditingOwner] = useState(false);
  const [editingMotorcycleId, setEditingMotorcycleId] = useState<string | null>(null);
  const [addingMotorcycle, setAddingMotorcycle] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [expandedBikeId, setExpandedBikeId] = useState<string | null>(null);
  const [searchingRider, setSearchingRider] = useState(false);
  const [riderSearchQuery, setRiderSearchQuery] = useState('');
  const [searchedRider, setSearchedRider] = useState<Rider | null>(null);
  const [searchedRiderMotorcycle, setSearchedRiderMotorcycle] = useState<Motorcycle | null>(null);
  const [searchedRiderOwner, setSearchedRiderOwner] = useState<Owner | null>(null);
  const [selectedMotorcycleForAssignment, setSelectedMotorcycleForAssignment] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<AssignmentRequest[]>([]);
  const [searchedRiderHistory, setSearchedRiderHistory] = useState<Array<{
    id: string;
    motorcycle_registration: string;
    owner_name: string;
    owner_phone: string;
    assigned_at: string;
    removed_at: string | null;
    removal_reason: string | null;
  }>>([]);
  const [showRemovalModal, setShowRemovalModal] = useState(false);
  const [removalData, setRemovalData] = useState<{riderId: string; motorcycleId: string; motorcycleReg: string; riderName: string} | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentNotifications, setIncidentNotifications] = useState<IncidentNotification[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidentModalTab, setIncidentModalTab] = useState<IncidentPanelTab>('overview');
  const [viewingRequestRider, setViewingRequestRider] = useState<Rider | null>(null);
  const [viewingRequestRiderHistory, setViewingRequestRiderHistory] = useState<Array<{
    id: string;
    motorcycle_registration: string;
    owner_name: string;
    owner_phone: string;
    assigned_at: string;
    removed_at: string | null;
    removal_reason: string | null;
  }>>([]);
  const [selectedRequest, setSelectedRequest] = useState<AssignmentRequest | null>(null);
  const [activeSection, setActiveSection] = usePersistedState<'home' | 'motorcycles' | 'incidents' | 'fines' | 'profile' | 'tracking'>('user.activeSection', 'home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ownerPhotoUploading, setOwnerPhotoUploading] = useState(false);
  const [fines, setFines] = useState<any[]>([]);
  const [finesLoading, setFinesLoading] = useState(false);
  const [payingFine, setPayingFine] = useState<any | null>(null);
  const [finePaymentStep, setFinePaymentStep] = useState<'method' | 'details' | 'processing' | 'success' | 'failed'>('method');
  const [finePaymentMethod, setFinePaymentMethod] = useState<'mpesa' | 'salamapay' | ''>('');
  const [finePaymentPhone, setFinePaymentPhone] = useState('');
  const [finePaymentError, setFinePaymentError] = useState('');

  const [transferringMotorcycle, setTransferringMotorcycle] = useState<Motorcycle | null>(null);
  const [trackingMotorcycle, setTrackingMotorcycle] = useState<Motorcycle | null>(null);
  const [additionalBikePayment, setAdditionalBikePayment] = useState(false);
  const [additionalBikePaid, setAdditionalBikePaid] = useState(false);

  const [ownerForm, setOwnerForm] = useState({
    full_name: '',
    phone_number: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
  });

  const [motorcycleForm, setMotorcycleForm] = useState({
    registration_number: '',
    tracking_device_id: '',
    insurance_policy_number: '',
    make: '',
    model: '',
    insurance_provider: '',
    insurance_expiry: '',
    inspection_certificate_number: '',
    inspection_expiry: '',
  });

  const [motorcycleFiles, setMotorcycleFiles] = useState({
    logbook: null as File | null,
    kra_pin: null as File | null,
    insurance_cover: null as File | null,
  });
  const [editBikePhoto, setEditBikePhoto] = useState<File | null>(null);
  const [editInspectionCert, setEditInspectionCert] = useState<File | null>(null);

  const [riderForm, setRiderForm] = useState({
    name: '',
    id_number: '',
    phone_number: '',
    county_registration_number: '',
    sacco_id: '',
    stage_name: '',
    motorcycle_id: '',
  });

  const [riderFiles, setRiderFiles] = useState({
    photo: null as File | null,
    license: null as File | null,
    good_conduct: null as File | null,
    id_copy: null as File | null,
  });

  useEffect(() => {
    loadUserData();
    loadFines();
  }, [ownerId]);

  useEffect(() => {
    if (activeSection === 'fines') loadFines();
  }, [activeSection]);

  const loadFines = async () => {
    setFinesLoading(true);
    const { data: byId } = await supabase
      .from('fines')
      .select('*, offence:traffic_offences(offence_name, category)')
      .eq('owner_id', ownerId)
      .order('issued_at', { ascending: false });

    let allFines = byId || [];

    if (owner?.phone_number) {
      const normalized = owner.phone_number.replace(/\s+/g, '');
      const { data: byPhone } = await supabase
        .from('fines')
        .select('*, offence:traffic_offences(offence_name, category)')
        .is('owner_id', null)
        .eq('owner_phone', normalized)
        .order('issued_at', { ascending: false });
      if (byPhone) {
        const existingIds = new Set(allFines.map((f: any) => f.id));
        allFines = [...allFines, ...byPhone.filter((f: any) => !existingIds.has(f.id))];
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

  const loadUserData = async () => {
    setLoading(true);
    console.log('Loading user data for ownerId:', ownerId);
    try {
      if (!ownerId) {
        console.error('No ownerId provided');
        setLoading(false);
        return;
      }
      const { data: ownerData } = await supabase
        .from('owners')
        .select('*')
        .eq('id', ownerId)
        .maybeSingle();

      const { data: motorcyclesData } = await supabase
        .from('motorcycles')
        .select('*')
        .eq('owner_id', ownerId);

      const { data: ridersData } = await supabase
        .from('riders')
        .select('*')
        .eq('owner_id', ownerId);

      const { data: verificationData } = await supabase
        .from('verifications')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();

      const { data: requestsData } = await supabase
        .from('assignment_requests')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('status', 'Pending');

      if (ownerData) {
        setOwner(ownerData);
        setOwnerForm({
          full_name: ownerData.full_name,
          phone_number: ownerData.phone_number,
          next_of_kin_name: ownerData.next_of_kin_name,
          next_of_kin_phone: ownerData.next_of_kin_phone,
        });
      }

      if (motorcyclesData) {
        setMotorcycles(motorcyclesData);
      }

      if (ridersData) {
        setRiders(ridersData);
      }

      if (verificationData) {
        setVerification(verificationData);
        const verificationUrl = `${window.location.origin}/verify/${verificationData.qr_code_data}`;
        const qrCode = await generateQRCode(verificationUrl);
        setQrCodeUrl(qrCode);
      }

      const { data: paymentData } = await supabase
        .from('payments')
        .select('*')
        .eq('user_type', 'owner')
        .eq('user_id', ownerId)
        .eq('payment_status', 'completed')
        .order('payment_year', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentData) {
        setLastPayment(paymentData);
        const lastPaymentYear = paymentData.payment_year;
        const nextYear = lastPaymentYear + 1;
        setNextPaymentDue(`January 1, ${nextYear}`);
      } else if (ownerData) {
        const registrationYear = new Date(ownerData.created_at).getFullYear();
        setNextPaymentDue(`January 1, ${registrationYear + 1}`);
      }

      if (requestsData && requestsData.length > 0) {
        const enrichedRequests = await Promise.all(
          requestsData.map(async (request) => {
            const { data: riderData } = await supabase
              .from('riders')
              .select('name')
              .eq('id', request.rider_id)
              .maybeSingle();

            const { data: motorcycleData } = await supabase
              .from('motorcycles')
              .select('registration_number')
              .eq('id', request.motorcycle_id)
              .maybeSingle();

            return {
              ...request,
              rider_name: riderData?.name,
              motorcycle_registration: motorcycleData?.registration_number,
            };
          })
        );
        setPendingRequests(enrichedRequests);
      } else {
        setPendingRequests([]);
      }

      const { data: incidentsData } = await supabase
        .from('incidents')
        .select('*')
        .eq('owner_id', ownerId)
        .order('incident_date', { ascending: false });

      setIncidents(incidentsData || []);

      const { data: incidentNotifsData } = await supabase
        .from('incident_notifications')
        .select('*')
        .eq('user_type', 'owner')
        .eq('user_id', ownerId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      setIncidentNotifications(incidentNotifsData || []);
    } catch (error) {
      console.error('Error loading user data:', error);
      alert('Failed to load dashboard data. Please try logging in again.');
    } finally {
      console.log('Finished loading user data');
      setLoading(false);
    }
  };

  const loadMotorcycleHistory = async (motorcycleId: string) => {
    try {
      const { data, error } = await supabase
        .from('rider_history')
        .select('*')
        .eq('motorcycle_id', motorcycleId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      setMotorcycleHistory((prev) => ({
        ...prev,
        [motorcycleId]: data || [],
      }));
    } catch (error) {
      console.error('Error loading motorcycle history:', error);
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

  const handleToggleBikeExpansion = async (motorcycleId: string) => {
    if (expandedBikeId === motorcycleId) {
      setExpandedBikeId(null);
    } else {
      setExpandedBikeId(motorcycleId);
      if (!motorcycleHistory[motorcycleId]) {
        await loadMotorcycleHistory(motorcycleId);
      }
    }
  };

  const handleUpdateOwner = async () => {
    try {
      const { error } = await supabase
        .from('owners')
        .update({
          full_name: ownerForm.full_name,
          phone_number: ownerForm.phone_number,
          next_of_kin_name: ownerForm.next_of_kin_name,
          next_of_kin_phone: ownerForm.next_of_kin_phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ownerId);

      if (error) throw error;
      await loadUserData();
      setEditingOwner(false);
      alert('Owner information updated successfully!');
    } catch (error) {
      console.error('Error updating owner:', error);
      alert('Failed to update owner information');
    }
  };

  const handleOwnerPhotoUpload = async (file: File) => {
    setOwnerPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${ownerId}/profile.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('owner-profiles')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('owner-profiles')
        .getPublicUrl(path);

      const url = `${publicUrl}?t=${Date.now()}`;
      const { error: dbError } = await supabase
        .from('owners')
        .update({ profile_photo_url: url })
        .eq('id', ownerId);
      if (dbError) throw dbError;

      setOwner(prev => prev ? { ...prev, profile_photo_url: url } : prev);
    } catch (err: any) {
      alert('Failed to upload photo: ' + (err.message ?? 'Unknown error'));
    } finally {
      setOwnerPhotoUploading(false);
    }
  };

  const handleAddMotorcycle = async () => {
    try {
      if (!motorcycleFiles.logbook || !motorcycleFiles.kra_pin) {
        alert('Please upload all required documents (Logbook and KRA PIN Certificate)');
        return;
      }

      const tempId = `temp_${Date.now()}`;

      const logbookUrl = await uploadFile(
        motorcycleFiles.logbook,
        'documents',
        `motorcycles/${tempId}/logbook_${Date.now()}.pdf`
      );

      if (!logbookUrl) {
        alert('Failed to upload logbook. Please check the file and try again.');
        return;
      }

      const kraPinUrl = await uploadFile(
        motorcycleFiles.kra_pin,
        'documents',
        `motorcycles/${tempId}/kra_pin_${Date.now()}.pdf`
      );

      if (!kraPinUrl) {
        alert('Failed to upload KRA PIN certificate. Please check the file and try again.');
        return;
      }

      let insuranceCoverUrl = null;
      if (motorcycleFiles.insurance_cover) {
        insuranceCoverUrl = await uploadFile(
          motorcycleFiles.insurance_cover,
          'documents',
          `motorcycles/${tempId}/insurance_cover_${Date.now()}.pdf`
        );
      }

      const { error } = await supabase
        .from('motorcycles')
        .insert({
          owner_id: ownerId,
          registration_number: motorcycleForm.registration_number,
          tracking_device_id: motorcycleForm.tracking_device_id || null,
          logbook_url: logbookUrl,
          kra_pin_url: kraPinUrl,
          insurance_policy_number: motorcycleForm.insurance_policy_number || null,
          insurance_cover_url: insuranceCoverUrl,
        });

      if (error) throw error;

      await loadUserData();
      setAddingMotorcycle(false);
      setAdditionalBikePaid(false);
      setMotorcycleForm({
        registration_number: '',
        tracking_device_id: '',
        insurance_policy_number: '',
        make: '',
        model: '',
        insurance_provider: '',
        insurance_expiry: '',
        inspection_certificate_number: '',
        inspection_expiry: '',
      });
      setMotorcycleFiles({ logbook: null, kra_pin: null, insurance_cover: null });
      alert('Motorcycle added successfully!');
    } catch (error) {
      console.error('Error adding motorcycle:', error);
      alert('Failed to add motorcycle');
    }
  };


  const handleDeleteMotorcycle = async (motorcycleId: string) => {
    if (!confirm('Are you sure you want to delete this motorcycle? This will also delete all associated riders.')) return;

    try {
      const { error } = await supabase
        .from('motorcycles')
        .delete()
        .eq('id', motorcycleId);

      if (error) throw error;
      await loadUserData();
      alert('Motorcycle deleted successfully!');
    } catch (error) {
      console.error('Error deleting motorcycle:', error);
      alert('Failed to delete motorcycle');
    }
  };

  const startEditingMotorcycle = (motorcycle: Motorcycle) => {
    setEditingMotorcycleId(motorcycle.id);
    setMotorcycleForm({
      registration_number: motorcycle.registration_number,
      tracking_device_id: motorcycle.tracking_device_id || '',
      insurance_policy_number: (motorcycle as any).insurance_policy_number || '',
      make: motorcycle.make || '',
      model: motorcycle.model || '',
      insurance_provider: motorcycle.insurance_provider || '',
      insurance_expiry: motorcycle.insurance_expiry || '',
      inspection_certificate_number: motorcycle.inspection_certificate_number || '',
      inspection_expiry: motorcycle.inspection_expiry || '',
    });
    setMotorcycleFiles({
      logbook: null,
      kra_pin: null,
      insurance_cover: null,
    });
    setEditBikePhoto(null);
    setEditInspectionCert(null);
  };


  const handleRemoveRiderFromBike = async () => {
    if (!removalData || !removalReason.trim()) {
      alert('Please provide a reason for removal');
      return;
    }

    try {
      const { error: historyError } = await supabase
        .from('rider_history')
        .update({
          removed_at: new Date().toISOString(),
          removal_reason: removalReason,
          updated_at: new Date().toISOString(),
        })
        .eq('motorcycle_id', removalData.motorcycleId)
        .eq('rider_id', removalData.riderId)
        .is('removed_at', null);

      if (historyError) throw historyError;

      const { error } = await supabase
        .from('riders')
        .update({
          motorcycle_id: null,
          owner_id: null,
          assignment_status: 'Unassigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', removalData.riderId);

      if (error) throw error;

      const { error: notificationError } = await supabase
        .from('rider_notifications')
        .insert({
          rider_id: removalData.riderId,
          type: 'removal',
          title: 'Assignment Terminated',
          message: `Your assignment to motorcycle ${removalData.motorcycleReg} has been terminated. Reason: ${removalReason}`,
          read: false,
          metadata: {
            motorcycle_registration: removalData.motorcycleReg,
            removal_reason: removalReason,
            removed_at: new Date().toISOString(),
          },
        });

      if (notificationError) throw notificationError;

      await loadUserData();
      setShowRemovalModal(false);
      setRemovalData(null);
      setRemovalReason('');
      alert('Rider removed from motorcycle successfully!');
    } catch (error) {
      console.error('Error removing rider:', error);
      alert('Failed to remove rider from motorcycle');
    }
  };


  const handleViewRequestRider = async (request: AssignmentRequest) => {
    try {
      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('id', request.rider_id)
        .maybeSingle();

      if (riderError) throw riderError;
      if (!riderData) {
        alert('Rider not found');
        return;
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
        .eq('rider_id', request.rider_id)
        .order('assigned_at', { ascending: false });

      if (historyError) {
        console.error('Error loading rider history:', historyError);
      }

      const formattedHistory = historyData?.map((entry: any) => ({
        id: entry.id,
        motorcycle_registration: entry.motorcycles?.registration_number || 'Unknown',
        owner_name: entry.owners?.full_name || 'Unknown',
        owner_phone: entry.owners?.phone_number || 'N/A',
        assigned_at: entry.assigned_at,
        removed_at: entry.removed_at,
        removal_reason: entry.removal_reason,
      })) || [];

      setViewingRequestRider(riderData);
      setViewingRequestRiderHistory(formattedHistory);
      setSelectedRequest(request);
    } catch (error) {
      console.error('Error loading rider details:', error);
      alert('Failed to load rider details');
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedRequest) return;

    const confirmed = confirm('Are you sure you want to cancel this assignment request?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('assignment_requests')
        .delete()
        .eq('id', selectedRequest.id);

      if (error) throw error;

      const { error: notificationError } = await supabase
        .from('rider_notifications')
        .insert({
          rider_id: selectedRequest.rider_id,
          type: 'request_cancelled',
          title: 'Assignment Request Cancelled',
          message: `The owner has cancelled the assignment request for motorcycle ${selectedRequest.motorcycle_registration}`,
          read: false,
          metadata: {
            motorcycle_registration: selectedRequest.motorcycle_registration,
            cancelled_at: new Date().toISOString(),
          },
        });

      if (notificationError) console.error('Error sending notification:', notificationError);

      await loadUserData();
      setViewingRequestRider(null);
      setSelectedRequest(null);
      alert('Assignment request cancelled successfully');
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Failed to cancel assignment request');
    }
  };

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleUpdateMotorcycle = async (motorcycleId: string) => {
    try {
      const updateData: any = {
        registration_number: motorcycleForm.registration_number,
        tracking_device_id: motorcycleForm.tracking_device_id || null,
        insurance_policy_number: motorcycleForm.insurance_policy_number || null,
        make: motorcycleForm.make || null,
        model: motorcycleForm.model || null,
        insurance_provider: motorcycleForm.insurance_provider || null,
        insurance_expiry: motorcycleForm.insurance_expiry || null,
        inspection_certificate_number: motorcycleForm.inspection_certificate_number || null,
        inspection_expiry: motorcycleForm.inspection_expiry || null,
        updated_at: new Date().toISOString(),
      };

      if (editBikePhoto) {
        const ext = editBikePhoto.name.split('.').pop() || 'jpg';
        const photoUrl = await uploadFile(
          editBikePhoto,
          'documents',
          `motorcycles/${motorcycleId}/bike_photo_${Date.now()}.${ext}`
        );
        if (photoUrl) updateData.bike_photo_url = photoUrl;
      }

      if (motorcycleFiles.logbook) {
        const logbookUrl = await uploadFile(
          motorcycleFiles.logbook,
          'documents',
          `motorcycles/${motorcycleId}/logbook_${Date.now()}.pdf`
        );
        if (logbookUrl) updateData.logbook_url = logbookUrl;
      }

      if (motorcycleFiles.kra_pin) {
        const kraPinUrl = await uploadFile(
          motorcycleFiles.kra_pin,
          'documents',
          `motorcycles/${motorcycleId}/kra_pin_${Date.now()}.pdf`
        );
        if (kraPinUrl) updateData.kra_pin_url = kraPinUrl;
      }

      if (motorcycleFiles.insurance_cover) {
        const insuranceCoverUrl = await uploadFile(
          motorcycleFiles.insurance_cover,
          'documents',
          `motorcycles/${motorcycleId}/insurance_cover_${Date.now()}.pdf`
        );
        if (insuranceCoverUrl) updateData.insurance_cover_url = insuranceCoverUrl;
      }

      if (editInspectionCert) {
        const inspUrl = await uploadFile(
          editInspectionCert,
          'documents',
          `motorcycles/${motorcycleId}/inspection_cert_${Date.now()}.pdf`
        );
        if (inspUrl) updateData.inspection_certificate_url = inspUrl;
      }

      const { error } = await supabase
        .from('motorcycles')
        .update(updateData)
        .eq('id', motorcycleId);

      if (error) throw error;

      await loadUserData();
      setEditingMotorcycleId(null);
      setEditBikePhoto(null);
      setEditInspectionCert(null);
      setMotorcycleFiles({ logbook: null, kra_pin: null, insurance_cover: null });
      alert('Motorcycle information updated successfully!');
    } catch (error) {
      console.error('Error updating motorcycle:', error);
      alert('Failed to update motorcycle information');
    }
  };


  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `bodaboda-qr-${verification?.qr_code_data}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSearchRider = async () => {
    if (!riderSearchQuery.trim()) {
      alert('Please enter a rider ID number');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('id_number', riderSearchQuery.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSearchedRider(data);

        if (data.motorcycle_id) {
          const { data: motorcycleData } = await supabase
            .from('motorcycles')
            .select('*')
            .eq('id', data.motorcycle_id)
            .maybeSingle();

          setSearchedRiderMotorcycle(motorcycleData);
        } else {
          setSearchedRiderMotorcycle(null);
        }

        if (data.owner_id) {
          const { data: ownerData } = await supabase
            .from('owners')
            .select('*')
            .eq('id', data.owner_id)
            .maybeSingle();

          setSearchedRiderOwner(ownerData);
        } else {
          setSearchedRiderOwner(null);
        }

        const { data: historyData } = await supabase
          .from('rider_history')
          .select('*')
          .eq('rider_id', data.id)
          .order('assigned_at', { ascending: false });

        if (historyData && historyData.length > 0) {
          const enrichedHistory = await Promise.all(
            historyData.map(async (history) => {
              const { data: motorcycleData } = await supabase
                .from('motorcycles')
                .select('registration_number, owner_id')
                .eq('id', history.motorcycle_id)
                .maybeSingle();

              let ownerName = 'Unknown';
              let ownerPhone = 'N/A';

              if (motorcycleData?.owner_id) {
                const { data: ownerData } = await supabase
                  .from('owners')
                  .select('full_name, phone_number')
                  .eq('id', motorcycleData.owner_id)
                  .maybeSingle();

                if (ownerData) {
                  ownerName = ownerData.full_name;
                  ownerPhone = ownerData.phone_number;
                }
              }

              return {
                id: history.id,
                motorcycle_registration: motorcycleData?.registration_number || 'Unknown',
                owner_name: ownerName,
                owner_phone: ownerPhone,
                assigned_at: history.assigned_at,
                removed_at: history.removed_at,
                removal_reason: history.removal_reason,
              };
            })
          );
          setSearchedRiderHistory(enrichedHistory);
        } else {
          setSearchedRiderHistory([]);
        }
      } else {
        alert('No rider found with that ID number');
        setSearchedRider(null);
        setSearchedRiderMotorcycle(null);
        setSearchedRiderOwner(null);
        setSearchedRiderHistory([]);
      }
    } catch (error) {
      console.error('Error searching for rider:', error);
      alert('Failed to search for rider');
    }
  };

  const handleAssignRider = async () => {
    if (!searchedRider || !selectedMotorcycleForAssignment) {
      alert('Please select a motorcycle to assign the rider to');
      return;
    }

    if (searchedRider.motorcycle_id && searchedRider.motorcycle_id !== selectedMotorcycleForAssignment) {
      alert('This rider is already assigned to another motorcycle. A rider can only be assigned to one motorcycle at a time.');
      return;
    }

    if (searchedRider.motorcycle_id === selectedMotorcycleForAssignment) {
      alert('This rider is already assigned to this motorcycle.');
      return;
    }

    try {
      const { error: requestError } = await supabase
        .from('assignment_requests')
        .insert({
          rider_id: searchedRider.id,
          motorcycle_id: selectedMotorcycleForAssignment,
          owner_id: ownerId,
          status: 'Pending',
          requested_at: new Date().toISOString(),
        });

      if (requestError) throw requestError;

      const { error: riderError } = await supabase
        .from('riders')
        .update({
          assignment_status: 'Pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', searchedRider.id);

      if (riderError) throw riderError;

      await loadUserData();
      setSearchingRider(false);
      setRiderSearchQuery('');
      setSearchedRider(null);
      setSearchedRiderMotorcycle(null);
      setSearchedRiderOwner(null);
      setSelectedMotorcycleForAssignment(null);
      alert('Assignment request sent! The rider will be notified and can approve or reject the assignment.');
    } catch (error) {
      console.error('Error sending assignment request:', error);
      alert('Failed to send assignment request');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return (
          <span className="flex items-center space-x-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold">
            <span>Verified</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="flex items-center space-x-1 bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-semibold">
            <span>Pending Verification</span>
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

  if (!owner) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Unable to load your dashboard</p>
          <button
            onClick={onLogout}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            Back to Login
          </button>
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
      <aside className={`w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-4 border-b border-slate-200 shrink-0 justify-between">
          <div className="flex items-center min-w-0">
            <img src="/government-of-kenya-emblem-gok-logo-png_seeklogo-318197 (1).png" alt="Government of Kenya" className="h-10 w-10 object-contain mr-2" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">BMS</h1>
              <p className="text-[10px] text-slate-500 truncate">Owner Portal</p>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {[
            { id: 'home' as const, label: 'Dashboard', icon: <CommandCenterIcon className="h-5 w-5" /> },
            { id: 'motorcycles' as const, label: 'Motorcycles', icon: <MotorcycleIcon className="h-5 w-5" />, count: motorcycles.length || undefined },
            { id: 'incidents' as const, label: 'Incidents', icon: <IncidentAlertIcon className="h-5 w-5" />, count: incidents.filter(i => i.status !== 'resolved').length || undefined },
            { id: 'fines' as const, label: 'Fines', icon: <TrafficFineIcon className="h-5 w-5" />, count: fines.filter(f => f.status === 'issued' || f.status === 'overdue').length || undefined },
            { id: 'profile' as const, label: 'My Profile', icon: <User className="h-5 w-5" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
                setExpandedBikeId(null);
                setEditingOwner(false);
                setEditingMotorcycleId(null);
                setAddingMotorcycle(false);
                setSearchingRider(false);
                setShowRemovalModal(false);
                setSelectedIncident(null);
                setViewingRequestRider(null);
                setSelectedRequest(null);
                setPayingFine(null);
                setShowPaymentModal(false);
                setTransferringMotorcycle(null);
                setAdditionalBikePayment(false);
                setTrackingMotorcycle(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm font-display ${
                activeSection === item.id
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={activeSection === item.id ? 'text-emerald-600' : 'text-slate-400'}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
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
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm font-display text-slate-600 hover:text-red-600 hover:bg-red-50"
            >
              <span className="text-slate-400"><LogOut className="h-5 w-5" /></span>
              <span>Sign Out</span>
            </button>
          </div>
        </nav>

        <div className="border-t border-slate-200 p-3 shrink-0 hidden lg:block">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <span className="text-emerald-700 font-semibold text-sm">
                {owner?.full_name?.charAt(0).toUpperCase() || 'O'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{owner?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">Owner</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 min-w-0 pb-16 lg:pb-0">
        {/* Mobile Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
            <Menu className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src="/government-of-kenya-emblem-gok-logo-png_seeklogo-318197 (1).png" alt="" className="h-7 w-7 object-contain" />
            <h1 className="text-sm font-bold text-slate-900 truncate font-display">Owner Dashboard</h1>
          </div>
          <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-emerald-700 font-semibold text-xs">{owner?.full_name?.charAt(0).toUpperCase() || 'O'}</span>
          </div>
        </div>

        {/* Tracking full-page view */}
        {trackingMotorcycle ? (
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setTrackingMotorcycle(null)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium text-sm"
              >
                <ArrowLeft className="h-4 w-4" /> {activeSection === 'tracking' ? 'Back to Tracking' : 'Back to Motorcycles'}
              </button>
              <div className="text-right">
                <h1 className="text-lg font-bold text-slate-900">Live Tracking</h1>
                <p className="text-slate-500 text-xs font-mono">{trackingMotorcycle.registration_number}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[calc(100vh-140px)] lg:h-[calc(100vh-180px)]">
              <TrackingModal
                motorcycle={trackingMotorcycle}
                onClose={() => setTrackingMotorcycle(null)}
                fullPage={true}
              />
            </div>
          </div>
        ) : (<>

        {/* Incident Alert Banner */}
        {incidents.filter(inc => inc.status !== 'resolved').length > 0 && activeSection === 'incidents' && (
          <div className="mx-4 sm:mx-6 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" />
                <span className="text-sm font-semibold text-amber-900 truncate">
                  {incidents.filter(inc => inc.status !== 'resolved').length} unresolved incident{incidents.filter(inc => inc.status !== 'resolved').length === 1 ? '' : 's'}
                </span>
                <span className="text-xs text-amber-600 hidden sm:inline">· reported for your motorcycles or riders</span>
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

      <div className="p-4 sm:p-6">

        {/* Profile Section */}
        {activeSection === 'profile' && owner && (
          <OwnerProfileCompletion
            owner={owner as any}
            motorcycles={motorcycles}
            onUpdate={loadUserData}
          />
        )}

        {/* ===== HOME DASHBOARD (summaries only) ===== */}
        {activeSection === 'home' && (
        <>
        {/* Profile completion banner */}
        {owner && (() => {
          const ownerAny = owner as any;
          const moto = motorcycles[0] ?? null;
          const items = ['full_name','national_id','phone_number','id_verified','kra_pin','kra_pin_verified','next_of_kin_name','next_of_kin_phone','county_id','motorcycle_registration','motorcycle_make','motorcycle_model','insurance_number','bike_photo','logbook','kra_pin_doc','insurance_cover'] as const;
          const weights: Record<string, number> = { full_name:5,national_id:5,phone_number:5,id_verified:10,kra_pin:5,kra_pin_verified:5,next_of_kin_name:5,next_of_kin_phone:5,county_id:5,motorcycle_registration:10,motorcycle_make:5,motorcycle_model:5,insurance_number:5,bike_photo:7,logbook:7,kra_pin_doc:5,insurance_cover:6 };
          let pct = 0;
          if (owner.full_name) pct += weights.full_name;
          if (owner.national_id) pct += weights.national_id;
          if (owner.phone_number) pct += weights.phone_number;
          if (owner.id_verified) pct += weights.id_verified;
          if (owner.kra_pin) pct += weights.kra_pin;
          if (owner.kra_pin_verified) pct += weights.kra_pin_verified;
          if (owner.next_of_kin_name) pct += weights.next_of_kin_name;
          if (owner.next_of_kin_phone) pct += weights.next_of_kin_phone;
          if (ownerAny.county_id) pct += weights.county_id;
          if (moto) {
            if (moto.registration_number) pct += weights.motorcycle_registration;
            if (moto.make) pct += weights.motorcycle_make;
            if (moto.model) pct += weights.motorcycle_model;
            if (moto.insurance_policy_number) pct += weights.insurance_number;
            if (moto.bike_photo_url) pct += weights.bike_photo;
            if (moto.logbook_url) pct += weights.logbook;
            if (moto.kra_pin_url) pct += weights.kra_pin_doc;
            if (moto.insurance_cover_url) pct += weights.insurance_cover;
          }
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
                  <p className="text-xs text-amber-700">Complete your profile to get verified and attract riders</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-slate-900">Verification Status</h2>
              {verification && getStatusBadge(verification.status)}
            </div>
            {qrCodeUrl && (
              <div className="flex items-center space-x-6">
                <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32 border-2 border-slate-200 rounded-lg" />
                <div>
                  <p className="text-slate-600 mb-2">
                    Your registration is currently {verification?.status.toLowerCase()}.
                    {verification?.status === 'Pending' && ' Please wait for admin verification.'}
                    {verification?.status === 'Verified' && ' Your registration is active!'}
                  </p>
                  <button
                    onClick={handleDownloadQR}
                    className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download QR Code</span>
                  </button>
                </div>
              </div>
            )}
          </div>

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
                      <p className="text-sm font-bold text-slate-900">KES 350 / year</p>
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
                    Pay Annual Fee — KES 350
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
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <button onClick={() => setActiveSection('motorcycles')} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition"><MotorcycleIcon className="h-4 w-4 text-emerald-600" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{motorcycles.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Motorcycles</p>
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
          <button onClick={() => setActiveSection('profile')} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition"><DocumentValidatedIcon className="h-4 w-4 text-blue-600" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{owner?.government_verified ? 'Verified' : 'Pending'}</p>
            <p className="text-xs text-slate-500 mt-0.5">Verification</p>
          </button>
        </div>

        {/* Bike Location Cards — click to track */}
        {motorcycles.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <GpsBeaconIcon className="h-4 w-4 text-emerald-500" />
              Bike Locations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {motorcycles.map((mc) => (
                <button
                  key={mc.id}
                  onClick={() => { setActiveSection('tracking'); setTrackingMotorcycle(mc); }}
                  className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition shrink-0">
                      <Navigation className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-sm font-mono">{mc.registration_number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{mc.make && mc.model ? `${mc.make} ${mc.model}` : 'Motorcycle'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {mc.tracking_device_id ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No tracker</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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
                    <p className="text-sm font-medium text-red-800 truncate">Fine: {fine.violation_type || fine.description || 'Traffic Violation'}</p>
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

        {/* ===== PROFILE SECTION ===== */}
        {activeSection === 'profile' && (
        <>
        {owner && (() => {
          const nextOfKinDone = owner.next_of_kin_name && owner.next_of_kin_phone;
          const idDone = owner.id_number;
          const govDone = owner.government_verified;
          const allDone = nextOfKinDone && idDone && govDone;
          if (allDone) return null;
          const done = [nextOfKinDone, idDone, govDone].filter(Boolean).length;
          const total = 3;
          const pct = Math.round((done / total) * 100);
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-4">
              <div className="relative h-12 w-12 shrink-0">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#fde68a" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-700">{pct}%</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Complete your profile</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {!nextOfKinDone && 'Add next of kin. '}
                  {!idDone && 'Add ID number. '}
                  {!govDone && 'Verify government records.'}
                </p>
              </div>
            </div>
          );
        })()}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {owner && (() => {
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DocumentValidatedIcon className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Verification Status</h3>
                </div>
                {owner.government_verified ? (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-700 font-medium">Government Verified</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm text-amber-700 font-medium">Pending Verification</span>
                  </div>
                )}
              </div>
            );
          })()}
          {(() => {
            const isPaymentDue = !lastPayment || lastPayment.payment_year < new Date().getFullYear();
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RevenueVaultIcon className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Annual Fee</h3>
                </div>
                {isPaymentDue ? (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-sm text-red-700 font-medium">Payment Due</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-700 font-medium">Paid for {lastPayment?.payment_year}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        </>
        )}

        {activeSection === 'motorcycles' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center">
              <User className="h-5 w-5 lg:h-6 lg:w-6 mr-2 text-emerald-600" />
              Owner Information
            </h2>
            {!editingOwner ? (
              <button
                onClick={() => setEditingOwner(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleUpdateOwner}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
                <button
                  onClick={() => {
                    setEditingOwner(false);
                    if (owner) {
                      setOwnerForm({
                        full_name: owner.full_name,
                        phone_number: owner.phone_number,
                        next_of_kin_name: owner.next_of_kin_name,
                        next_of_kin_phone: owner.next_of_kin_phone,
                      });
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Full Name</label>
              {editingOwner ? (
                <input
                  type="text"
                  value={ownerForm.full_name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <p className="text-slate-900 font-semibold">{owner?.full_name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Phone Number</label>
              {editingOwner ? (
                <input
                  type="tel"
                  value={ownerForm.phone_number}
                  onChange={(e) => setOwnerForm({ ...ownerForm, phone_number: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <p className="text-slate-900 font-semibold">{owner?.phone_number}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">National ID</label>
              <p className="text-slate-900 font-semibold">{owner?.national_id}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Next of Kin</label>
              {editingOwner ? (
                <input
                  type="text"
                  value={ownerForm.next_of_kin_name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, next_of_kin_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <p className="text-slate-900 font-semibold">{owner?.next_of_kin_name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Next of Kin Phone</label>
              {editingOwner ? (
                <input
                  type="tel"
                  value={ownerForm.next_of_kin_phone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, next_of_kin_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <p className="text-slate-900 font-semibold">{owner?.next_of_kin_phone}</p>
              )}
            </div>
          </div>
        </div>
        )}

        {activeSection === 'motorcycles' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center">
              <MotorcycleIcon className="h-5 w-5 lg:h-6 lg:w-6 mr-2 text-emerald-600" />
              Motorcycles & Riders ({motorcycles.length})
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setSearchingRider(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <User className="h-4 w-4" />
                <span>Assign Existing Rider</span>
              </button>
              <button
                onClick={() => {
                  if (motorcycles.length >= 1 && !additionalBikePaid) {
                    setAdditionalBikePayment(true);
                  } else {
                    setAddingMotorcycle(true);
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add Motorcycle</span>
              </button>
            </div>
          </div>

          {pendingRequests.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center">
                <DocumentValidatedIcon className="h-5 w-5 mr-2" />
                Pending Assignment Requests ({pendingRequests.length})
              </h3>
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-lg p-3 text-sm hover:shadow-md transition cursor-pointer border border-slate-200"
                    onClick={() => handleViewRequestRider(request)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-slate-900">
                          Request sent to rider <span className="font-semibold">{request.rider_name || 'Unknown'}</span> for motorcycle <span className="font-semibold">{request.motorcycle_registration || 'Unknown'}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Requested on {new Date(request.requested_at).toLocaleString()}
                        </p>
                      </div>
                      <Eye className="h-5 w-5 text-blue-600 ml-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {addingMotorcycle && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-3">Add New Motorcycle</h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Registration Number *</label>
                  <input
                    type="text"
                    value={motorcycleForm.registration_number}
                    onChange={(e) => setMotorcycleForm({ ...motorcycleForm, registration_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="KAA 123A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={motorcycleForm.tracking_device_id}
                    onChange={(e) => setMotorcycleForm({ ...motorcycleForm, tracking_device_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="TRK-12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Insurance Policy Number</label>
                  <input
                    type="text"
                    value={motorcycleForm.insurance_policy_number}
                    onChange={(e) => setMotorcycleForm({ ...motorcycleForm, insurance_policy_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="INS-2024-12345"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Upload Required Documents *</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2">
                      <Upload className="h-4 w-4 inline mr-1" />
                      Logbook (PDF) *
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setMotorcycleFiles({ ...motorcycleFiles, logbook: e.target.files?.[0] || null })}
                      className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      required
                    />
                    {motorcycleFiles.logbook && (
                      <p className="text-xs text-emerald-600 mt-1">{motorcycleFiles.logbook.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2">
                      <Upload className="h-4 w-4 inline mr-1" />
                      KRA PIN Certificate (PDF) *
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setMotorcycleFiles({ ...motorcycleFiles, kra_pin: e.target.files?.[0] || null })}
                      className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      required
                    />
                    {motorcycleFiles.kra_pin && (
                      <p className="text-xs text-emerald-600 mt-1">{motorcycleFiles.kra_pin.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2">
                      <Upload className="h-4 w-4 inline mr-1" />
                      Insurance Cover (PDF)
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setMotorcycleFiles({ ...motorcycleFiles, insurance_cover: e.target.files?.[0] || null })}
                      className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    {motorcycleFiles.insurance_cover && (
                      <p className="text-xs text-emerald-600 mt-1">{motorcycleFiles.insurance_cover.name}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleAddMotorcycle}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  Save Motorcycle
                </button>
                <button
                  onClick={() => {
                    setAddingMotorcycle(false);
                    setMotorcycleForm({
                      registration_number: '',
                      tracking_device_id: '',
                      insurance_policy_number: '',
                      make: '',
                      model: '',
                      insurance_provider: '',
                      insurance_expiry: '',
                      inspection_certificate_number: '',
                      inspection_expiry: '',
                    });
                    setMotorcycleFiles({ logbook: null, kra_pin: null, insurance_cover: null });
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {motorcycles.map((motorcycle) => {
              const assignedRider = riders.find((r: any) => r.motorcycle_id === motorcycle.id);
              const isExpanded = expandedBikeId === motorcycle.id;

              return (
              <div key={motorcycle.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                {editingMotorcycleId === motorcycle.id ? (
                  <>
                    <h3 className="font-bold text-slate-900 mb-4 text-lg">Edit Motorcycle</h3>

                    {/* Basic Info */}
                    <div className="grid md:grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Registration Number</label>
                        <input
                          type="text"
                          value={motorcycleForm.registration_number}
                          onChange={(e) => setMotorcycleForm({ ...motorcycleForm, registration_number: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Serial Number</label>
                        <input
                          type="text"
                          value={motorcycleForm.tracking_device_id}
                          onChange={(e) => setMotorcycleForm({ ...motorcycleForm, tracking_device_id: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="e.g. TRK-12345"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Make</label>
                        <input
                          type="text"
                          value={motorcycleForm.make}
                          onChange={(e) => setMotorcycleForm({ ...motorcycleForm, make: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="e.g. Honda, Yamaha, TVS"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Model</label>
                        <input
                          type="text"
                          value={motorcycleForm.model}
                          onChange={(e) => setMotorcycleForm({ ...motorcycleForm, model: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="e.g. CB125, Star City"
                        />
                      </div>
                    </div>

                    {/* Insurance Details */}
                    <div className="border-t border-slate-200 pt-4 mb-5">
                      <p className="text-sm font-semibold text-slate-700 mb-3">Insurance Details</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1">Insurance Policy Number</label>
                          <input
                            type="text"
                            value={motorcycleForm.insurance_policy_number}
                            onChange={(e) => setMotorcycleForm({ ...motorcycleForm, insurance_policy_number: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="INS-2024-12345"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1">Insurance Provider</label>
                          <input
                            type="text"
                            value={motorcycleForm.insurance_provider}
                            onChange={(e) => setMotorcycleForm({ ...motorcycleForm, insurance_provider: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="e.g. Jubilee, CIC, Britam"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1">Insurance Expiry</label>
                          <input
                            type="date"
                            value={motorcycleForm.insurance_expiry}
                            onChange={(e) => setMotorcycleForm({ ...motorcycleForm, insurance_expiry: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* NTSA Inspection */}
                    <div className="border-t border-slate-200 pt-4 mb-5">
                      <p className="text-sm font-semibold text-slate-700 mb-3">NTSA Inspection</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1">Inspection Certificate No.</label>
                          <input
                            type="text"
                            value={motorcycleForm.inspection_certificate_number}
                            onChange={(e) => setMotorcycleForm({ ...motorcycleForm, inspection_certificate_number: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="NTSA-INSP-12345"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1">Inspection Expiry</label>
                          <input
                            type="date"
                            value={motorcycleForm.inspection_expiry}
                            onChange={(e) => setMotorcycleForm({ ...motorcycleForm, inspection_expiry: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-2">
                            <Upload className="h-4 w-4 inline mr-1" />
                            Inspection Certificate (PDF)
                          </label>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setEditInspectionCert(e.target.files?.[0] || null)}
                            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          />
                          {editInspectionCert && (
                            <p className="text-xs text-emerald-600 mt-1">{editInspectionCert.name}</p>
                          )}
                          {!editInspectionCert && motorcycle.inspection_certificate_url && (
                            <p className="text-xs text-slate-500 mt-1">Current certificate on file</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bike Photo */}
                    <div className="border-t border-slate-200 pt-4 mb-5">
                      <p className="text-sm font-semibold text-slate-700 mb-3">Bike Photo</p>
                      <div className="flex items-start gap-4">
                        {(editBikePhoto || motorcycle.bike_photo_url) && (
                          <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                            <img
                              src={editBikePhoto ? URL.createObjectURL(editBikePhoto) : motorcycle.bike_photo_url!}
                              alt="Bike"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-slate-600 mb-2">
                            <Camera className="h-4 w-4 inline mr-1" />
                            Upload Photo
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setEditBikePhoto(e.target.files?.[0] || null)}
                            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          />
                          {editBikePhoto && (
                            <p className="text-xs text-emerald-600 mt-1">{editBikePhoto.name}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="border-t border-slate-200 pt-4 mb-5">
                      <p className="text-sm font-semibold text-slate-700 mb-3">Update Documents (Optional)</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-2">
                            <Upload className="h-4 w-4 inline mr-1" />
                            Logbook (PDF)
                          </label>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setMotorcycleFiles({ ...motorcycleFiles, logbook: e.target.files?.[0] || null })}
                            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          />
                          {motorcycleFiles.logbook && (
                            <p className="text-xs text-emerald-600 mt-1">{motorcycleFiles.logbook.name}</p>
                          )}
                          {!motorcycleFiles.logbook && motorcycle.logbook_url && (
                            <p className="text-xs text-slate-500 mt-1">Current logbook on file</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-2">
                            <Upload className="h-4 w-4 inline mr-1" />
                            KRA PIN Certificate (PDF)
                          </label>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setMotorcycleFiles({ ...motorcycleFiles, kra_pin: e.target.files?.[0] || null })}
                            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          />
                          {motorcycleFiles.kra_pin && (
                            <p className="text-xs text-emerald-600 mt-1">{motorcycleFiles.kra_pin.name}</p>
                          )}
                          {!motorcycleFiles.kra_pin && motorcycle.kra_pin_url && (
                            <p className="text-xs text-slate-500 mt-1">Current certificate on file</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-2">
                            <Upload className="h-4 w-4 inline mr-1" />
                            Insurance Cover (PDF)
                          </label>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setMotorcycleFiles({ ...motorcycleFiles, insurance_cover: e.target.files?.[0] || null })}
                            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          />
                          {motorcycleFiles.insurance_cover && (
                            <p className="text-xs text-emerald-600 mt-1">{motorcycleFiles.insurance_cover.name}</p>
                          )}
                          {!motorcycleFiles.insurance_cover && motorcycle.insurance_cover_url && (
                            <p className="text-xs text-slate-500 mt-1">Current cover on file</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateMotorcycle(motorcycle.id)}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save Changes
                      </button>
                      <button
                        onClick={() => { setEditingMotorcycleId(null); setEditBikePhoto(null); setEditInspectionCert(null); }}
                        className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 flex items-center text-lg">
                          <MotorcycleIcon className="h-6 w-6 mr-2 text-emerald-600" />
                          {motorcycle.registration_number}
                        </h3>
                        {assignedRider && (
                          <p className="text-sm text-slate-600 ml-8 mt-1">
                            <User className="h-4 w-4 inline mr-1" />
                            Rider: <span className="font-semibold text-slate-900">{assignedRider.name}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleToggleBikeExpansion(motorcycle.id)}
                          className="flex items-center space-x-1 px-3 py-2 text-slate-600 hover:text-emerald-600 hover:bg-white rounded-lg transition"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="text-sm">Details</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => startEditingMotorcycle(motorcycle)}
                          className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-white rounded-lg transition"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setTrackingMotorcycle(motorcycle)}
                          title="Track motorcycle"
                          className="p-2 text-slate-600 hover:text-teal-600 hover:bg-white rounded-lg transition"
                        >
                          <Navigation className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setTransferringMotorcycle(motorcycle)}
                          title="Transfer ownership"
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMotorcycle(motorcycle.id)}
                          className="p-2 text-slate-600 hover:text-red-600 hover:bg-white rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-4">
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
                            <MotorcycleIcon className="h-5 w-5 mr-2 text-emerald-600" />
                            Motorcycle Details
                          </h4>
                          {motorcycle.bike_photo_url && (
                            <div className="mb-3">
                              <img
                                src={motorcycle.bike_photo_url}
                                alt={motorcycle.registration_number}
                                className="w-full max-w-xs h-40 object-cover rounded-lg border border-slate-200"
                              />
                            </div>
                          )}
                          <div className="grid md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-slate-600">Registration:</span>
                              <span className="ml-2 font-semibold text-slate-900">{motorcycle.registration_number}</span>
                            </div>
                            {(motorcycle.make || motorcycle.model) && (
                              <div>
                                <span className="text-slate-600">Make / Model:</span>
                                <span className="ml-2 font-semibold text-slate-900">
                                  {[motorcycle.make, motorcycle.model].filter(Boolean).join(' ')}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-600">Serial Number:</span>
                              <span className="ml-2 font-semibold text-slate-900">{motorcycle.tracking_device_id || 'N/A'}</span>
                            </div>
                            {motorcycle.tracking_device_id && (
                              <button
                                onClick={() => setTrackingMotorcycle(motorcycle)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-sm font-medium hover:bg-teal-100 transition"
                              >
                                <Navigation className="h-4 w-4" />
                                Track My Bike
                              </button>
                            )}
                          </div>

                          {/* Insurance Info */}
                          <div className="border-t border-slate-200 mt-3 pt-3">
                            <p className="text-sm font-semibold text-slate-700 mb-2">Insurance</p>
                            <div className="grid md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-slate-600">Policy Number:</span>
                                {(motorcycle as any).insurance_policy_number ? (
                                  <span className="ml-2 font-semibold text-slate-900">{(motorcycle as any).insurance_policy_number}</span>
                                ) : (
                                  <span className="ml-2 font-semibold text-red-600">Not Provided</span>
                                )}
                              </div>
                              {motorcycle.insurance_provider && (
                                <div>
                                  <span className="text-slate-600">Provider:</span>
                                  <span className="ml-2 font-semibold text-slate-900">{motorcycle.insurance_provider}</span>
                                </div>
                              )}
                              {motorcycle.insurance_expiry && (
                                <div>
                                  <span className="text-slate-600">Expiry:</span>
                                  <span className={`ml-2 font-semibold ${new Date(motorcycle.insurance_expiry) < new Date() ? 'text-red-600' : 'text-slate-900'}`}>
                                    {new Date(motorcycle.insurance_expiry).toLocaleDateString()}
                                    {new Date(motorcycle.insurance_expiry) < new Date() && ' (Expired)'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* NTSA Inspection */}
                          {(motorcycle.inspection_certificate_number || motorcycle.inspection_expiry) && (
                            <div className="border-t border-slate-200 mt-3 pt-3">
                              <p className="text-sm font-semibold text-slate-700 mb-2">NTSA Inspection</p>
                              <div className="grid md:grid-cols-2 gap-3 text-sm">
                                {motorcycle.inspection_certificate_number && (
                                  <div>
                                    <span className="text-slate-600">Certificate No:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{motorcycle.inspection_certificate_number}</span>
                                  </div>
                                )}
                                {motorcycle.inspection_expiry && (
                                  <div>
                                    <span className="text-slate-600">Expiry:</span>
                                    <span className={`ml-2 font-semibold ${new Date(motorcycle.inspection_expiry) < new Date() ? 'text-red-600' : 'text-slate-900'}`}>
                                      {new Date(motorcycle.inspection_expiry).toLocaleDateString()}
                                      {new Date(motorcycle.inspection_expiry) < new Date() && ' (Expired)'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="border-t border-slate-200 mt-3 pt-3">
                            <p className="text-sm font-semibold text-slate-700 mb-2">Uploaded Documents</p>
                            <div className="space-y-2">
                              {motorcycle.logbook_url ? (
                                <DocumentLink
                                  fileUrl={motorcycle.logbook_url}
                                  label="View Logbook"
                                  userType="owner"
                                  userId={motorcycle.owner_id}
                                  documentType="logbook"
                                  className="flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm"
                                />
                              ) : (
                                <p className="text-sm text-slate-400">No logbook uploaded</p>
                              )}
                              {motorcycle.kra_pin_url ? (
                                <DocumentLink
                                  fileUrl={motorcycle.kra_pin_url}
                                  label="View KRA PIN Certificate"
                                  userType="owner"
                                  userId={motorcycle.owner_id}
                                  documentType="kra_pin_doc"
                                  className="flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm"
                                />
                              ) : (
                                <p className="text-sm text-slate-400">No KRA PIN uploaded</p>
                              )}
                              {(motorcycle as any).insurance_cover_url ? (
                                <DocumentLink
                                  fileUrl={(motorcycle as any).insurance_cover_url}
                                  label="View Insurance Cover"
                                  userType="owner"
                                  userId={motorcycle.owner_id}
                                  documentType="insurance_cover"
                                  className="flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm"
                                />
                              ) : (
                                <p className="text-sm text-slate-400">No insurance cover uploaded</p>
                              )}
                              {motorcycle.inspection_certificate_url ? (
                                <DocumentLink
                                  fileUrl={motorcycle.inspection_certificate_url}
                                  label="View Inspection Certificate"
                                  userType="owner"
                                  userId={motorcycle.owner_id}
                                  documentType="inspection_cert"
                                  className="flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm"
                                />
                              ) : (
                                <p className="text-sm text-slate-400">No inspection certificate uploaded</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {assignedRider && (
                          <div className="bg-white rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-slate-900 flex items-center">
                                <User className="h-5 w-5 mr-2 text-emerald-600" />
                                Rider Details
                              </h4>
                              <button
                                onClick={() => {
                                  setRemovalData({
                                    riderId: assignedRider.id,
                                    motorcycleId: motorcycle.id,
                                    motorcycleReg: motorcycle.registration_number,
                                    riderName: assignedRider.name,
                                  });
                                  setShowRemovalModal(true);
                                }}
                                className="flex items-center space-x-1 px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                              >
                                <X className="h-4 w-4" />
                                <span>Remove Rider</span>
                              </button>
                            </div>
                            {false ? (
                              <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Rider Name *</label>
                                    <input
                                      type="text"
                                      value={riderForm.name}
                                      onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">ID Number *</label>
                                    <input
                                      type="text"
                                      value={riderForm.id_number}
                                      onChange={(e) => setRiderForm({ ...riderForm, id_number: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Phone Number</label>
                                    <input
                                      type="tel"
                                      value={riderForm.phone_number}
                                      onChange={(e) => setRiderForm({ ...riderForm, phone_number: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                      placeholder="+254712345678"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">County Registration</label>
                                    <input
                                      type="text"
                                      value={riderForm.county_registration_number}
                                      onChange={(e) => setRiderForm({ ...riderForm, county_registration_number: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Sacco ID</label>
                                    <input
                                      type="text"
                                      value={riderForm.sacco_id}
                                      onChange={(e) => setRiderForm({ ...riderForm, sacco_id: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Stage Name</label>
                                    <input
                                      type="text"
                                      value={riderForm.stage_name}
                                      onChange={(e) => setRiderForm({ ...riderForm, stage_name: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                </div>

                                <div className="border-t border-slate-200 pt-4">
                                  <p className="text-sm font-semibold text-slate-700 mb-3">Update Documents (Optional)</p>
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                                        <Upload className="h-4 w-4 inline mr-1" />
                                        Rider Photo (JPG/PNG)
                                      </label>
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/jpg"
                                        onChange={(e) => setRiderFiles({ ...riderFiles, photo: e.target.files?.[0] || null })}
                                        className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                                        <DocumentValidatedIcon className="h-4 w-4 inline mr-1" />
                                        Driving License (PDF)
                                      </label>
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={(e) => setRiderFiles({ ...riderFiles, license: e.target.files?.[0] || null })}
                                        className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                                        <DocumentValidatedIcon className="h-4 w-4 inline mr-1" />
                                        Good Conduct (PDF)
                                      </label>
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={(e) => setRiderFiles({ ...riderFiles, good_conduct: e.target.files?.[0] || null })}
                                        className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-semibold text-slate-600 mb-2">
                                        <DocumentValidatedIcon className="h-4 w-4 inline mr-1" />
                                        ID Copy (PDF)
                                      </label>
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={(e) => setRiderFiles({ ...riderFiles, id_copy: e.target.files?.[0] || null })}
                                        className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex space-x-3 pt-3 border-t border-slate-200">
                                  <button
                                    onClick={() => handleRiderUpdate(assignedRider.id)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                                  >
                                    <Save className="h-4 w-4" />
                                    <span>Save Changes</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingRiderId(null);
                                      setRiderFiles({ photo: null, license: null, good_conduct: null, id_copy: null });
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
                                  >
                                    <X className="h-4 w-4" />
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="grid md:grid-cols-2 gap-3 text-sm mb-3">
                                  <div>
                                    <span className="text-slate-600">Name:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{assignedRider.name}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-600">ID Number:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{assignedRider.id_number}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-600">Phone:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{(assignedRider as any).phone_number || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-600">County Reg:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{assignedRider.county_registration_number || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-600">Sacco ID:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{assignedRider.sacco_id || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-600">Stage:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{assignedRider.stage_name || 'N/A'}</span>
                                  </div>
                                </div>

                                {assignedRider.photo_url && (
                                  <div className="border-t border-slate-200 pt-3 mb-3">
                                    <p className="text-sm font-semibold text-slate-700 mb-2">Rider Photo</p>
                                    <img
                                      src={assignedRider.photo_url}
                                      alt={assignedRider.name}
                                      className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200"
                                    />
                                  </div>
                                )}

                                <div className="border-t border-slate-200 pt-3">
                                  <p className="text-sm font-semibold text-slate-700 mb-2">Uploaded Documents</p>
                                  <div className="space-y-2">
                                    {assignedRider.license_url ? (
                                      <a
                                        href={assignedRider.license_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm"
                                      >
                                        <DocumentValidatedIcon className="h-4 w-4" />
                                        <span>View Driving License</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : (
                                      <p className="text-sm text-slate-400">No license uploaded</p>
                                    )}
                                    {assignedRider.good_conduct_url ? (
                                      <a
                                        href={assignedRider.good_conduct_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm"
                                      >
                                        <DocumentValidatedIcon className="h-4 w-4" />
                                        <span>View Good Conduct Certificate</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : (
                                      <p className="text-sm text-slate-400">No good conduct certificate uploaded</p>
                                    )}
                                    {(assignedRider as any).id_copy_url ? (
                                      <a
                                        href={(assignedRider as any).id_copy_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm"
                                      >
                                        <DocumentValidatedIcon className="h-4 w-4" />
                                        <span>View ID Copy</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : (
                                      <p className="text-sm text-slate-400">No ID copy uploaded</p>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <div className="bg-white rounded-lg p-4">
                          <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
                            <DocumentValidatedIcon className="h-5 w-5 mr-2 text-emerald-600" />
                            Rider Assignment History
                          </h4>
                          {motorcycleHistory[motorcycle.id] && motorcycleHistory[motorcycle.id].length > 0 ? (
                            <div className="space-y-3">
                              {motorcycleHistory[motorcycle.id].map((history) => (
                                <div
                                  key={history.id}
                                  className={`bg-slate-50 rounded-lg p-3 border ${
                                    history.removed_at ? 'border-slate-200' : 'border-emerald-300'
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
                                          ? 'bg-slate-200 text-slate-700'
                                          : 'bg-emerald-100 text-emerald-800'
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
                            <p className="text-slate-500 text-center py-4 text-sm">
                              No rider history available for this motorcycle
                            </p>
                          )}
                        </div>

                        {!assignedRider && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                            <User className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                            <p className="text-sm text-amber-800">
                              No rider assigned to this motorcycle yet.
                            </p>
                          </div>
                        )}

                        <MotorcycleIncidentsSection motorcycleId={motorcycle.id} />
                      </div>
                    )}
                  </>
                )}
              </div>
              );
            })}

            {motorcycles.length === 0 && !addingMotorcycle && (
              <div className="text-center py-8 text-slate-500">
                <MotorcycleIcon className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>No motorcycles added yet. Click "Add Motorcycle" to get started.</p>
              </div>
            )}
          </div>
        </div>
        )}

          {activeSection === 'incidents' && (
            <div className="mt-6 lg:mt-8">
              <IncidentsPanel
                role="owner"
                incidents={incidents}
                motorcycles={motorcycles}
                riders={riders}
                unreadIncidentIds={new Set(incidentNotifications.filter(n => !n.is_read).map(n => n.incident_id))}
                onOpen={(incident, tab) => {
                  setSelectedIncident(incident);
                  setIncidentModalTab(tab ?? 'overview');
                  markIncidentNotificationAsRead(incident.id);
                }}
              />
            </div>
          )}

          {activeSection === 'fines' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6 mt-6 lg:mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                <TrafficFineIcon className="h-6 w-6 mr-2 text-amber-600" />
                Fines ({fines.length})
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
                  Fines linked to your motorcycles will appear here
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
                        <p className="text-xs text-slate-600 mt-1">Rider: {fine.rider_name}</p>
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
                      </div>
                    </div>
                  </div>
                ))}

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

        </div>

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
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center"><Edit className="h-5 w-5 text-green-600" /></div>
                    <div className="text-left"><p className="font-semibold text-slate-900">M-Pesa</p><p className="text-xs text-slate-500">Pay via Safaricom M-Pesa</p></div>
                  </button>
                  <button onClick={() => { setFinePaymentMethod('salamapay'); setFinePaymentStep('details'); }} className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center"><Edit className="h-5 w-5 text-blue-600" /></div>
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

      {searchingRider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-2xl font-bold text-slate-900">Assign Existing Rider</h3>
              <button
                onClick={() => {
                  setSearchingRider(false);
                  setRiderSearchQuery('');
                  setSearchedRider(null);
                  setSearchedRiderMotorcycle(null);
                  setSearchedRiderOwner(null);
                  setSelectedMotorcycleForAssignment(null);
                  setSearchedRiderHistory([]);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <p className="text-slate-600 mb-4">
                  Search for a rider by their ID number and assign them to one of your motorcycles.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2">Rider ID Number</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={riderSearchQuery}
                        onChange={(e) => setRiderSearchQuery(e.target.value)}
                        placeholder="Enter rider's ID number"
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleSearchRider}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  {searchedRider && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                      <h4 className="font-bold text-slate-900 mb-3 flex items-center">
                        <User className="h-5 w-5 mr-2 text-blue-600" />
                        Rider Found
                      </h4>

                      <div className="space-y-3">
                        {searchedRider.photo_url && (
                          <div className="mb-3">
                            <img
                              src={searchedRider.photo_url}
                              alt={searchedRider.name}
                              className="w-24 h-24 rounded-lg object-cover border-2 border-slate-200"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-slate-600">Name:</span>
                            <span className="ml-2 font-semibold text-slate-900">{searchedRider.name}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">ID Number:</span>
                            <span className="ml-2 font-semibold text-slate-900">{searchedRider.id_number}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Phone:</span>
                            <span className="ml-2 font-semibold text-slate-900">
                              {(searchedRider as any).phone_number || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600">County Reg:</span>
                            <span className="ml-2 font-semibold text-slate-900">
                              {searchedRider.county_registration_number || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600">Sacco ID:</span>
                            <span className="ml-2 font-semibold text-slate-900">
                              {searchedRider.sacco_id || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600">Stage:</span>
                            <span className="ml-2 font-semibold text-slate-900">
                              {searchedRider.stage_name || 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 pt-3 mt-3">
                          <p className="text-sm font-semibold text-slate-700 mb-2">Uploaded Documents</p>
                          <div className="space-y-2 mb-4">
                            {searchedRider.license_url ? (
                              <a
                                href={searchedRider.license_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                              >
                                <DocumentValidatedIcon className="h-4 w-4" />
                                <span>View Driving License</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <p className="text-sm text-slate-400">No license uploaded</p>
                            )}
                            {searchedRider.good_conduct_url ? (
                              <a
                                href={searchedRider.good_conduct_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                              >
                                <DocumentValidatedIcon className="h-4 w-4" />
                                <span>View Good Conduct Certificate</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <p className="text-sm text-slate-400">No good conduct certificate uploaded</p>
                            )}
                            {(searchedRider as any).id_copy_url ? (
                              <a
                                href={(searchedRider as any).id_copy_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                              >
                                <DocumentValidatedIcon className="h-4 w-4" />
                                <span>View ID Copy</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <p className="text-sm text-slate-400">No ID copy uploaded</p>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-slate-200 pt-3 mt-3">
                          <p className="text-sm font-semibold text-slate-700 mb-3">Rider History - Previous Motorcycles</p>
                          {searchedRiderHistory.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {searchedRiderHistory.map((history) => (
                                <div
                                  key={history.id}
                                  className={`bg-slate-50 rounded-lg p-3 border text-xs ${
                                    history.removed_at ? 'border-slate-200' : 'border-blue-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <MotorcycleIcon className="h-4 w-4 text-blue-600" />
                                        <p className="font-semibold text-slate-900">{history.motorcycle_registration}</p>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                            history.removed_at
                                              ? 'bg-slate-200 text-slate-700'
                                              : 'bg-blue-100 text-blue-800'
                                          }`}
                                        >
                                          {history.removed_at ? 'Past' : 'Current'}
                                        </span>
                                      </div>
                                      <div className="space-y-1 text-slate-600">
                                        <div className="flex items-center">
                                          <User className="h-3 w-3 mr-1.5" />
                                          <span className="font-semibold mr-1">Owner:</span>
                                          <span>{history.owner_name}</span>
                                        </div>
                                        <div className="flex items-center">
                                          <span className="font-semibold mr-1 ml-4.5">Phone:</span>
                                          <span>{history.owner_phone}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
                                    <div className="flex items-center text-slate-600">
                                      <span className="font-semibold mr-2">Assigned:</span>
                                      <span>{new Date(history.assigned_at).toLocaleDateString()}</span>
                                    </div>
                                    {history.removed_at && (
                                      <>
                                        <div className="flex items-center text-slate-600">
                                          <span className="font-semibold mr-2">Removed:</span>
                                          <span>{new Date(history.removed_at).toLocaleDateString()}</span>
                                        </div>
                                        {history.removal_reason && (
                                          <div className="flex items-start text-slate-600">
                                            <span className="font-semibold mr-2">Reason:</span>
                                            <span className="flex-1">{history.removal_reason}</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-slate-50 rounded-lg p-4 text-center">
                              <DocumentValidatedIcon className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                              <p className="text-sm text-slate-500">No previous work history available for this rider</p>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-200 pt-3 mt-3">
                          <p className="text-sm font-semibold text-slate-700 mb-2">Current Assignment Status</p>
                          {searchedRider.assignment_status === 'Assigned' && searchedRiderMotorcycle && searchedRiderOwner ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                              <div className="flex items-center mb-2">
                                <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-semibold">
                                  <span>Already Assigned</span>
                                </span>
                              </div>
                              <div className="text-sm space-y-1">
                                <div>
                                  <span className="text-amber-700 font-semibold">Motorcycle:</span>
                                  <span className="ml-2 text-amber-900">{searchedRiderMotorcycle.registration_number}</span>
                                </div>
                                <div>
                                  <span className="text-amber-700 font-semibold">Owner:</span>
                                  <span className="ml-2 text-amber-900">{searchedRiderOwner.full_name}</span>
                                </div>
                                {searchedRider.owner_id !== ownerId && (
                                  <p className="text-xs text-amber-700 mt-2 font-semibold">
                                    This rider is assigned to another owner's motorcycle and cannot be reassigned.
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : searchedRider.assignment_status === 'Pending' ? (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                              <span className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                                <span>Pending Assignment</span>
                              </span>
                              <p className="text-xs text-blue-700 mt-2">
                                This rider has a pending assignment request.
                              </p>
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-3">
                              <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full text-xs font-semibold">
                                <span>Available</span>
                              </span>
                              <p className="text-xs text-emerald-700 mt-2">
                                This rider is available for assignment.
                              </p>
                            </div>
                          )}
                        </div>

                        {(!searchedRider.motorcycle_id || searchedRider.owner_id === ownerId) && (
                          <div className="border-t border-slate-200 pt-3 mt-3">
                            <label className="block text-sm font-semibold text-slate-600 mb-2">
                              Assign to Motorcycle
                            </label>
                            <select
                              value={selectedMotorcycleForAssignment || ''}
                              onChange={(e) => setSelectedMotorcycleForAssignment(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select a motorcycle</option>
                              {motorcycles.map((motorcycle) => (
                                <option key={motorcycle.id} value={motorcycle.id}>
                                  {motorcycle.registration_number}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="flex space-x-2 pt-3">
                          <button
                            onClick={handleAssignRider}
                            disabled={
                              !selectedMotorcycleForAssignment ||
                              (searchedRider.motorcycle_id !== null && searchedRider.owner_id !== ownerId)
                            }
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
                          >
                            Send Assignment Request
                          </button>
                          <button
                            onClick={() => {
                              setSearchedRider(null);
                              setSearchedRiderMotorcycle(null);
                              setSearchedRiderOwner(null);
                              setRiderSearchQuery('');
                              setSelectedMotorcycleForAssignment(null);
                              setSearchedRiderHistory([]);
                            }}
                            className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingRequestRider && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-2xl font-bold">Rider Details</h3>
              <button
                onClick={() => {
                  setViewingRequestRider(null);
                  setSelectedRequest(null);
                  setViewingRequestRiderHistory([]);
                }}
                className="text-white hover:bg-blue-700 p-2 rounded-lg transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Pending Request:</strong> You sent this assignment request for motorcycle <strong>{selectedRequest.motorcycle_registration}</strong> on {new Date(selectedRequest.requested_at).toLocaleString()}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-emerald-100 rounded-full p-2">
                    <User className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Rider Information</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Full Name</p>
                    <p className="font-semibold text-slate-900">{viewingRequestRider.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">ID Number</p>
                    <p className="font-semibold text-slate-900">{viewingRequestRider.id_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Phone Number</p>
                    <p className="font-semibold text-slate-900">{viewingRequestRider.phone_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">County Registration</p>
                    <p className="font-semibold text-slate-900">{viewingRequestRider.county_registration_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Stage Name</p>
                    <p className="font-semibold text-slate-900">{viewingRequestRider.stage_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Sacco ID</p>
                    <p className="font-semibold text-slate-900">{viewingRequestRider.sacco_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">BMS ID</p>
                    {viewingRequestRider.bms_id ? (
                      <BmsIdLink
                        bmsId={viewingRequestRider.bms_id}
                        riderName={viewingRequestRider.name}
                        idNumber={viewingRequestRider.id_number}
                        phoneNumber={viewingRequestRider.phone_number}
                        countyReg={viewingRequestRider.county_registration_number}
                        photoUrl={viewingRequestRider.photo_url}
                        className="font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-slate-400">Not Assigned</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Assignment Status</p>
                    <p className="font-semibold text-slate-900">{viewingRequestRider.assignment_status}</p>
                  </div>
                </div>
                {viewingRequestRider.photo_url && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-600 mb-2">Rider Photo</p>
                    <img
                      src={viewingRequestRider.photo_url}
                      alt="Rider"
                      className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200"
                    />
                  </div>
                )}
              </div>

              {viewingRequestRiderHistory.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-emerald-100 rounded-full p-2">
                      <DocumentValidatedIcon className="h-6 w-6 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Work History</h3>
                  </div>
                  <div className="space-y-4">
                    {viewingRequestRiderHistory.map((entry) => (
                      <div key={entry.id} className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <MotorcycleIcon className="h-5 w-5 text-emerald-600" />
                            <span className="font-bold text-slate-900">{entry.motorcycle_registration}</span>
                          </div>
                          {entry.removed_at ? (
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full font-semibold">
                              Terminated
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          <p><strong>Owner:</strong> {entry.owner_name}</p>
                          <p><strong>Contact:</strong> {entry.owner_phone}</p>
                          <p><strong>Assigned:</strong> {new Date(entry.assigned_at).toLocaleDateString()}</p>
                          {entry.removed_at && (
                            <>
                              <p><strong>Removed:</strong> {new Date(entry.removed_at).toLocaleDateString()}</p>
                              {entry.removal_reason && (
                                <p className="text-red-600"><strong>Reason:</strong> {entry.removal_reason}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4 border-t border-slate-200">
                <button
                  onClick={handleCancelRequest}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold flex items-center justify-center"
                >
                  <X className="h-5 w-5 mr-2" />
                  Cancel Request
                </button>
                <button
                  onClick={() => {
                    setViewingRequestRider(null);
                    setSelectedRequest(null);
                    setViewingRequestRiderHistory([]);
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRemovalModal && removalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-red-600 text-white px-6 py-4 rounded-t-2xl">
              <h3 className="text-2xl font-bold">Remove Rider from Motorcycle</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> You are about to remove <strong>{removalData.riderName}</strong> from motorcycle <strong>{removalData.motorcycleReg}</strong>. This action will terminate their assignment and they will be notified.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reason for Removal <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  placeholder="Please provide a reason for removing this rider..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  The rider will receive this message in their notification
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleRemoveRiderFromBike}
                  disabled={!removalReason.trim()}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Confirm Removal
                </button>
                <button
                  onClick={() => {
                    setShowRemovalModal(false);
                    setRemovalData(null);
                    setRemovalReason('');
                  }}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedIncident && (
        <IncidentCaseModal
          role="owner"
          incident={selectedIncident}
          initialTab={incidentModalTab}
          motorcycle={selectedIncident.motorcycle_id ? motorcycles.find(m => m.id === selectedIncident.motorcycle_id) ?? null : null}
          rider={selectedIncident.rider_id ? riders.find(r => r.id === selectedIncident.rider_id) ?? null : null}
          onClose={() => setSelectedIncident(null)}
          onRefresh={loadUserData}
        />
      )}

      {showPaymentModal && owner && (
        <PaymentModal
          userType="owner"
          userId={ownerId}
          userName={owner.full_name}
          onSuccess={(payment) => {
            setLastPayment(payment);
            setNextPaymentDue(`January 1, ${payment.payment_year + 1}`);
            setShowPaymentModal(false);
          }}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {receiptPayment && owner && (
        <PaymentReceiptModal
          payment={receiptPayment}
          payerName={owner.full_name}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {transferringMotorcycle && owner && (
        <BikeTransferModal
          motorcycle={transferringMotorcycle}
          currentOwner={owner}
          onClose={() => setTransferringMotorcycle(null)}
          onTransferred={() => {
            setTransferringMotorcycle(null);
            loadUserData();
          }}
        />
      )}

      {additionalBikePayment && owner && (
        <AdditionalBikePaymentModal
          ownerId={ownerId}
          ownerName={owner.full_name}
          registrationNumber=""
          onClose={() => setAdditionalBikePayment(false)}
          onSuccess={() => {
            setAdditionalBikePayment(false);
            setAdditionalBikePaid(true);
            setAddingMotorcycle(true);
          }}
        />
      )}
      </>)}

      {/* Tracking section — shown when bottom nav "Tracking" is tapped */}
      {activeSection === 'tracking' && !trackingMotorcycle && (
        <div className="p-4 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Track Your Motorcycles</h2>
          {motorcycles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <GpsBeaconIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No motorcycles registered yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {motorcycles.map((mc) => (
                <button
                  key={mc.id}
                  onClick={() => setTrackingMotorcycle(mc)}
                  className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition">
                      <GpsBeaconIcon className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-sm font-mono">{mc.registration_number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {mc.tracking_device_id ? 'Tracker connected' : 'No tracker'}
                      </p>
                    </div>
                    <Navigation className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-800 border-t border-slate-700 safe-area-pb shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <div className="flex items-stretch">
          {[
            { id: 'home' as const, label: 'Home', icon: <CommandCenterIcon className="h-5 w-5" /> },
            { id: 'motorcycles' as const, label: 'Bikes', icon: <MotorcycleIcon className="h-5 w-5" /> },
            { id: 'tracking' as const, label: 'Tracking', icon: <GpsBeaconIcon className="h-5 w-5" /> },
            { id: 'incidents' as const, label: 'Incidents', icon: <IncidentAlertIcon className="h-5 w-5" />, count: incidents.filter(i => i.status !== 'resolved').length || undefined },
            { id: 'profile' as const, label: 'Profile', icon: <User className="h-5 w-5" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
                setExpandedBikeId(null);
                setEditingOwner(false);
                setEditingMotorcycleId(null);
                setAddingMotorcycle(false);
                setSearchingRider(false);
                setShowRemovalModal(false);
                setSelectedIncident(null);
                setViewingRequestRider(null);
                setSelectedRequest(null);
                setPayingFine(null);
                setShowPaymentModal(false);
                setTransferringMotorcycle(null);
                setAdditionalBikePayment(false);
                if (item.id !== 'tracking') setTrackingMotorcycle(null);
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
