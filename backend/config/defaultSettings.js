module.exports = {
  branding: {
    organizationName: 'KEREA',
    appName: 'KEREA HRMS',
    logoText: 'KH',
    faviconUrl: '',
    primaryColor: '#166534',
    secondaryColor: '#22c55e',
    accentColor: '#86efac',
    backgroundColor: '#f4fbf6',
    cardColor: '#ffffff',
    textColor: '#0f172a',
    gradientFrom: '#14532d',
    gradientTo: '#22c55e',
    useDesktopColorsOnMobile: true,
    mobilePrimaryColor: '#166534',
    mobileSecondaryColor: '#22c55e',
    mobileAccentColor: '#86efac',
    mobileBackgroundColor: '#f4fbf6',
    mobileCardColor: '#ffffff',
    mobileTextColor: '#0f172a',
    mobileGradientFrom: '#14532d',
    mobileGradientTo: '#22c55e',
    mobileMenuGradientFrom: '#14532d',
    mobileMenuGradientTo: '#22c55e',
    mobileMenuOpenBackgroundColor: '#ffffff',
    mobileMenuOpenTextColor: '#475569',
    mobileMenuOpenBorderColor: '#e2e8f0',
    mobileMenuCloseBackgroundColor: 'rgba(255,255,255,0.1)',
    mobileMenuCloseTextColor: '#ffffff',
    mobileMenuCloseBorderColor: 'rgba(255,255,255,0.1)'
  },
  labels: {
    employeeDirectoryTitle: 'Employees',
    employeeDirectorySubtitle: 'Manage employee records and staff.',
    leaveModuleTitle: 'Leave Management',
    documentsModuleTitle: 'Document Center',
    profileModuleTitle: 'My Profile',
    dashboardWelcome: 'Welcome back',
    dashboardTitleSuffix: 'Dashboard',
    dashboardQuickActionsTitle: 'Quick actions',
    dashboardQuickActionsSubtitle: 'Jump straight into the areas you use most often.',
    dashboardOpenLeavesText: 'Open leave dashboard',
    dashboardOpenProfileText: 'Review my profile',
    dashboardOpenEmployeesText: 'Manage employees',
    dashboardOpenDocumentsText: 'Open documents',
    loginPortalLabel: '',
    loginTitle: 'Sign in to KEREA HRMS',
    loginSubtitle: 'Sign in to your account',
    loginEmailLabel: 'Email',
    loginPasswordLabel: 'Password',
    loginEmailPlaceholder: 'name@kerea.local',
    loginPasswordPlaceholder: 'Enter password',
    loginButtonText: 'Login',
    loginFooterText: '2026 KEREA. All rights reserved.',
    profileSubtitle: 'Employees can update contact details such as phone number. Identity and role information is managed by supervisors, Admin, or CEO.',
    documentsSubtitle: 'Structured employee folders are secured behind authenticated download and preview endpoints.',
    navigationDashboard: 'Dashboard',
    navigationEmployees: 'Employees',
    navigationLeaves: 'Leave Management',
    navigationDocuments: 'Documents',
    navigationSettings: 'Settings',
    navigationAudit: 'Audit Logs'
  },
  interface: {
    dashboardHeroTitle: 'Workforce Management System',
    dashboardHeroSubtitle: 'Secure intranet experience for employees, supervisors, executives, and administrators.',
    loginHeroTitle: '',
    loginHeroSubtitle: '',
    loginHighlights: '',
    showAnnouncements: true,
    showLeaveCalendar: true,
    showDocumentPreview: true,
    loginShapesEnabled: true,
    loginShapesOpacity: 0.85,
    loginShapesPrimaryColor: '#f97316',
    loginShapesSecondaryColor: '#ffffff',
    loginShapesStyle: 'diagonal',
    loginShapesAnimated: true,
    sidebarCollapsedByDefault: false,
    mobileMenuAnimationEnabled: true,
    mobileMenuAnimationType: 'slide',
    mobileMenuAnimationDurationMs: 260,
    pageExperience: {
      dashboard: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
      employees: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
      profile: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
      documents: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
      leave: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
      login: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
      settings: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
      kpi: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
      performance: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 }
    },
    // Background configuration: separate images for Original vs Redesigned UI, optional per-page overrides, and global opacity
    backgrounds: {
      original: {
        defaultImageUrl: '',
        perPage: {
          dashboard: '',
          employees: '',
          profile: '',
          documents: '',
          leave: '',
          settings: '',
          audit: '',
          kpi: '',
          performance: ''
        }
      },
      redesigned: {
        defaultImageUrl: '',
        perPage: {
          dashboard: '',
          employees: '',
          profile: '',
          documents: '',
          leave: '',
          settings: '',
          audit: '',
          kpi: '',
          performance: ''
        }
      },
      imageOpacity: 1
    },
    // Active navigation item color (e.g., a warm yellow)
    navigationActiveColor: '#fef08a',
    // Legacy non-card text color (no longer applied globally)
    nonCardTextColor: '' ,
    // Per-page page header colors
    pageHeaderColors: {
      dashboard: { title: '', subtitle: '' },
      employees: { title: '', subtitle: '' },
      profile: { title: '', subtitle: '' },
      documents: { title: '', subtitle: '' },
      leave: { title: '', subtitle: '' },
      settings: { title: '', subtitle: '' },
      audit: { title: '', subtitle: '' },
      kpi: { title: '', subtitle: '' },
      performance: { title: '', subtitle: '' }
    },
    // Menu background blur configuration
    navigationBlur: {
      mobile: { enabled: false, blurPx: 0 },
      desktop: { enabled: false, blurPx: 0 }
    },
    uiVariant: {
      active: 'original',
      applyTo: 'all',
      redesignedTheme: {
        backgroundImageUrl: '',
        overlayColor: '#0b2e13',
        overlayOpacity: 0.45,
        sidebarGradientFrom: '#14532d',
        sidebarGradientTo: '#22c55e',
        glassCardColor: '#ffffff',
        glassCardOpacity: 0.18,
        glassBlurPx: 14,
        cardTextColor: '#0f172a'
      }
    }
  },
  navigation: {
    employee: ['dashboard', 'profile', 'leaves', 'documents'],
    supervisor: ['dashboard', 'employees', 'profile', 'leaves', 'documents'],
    admin: ['dashboard', 'employees', 'profile', 'leaves', 'documents', 'settings', 'audit'],
    ceo: ['dashboard', 'employees', 'profile', 'leaves', 'documents', 'settings']
  },
  departments: [
    { name: 'Executive Office', description: 'Executive leadership team' },
    { name: 'Finance', description: 'Accounting and reporting' },
    { name: 'Operations', description: 'Operational delivery' },
    { name: 'Marketing', description: 'Marketing and communications' }
  ],
  roleTitles: [
    { value: 'Employee' }
  ],
  folders: [
    { code: 'id', label: 'ID' },
    { code: 'contracts', label: 'Contracts' },
    { code: 'certificates', label: 'Certificates' },
    { code: 'addendum', label: 'Addendum' },
    { code: 'branding', label: 'Branding' },
    { code: 'profile', label: 'Profile Photos' },
    { code: 'other', label: 'Other' }
  ],
  documentCategories: [
    {
      code: 'personal',
      label: 'Personal Documents',
      types: [
        { code: 'id', label: 'National ID' },
        { code: 'passport', label: 'Passport' },
        { code: 'driver_license', label: 'Driver License' }
      ]
    },
    {
      code: 'academic',
      label: 'Academic Certificates',
      types: [
        { code: 'degree', label: 'Degree Certificate' },
        { code: 'diploma', label: 'Diploma' },
        { code: 'transcript', label: 'Transcript' }
      ]
    },
    {
      code: 'statutory',
      label: 'Statutory Documents',
      types: [
        { code: 'nhif', label: 'NHIF' },
        { code: 'nssf', label: 'NSSF' },
        { code: 'kra_pin', label: 'KRA PIN' }
      ]
    },
    {
      code: 'employment',
      label: 'Employment',
      types: [
        { code: 'offer_letter', label: 'Offer Letter' },
        { code: 'contract', label: 'Contract Letter' },
        { code: 'warning', label: 'Warning Letter' }
      ]
    },
    {
      code: 'addendum',
      label: 'Addendum',
      types: [
        { code: 'addendum', label: 'Addendum' }
      ]
    }
  ],
  kpi: {
    records: {},
    performanceBands: {
      pendingLabel: 'Pending',
      outstanding: { label: 'Outstanding', minScore: 85 },
      strong: { label: 'Strong', minScore: 70 },
      developing: { label: 'Developing', minScore: 50 },
      needsSupport: { label: 'Needs support', minScore: 0 }
    }
  },
  leaveTypes: [
    { code: 'annual', label: 'Annual Leave', defaultDays: 21, requiresCeoApproval: false, isPaid: true, requiresDocument: false, canCarryForward: true },
    { code: 'sick', label: 'Sick Leave', defaultDays: 14, requiresCeoApproval: false, isPaid: true, requiresDocument: false, canCarryForward: false },
    { code: 'maternity', label: 'Maternity Leave', defaultDays: 90, requiresCeoApproval: true, isPaid: true, requiresDocument: false, canCarryForward: false },
    { code: 'paternity', label: 'Paternity Leave', defaultDays: 14, requiresCeoApproval: true, isPaid: true, requiresDocument: false, canCarryForward: false }
  ]
};
