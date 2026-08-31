import { useState, useEffect, useRef, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import RegistrationChoice from './components/RegistrationChoice';
import RegistrationForm from './components/RegistrationForm';
import RegistrationSuccess from './components/RegistrationSuccess';
import VerificationPage from './components/VerificationPage';
import ReportIncidentPage from './components/ReportIncidentPage';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import UserLogin from './components/UserLogin';
import UserDashboard from './components/UserDashboard';
import RiderRegistration from './components/RiderRegistration';
import RiderLogin from './components/RiderLogin';
import RiderDashboard from './components/RiderDashboard';
import PoliceLogin from './components/PoliceLogin';
import PoliceDashboard from './components/PoliceDashboard';
import FieldRegistration from './pages/FieldRegistration';
import { loadGoogleMaps } from './lib/googleMaps';
import type { SystemUserWithRole, PoliceOfficerWithStation } from './lib/supabase';

type Page = 'home' | 'registration-choice' | 'register' | 'success' | 'verify' | 'report-incident' | 'admin' | 'admin-dashboard' | 'user-login' | 'user-dashboard' | 'rider-registration' | 'rider-login' | 'rider-dashboard' | 'police' | 'police-dashboard' | 'field-register';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const INACTIVITY_CHECK_INTERVAL_MS = 30 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivityAt';
const SESSION_EXPIRES_KEY = 'sessionExpiresAt';
const SESSION_TTL_DEFAULT = 2 * 60 * 60 * 1000;
const SESSION_TTL_REMEMBER = 30 * 24 * 60 * 60 * 1000;

const NAVIGABLE_PAGES: Page[] = [
  'home', 'registration-choice', 'register', 'verify', 'report-incident',
  'admin', 'admin-dashboard',
  'user-login', 'user-dashboard',
  'rider-registration', 'rider-login', 'rider-dashboard',
  'police', 'police-dashboard',
  'field-register',
];

function normalizePageValue(raw: string | null | undefined): Page | null {
  if (!raw) return null;
  if (raw === 'police-login') return 'police';
  if (raw === 'admin-login') return 'admin';
  return (NAVIGABLE_PAGES as string[]).includes(raw) ? (raw as Page) : null;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    return normalizePageValue(localStorage.getItem('currentPage')) || 'home';
  });
  const [qrCode, setQrCode] = useState(() => localStorage.getItem('qrCode') || '');
  const [uniqueId, setUniqueId] = useState(() => localStorage.getItem('uniqueId') || '');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return sessionStorage.getItem('isAdminLoggedIn') === 'true';
  });
  const [currentAdminUser, setCurrentAdminUser] = useState<SystemUserWithRole | null>(() => {
    try {
      const stored = sessionStorage.getItem('currentAdminUser');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error parsing currentAdminUser from sessionStorage:', error);
      sessionStorage.removeItem('currentAdminUser');
      return null;
    }
  });
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(() => {
    return localStorage.getItem('isUserLoggedIn') === 'true';
  });
  const [currentOwnerId, setCurrentOwnerId] = useState(() => {
    return localStorage.getItem('currentOwnerId') || '';
  });
  const [verificationId, setVerificationId] = useState<string | undefined>(undefined);
  const [isRiderLoggedIn, setIsRiderLoggedIn] = useState(() => {
    return localStorage.getItem('isRiderLoggedIn') === 'true';
  });
  const [currentRiderId, setCurrentRiderId] = useState(() => {
    return localStorage.getItem('currentRiderId') || '';
  });
  const [isPoliceLoggedIn, setIsPoliceLoggedIn] = useState(() => {
    return localStorage.getItem('isPoliceLoggedIn') === 'true';
  });
  const [currentPoliceOfficer, setCurrentPoliceOfficer] = useState<PoliceOfficerWithStation | null>(() => {
    try {
      const stored = localStorage.getItem('currentPoliceOfficer');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('currentPoliceOfficer');
      return null;
    }
  });

  useEffect(() => {
    // Migrate any stale admin session from localStorage to force re-login via OTP
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.removeItem('currentAdminUser');

    const path = window.location.pathname;
    const hash = window.location.hash.replace('#', '');

    if (path.startsWith('/verify/')) {
      const id = path.split('/verify/')[1];
      if (id) {
        setVerificationId(id);
        setCurrentPage('verify');
        return;
      }
    }

    // Restore page from hash if it is a valid, navigable page.
    // Authenticated-only pages are allowed here because the auth gates in
    // the render tree will redirect to the login screen if credentials are absent.
    const hashPage = normalizePageValue(hash);
    if (hashPage) {
      setCurrentPage(hashPage);
    } else if (hash) {
      // Unknown/legacy hash — clear it so the user isn't stuck on a blank screen.
      window.location.hash = '';
    }

    if (isAdminLoggedIn && !currentAdminUser) {
      console.warn('Admin logged in but no user data found, clearing session');
      sessionStorage.removeItem('isAdminLoggedIn');
      sessionStorage.removeItem('currentAdminUser');
      setIsAdminLoggedIn(false);
      setCurrentAdminUser(null);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);
    window.location.hash = currentPage;
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('qrCode', qrCode);
  }, [qrCode]);

  useEffect(() => {
    localStorage.setItem('uniqueId', uniqueId);
  }, [uniqueId]);

  useEffect(() => {
    sessionStorage.setItem('isAdminLoggedIn', isAdminLoggedIn.toString());
  }, [isAdminLoggedIn]);

  useEffect(() => {
    if (currentAdminUser) {
      sessionStorage.setItem('currentAdminUser', JSON.stringify(currentAdminUser));
    } else {
      sessionStorage.removeItem('currentAdminUser');
    }
  }, [currentAdminUser]);

  useEffect(() => {
    localStorage.setItem('isUserLoggedIn', isUserLoggedIn.toString());
  }, [isUserLoggedIn]);

  useEffect(() => {
    localStorage.setItem('currentOwnerId', currentOwnerId);
  }, [currentOwnerId]);

  useEffect(() => {
    localStorage.setItem('isRiderLoggedIn', isRiderLoggedIn.toString());
  }, [isRiderLoggedIn]);

  useEffect(() => {
    localStorage.setItem('currentRiderId', currentRiderId);
  }, [currentRiderId]);

  useEffect(() => {
    localStorage.setItem('isPoliceLoggedIn', isPoliceLoggedIn.toString());
  }, [isPoliceLoggedIn]);

  useEffect(() => {
    if (currentPoliceOfficer) {
      localStorage.setItem('currentPoliceOfficer', JSON.stringify(currentPoliceOfficer));
    } else {
      localStorage.removeItem('currentPoliceOfficer');
    }
  }, [currentPoliceOfficer]);

  const handleNavigate = (page: string, riderId?: string) => {
    setCurrentPage(page as Page);
    if (page === 'verify') {
      setVerificationId(undefined);
    }
    if (page === 'rider-dashboard' && riderId) {
      setCurrentRiderId(riderId);
      setIsRiderLoggedIn(true);
      if (!localStorage.getItem(SESSION_EXPIRES_KEY)) {
        startSession(false);
      }
    }
  };

  const handleRegistrationComplete = (qrCodeData: string, id: string) => {
    setQrCode(qrCodeData);
    setUniqueId(id);
    setCurrentPage('success');
  };

  const startSession = (rememberMe: boolean) => {
    const ttl = rememberMe ? SESSION_TTL_REMEMBER : SESSION_TTL_DEFAULT;
    localStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + ttl));
  };

  const handleAdminLogin = (user: SystemUserWithRole) => {
    startSession(false);
    setIsAdminLoggedIn(true);
    setCurrentAdminUser(user);
    setCurrentPage('admin-dashboard');
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setCurrentAdminUser(null);
    setCurrentPage('admin');
    sessionStorage.removeItem('isAdminLoggedIn');
    sessionStorage.removeItem('currentAdminUser');
    localStorage.removeItem(SESSION_EXPIRES_KEY);
  };

  const handleUserLogin = (ownerId: string, rememberMe?: boolean) => {
    startSession(!!rememberMe);
    setIsUserLoggedIn(true);
    setCurrentOwnerId(ownerId);
    setCurrentPage('user-dashboard');
  };

  const handleUserLogout = () => {
    setIsUserLoggedIn(false);
    setCurrentOwnerId('');
    setCurrentPage('user-login');
    localStorage.removeItem('isUserLoggedIn');
    localStorage.removeItem('currentOwnerId');
    localStorage.removeItem(SESSION_EXPIRES_KEY);
  };

  const handleRiderLogout = () => {
    setIsRiderLoggedIn(false);
    setCurrentRiderId('');
    setCurrentPage('rider-login');
    localStorage.removeItem('isRiderLoggedIn');
    localStorage.removeItem('currentRiderId');
    localStorage.removeItem(SESSION_EXPIRES_KEY);
  };

  const handlePoliceLogin = (officer: PoliceOfficerWithStation, rememberMe?: boolean) => {
    startSession(!!rememberMe);
    setIsPoliceLoggedIn(true);
    setCurrentPoliceOfficer(officer);
    setCurrentPage('police-dashboard');
  };

  const handlePoliceLogout = () => {
    setIsPoliceLoggedIn(false);
    setCurrentPoliceOfficer(null);
    setCurrentPage('police');
    localStorage.removeItem('isPoliceLoggedIn');
    localStorage.removeItem('currentPoliceOfficer');
    localStorage.removeItem(SESSION_EXPIRES_KEY);
  };

  const anyLoggedIn = isAdminLoggedIn || isUserLoggedIn || isRiderLoggedIn || isPoliceLoggedIn;

  useEffect(() => {
    if (anyLoggedIn) {
      loadGoogleMaps().catch(() => {});
    }
  }, [anyLoggedIn]);

  const expireAllSessions = useCallback(() => {
    if (isAdminLoggedIn) handleAdminLogout();
    if (isUserLoggedIn) handleUserLogout();
    if (isRiderLoggedIn) handleRiderLogout();
    if (isPoliceLoggedIn) handlePoliceLogout();
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_EXPIRES_KEY);
  }, [isAdminLoggedIn, isUserLoggedIn, isRiderLoggedIn, isPoliceLoggedIn]);

  const expireRef = useRef(expireAllSessions);
  useEffect(() => {
    expireRef.current = expireAllSessions;
  }, [expireAllSessions]);

  useEffect(() => {
    if (!anyLoggedIn) return;

    const now = Date.now();

    const expiresAt = Number(localStorage.getItem(SESSION_EXPIRES_KEY));
    if (expiresAt && now > expiresAt) {
      expireRef.current();
      return;
    }

    const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    if (stored && now - stored > INACTIVITY_TIMEOUT_MS) {
      expireRef.current();
      return;
    }
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));

    const touch = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel',
    ];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
      if (last && Date.now() - last > INACTIVITY_TIMEOUT_MS) {
        expireRef.current();
      } else {
        touch();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const interval = window.setInterval(() => {
      const n = Date.now();
      const exp = Number(localStorage.getItem(SESSION_EXPIRES_KEY));
      if (exp && n > exp) {
        expireRef.current();
        return;
      }
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
      if (!last || n - last > INACTIVITY_TIMEOUT_MS) {
        expireRef.current();
      }
    }, INACTIVITY_CHECK_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [anyLoggedIn]);

  return (
    <>
      {currentPage === 'home' && <LandingPage onNavigate={handleNavigate} />}

      {currentPage === 'registration-choice' && (
        <RegistrationChoice onNavigate={handleNavigate} />
      )}

      {currentPage === 'register' && (
        <RegistrationForm
          onNavigate={handleNavigate}
          onComplete={handleRegistrationComplete}
        />
      )}

      {currentPage === 'success' && (
        <RegistrationSuccess
          qrCode={qrCode}
          uniqueId={uniqueId}
          onNavigate={handleNavigate}
        />
      )}

      {currentPage === 'verify' && (
        <VerificationPage
          onNavigate={handleNavigate}
          initialQrId={verificationId}
        />
      )}

      {currentPage === 'report-incident' && (
        <ReportIncidentPage onNavigate={handleNavigate} />
      )}

      {(currentPage === 'admin' || (currentPage === 'admin-dashboard' && (!isAdminLoggedIn || !currentAdminUser))) && !isAdminLoggedIn && (
        <AdminLogin
          onNavigate={handleNavigate}
          onLoginSuccess={handleAdminLogin}
        />
      )}

      {(currentPage === 'admin-dashboard' || currentPage === 'admin') && isAdminLoggedIn && currentAdminUser && (
        <AdminDashboard currentUser={currentAdminUser} onLogout={handleAdminLogout} />
      )}

      {(currentPage === 'user-login' || (currentPage === 'user-dashboard' && !isUserLoggedIn)) && !isUserLoggedIn && (
        <UserLogin
          onNavigate={handleNavigate}
          onLoginSuccess={(ownerId, rememberMe) => handleUserLogin(ownerId, rememberMe)}
        />
      )}

      {currentPage === 'user-dashboard' && isUserLoggedIn && (
        <UserDashboard
          ownerId={currentOwnerId}
          onNavigate={handleNavigate}
          onLogout={handleUserLogout}
        />
      )}

      {currentPage === 'rider-registration' && (
        <RiderRegistration onNavigate={handleNavigate} />
      )}

      {(currentPage === 'rider-login' || (currentPage === 'rider-dashboard' && !isRiderLoggedIn)) && !isRiderLoggedIn && (
        <RiderLogin onNavigate={handleNavigate} onRememberLogin={startSession} />
      )}

      {currentPage === 'rider-dashboard' && isRiderLoggedIn && (
        <RiderDashboard
          riderId={currentRiderId}
          onNavigate={handleNavigate}
          onLogout={handleRiderLogout}
        />
      )}

      {(currentPage === 'police' || (currentPage === 'police-dashboard' && !isPoliceLoggedIn)) && !isPoliceLoggedIn && (
        <PoliceLogin
          onNavigate={handleNavigate}
          onLoginSuccess={(officer, rememberMe) => handlePoliceLogin(officer, rememberMe)}
        />
      )}

      {currentPage === 'police-dashboard' && isPoliceLoggedIn && currentPoliceOfficer && (
        <PoliceDashboard
          officer={currentPoliceOfficer}
          onLogout={handlePoliceLogout}
        />
      )}

      {currentPage === 'field-register' && (
        <FieldRegistration onNavigate={handleNavigate} />
      )}
    </>
  );
}

export default App;
