import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { changeUserPassword, fetchUserProfile, updateUser } from '../services/userService';
import { fetchDocuments, uploadDocument, getDocumentUrl } from '../services/documentService';

export default function ProfilePage() {
  const { user, settings, replaceUser } = useAuth();
  const [profile, setProfile] = useState(user);
  const [balances, setBalances] = useState([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoMessageTone, setPhotoMessageTone] = useState('success');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordMessageTone, setPasswordMessageTone] = useState('success');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    positionTitle: '',
    gender: ''
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordVisibility, setPasswordVisibility] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [passwordModal, setPasswordModal] = useState({ open: false, tone: 'success', message: '' });
  const canEditFullProfile = user?.role === 'ceo';
  const isProfileEditable = isEditingProfile;
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    fetchUserProfile(user.id)
      .then((data) => {
        setProfile(data.user);
        setBalances(data.leaveBalances || []);
        setForm({
          firstName: data.user.firstName || '',
          lastName: data.user.lastName || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          positionTitle: data.user.positionTitle || '',
          gender: data.user.gender || ''
        });
        setIsEditingProfile(false);
      })
      .catch(console.error);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setProfilePhotoUrl('');
      return;
    }

    const load = () => {
      fetchDocuments({ userId: user.id })
        .then((documents) => {
          const photo = documents.find((doc) => doc.folderType === 'profile');
          setProfilePhotoUrl(photo ? getDocumentUrl(photo.id, true) : '');
        })
        .catch(() => setProfilePhotoUrl(''));
    };

    load();
    window.addEventListener('documents-seen-updated', load);
    return () => window.removeEventListener('documents-seen-updated', load);
  }, [user?.id]);

  const visibleBalances = useMemo(
    () => balances.filter((item) => {
      if (item.code === 'maternity') {
        return profile?.gender === 'female';
      }

      if (item.code === 'paternity') {
        return profile?.gender === 'male';
      }

      return true;
    }),
    [balances, profile?.gender]
  );

  const totalBalance = useMemo(
    () => visibleBalances
      .filter((item) => !['maternity', 'paternity'].includes(item.code))
      .reduce((sum, item) => sum + Number(item.balanceDays || 0), 0),
    [visibleBalances]
  );

  const roleValue = profile?.roleTitle || (profile?.role ? profile.role.toUpperCase() : '');
  const activeLeaveTypes = visibleBalances.filter((item) => !['maternity', 'paternity'].includes(item.code)).length;
  const profileHasChanges = useMemo(() => {
    if (canEditFullProfile) {
      return (
        form.firstName !== (profile?.firstName || '')
        || form.lastName !== (profile?.lastName || '')
        || form.email !== (profile?.email || '')
        || form.phone !== (profile?.phone || '')
        || form.positionTitle !== (profile?.positionTitle || '')
        || form.gender !== (profile?.gender || '')
      );
    }

    return form.phone !== (profile?.phone || '');
  }, [canEditFullProfile, form, profile]);

  const hasUnsavedChanges = useMemo(
    () => profileHasChanges || Boolean(passwordForm.currentPassword || passwordForm.newPassword || passwordForm.confirmPassword),
    [passwordForm, profileHasChanges]
  );

  useUnsavedChangesGuard(hasUnsavedChanges);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = canEditFullProfile
        ? form
        : { phone: form.phone };
      const updated = await updateUser(user.id, payload);
      setProfile(updated);
      replaceUser(updated);
      setForm({
        firstName: updated.firstName || '',
        lastName: updated.lastName || '',
        email: updated.email || '',
        phone: updated.phone || '',
        positionTitle: updated.positionTitle || '',
        gender: updated.gender || ''
      });
      setIsEditingProfile(false);
      setMessageTone('success');
      setMessage('Profile updated successfully.');
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to update your profile right now.');
    }
  };

  const handleUploadProfilePhoto = async (event) => {
    const file = event.target.files?.[0];
    try {
      setPhotoMessage('');
      setPhotoMessageTone('success');
      if (!file) return;
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        setPhotoMessageTone('error');
        setPhotoMessage('Please upload a JPG, PNG, or WEBP image.');
        return;
      }
      const doc = await uploadDocument({ file, folderType: 'profile' });
      setProfilePhotoUrl(getDocumentUrl(doc.id, true));
      setPhotoMessageTone('success');
      setPhotoMessage('Profile photo uploaded successfully.');
    } catch (error) {
      setPhotoMessageTone('error');
      setPhotoMessage(error.response?.data?.message || 'Unable to upload your profile photo.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessageTone('error');
      setPasswordMessage('New password and confirmation do not match.');
      return;
    }

    if (String(passwordForm.newPassword || '').length < 8) {
      setPasswordMessageTone('error');
      setPasswordMessage('New password must be at least 8 characters.');
      return;
    }

    try {
      const result = await changeUserPassword(user.id, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessageTone('success');
      setPasswordMessage(result.message || 'Password changed successfully.');
      setPasswordModal({ open: true, tone: 'success', message: result.message || 'Password changed successfully.' });
    } catch (error) {
      setPasswordMessageTone('error');
      const msg = error.response?.data?.message || 'Unable to change your password right now.';
      setPasswordMessage(msg);
      setPasswordModal({ open: true, tone: 'error', message: msg });
    }
  };

  const handleStartEditing = () => {
    setMessage('');
    setIsEditingProfile(true);
  };

  const handleCancelEditing = () => {
    setForm({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      positionTitle: profile?.positionTitle || '',
      gender: profile?.gender || ''
    });
    setMessage('');
    setIsEditingProfile(false);
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((current) => ({ ...current, [field]: !current[field] }));
  };

  return (
    <div className="space-y-6">
      <Modal
        open={passwordModal.open}
        title={passwordModal.tone === 'error' ? 'Password not changed' : 'Password changed'}
        description={passwordModal.message}
        onClose={() => setPasswordModal((current) => ({ ...current, open: false }))}
        actions={[
          <button
            key="close"
            type="button"
            className={`rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${passwordModal.tone === 'error' ? 'bg-rose-600' : 'bg-brand-gradient'}`}
            onClick={() => setPasswordModal((current) => ({ ...current, open: false }))}
          >
            Close
          </button>
        ]}
      />
      <PageHeader title={settings?.labels?.profileModuleTitle || 'My Profile'} subtitle={settings?.labels?.profileSubtitle || 'Employees can update contact details such as phone number. Identity and role information is managed by supervisors, IT Officer, or CEO.'} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Role" value={roleValue || '--'} helper="Access level currently assigned" />
        <StatCard title="Department" value={profile?.departmentName || 'Not assigned'} helper="Current department mapping" accent="from-blue-700 to-cyan-500" />
        <StatCard title="Remaining Leave Days" value={totalBalance} helper="Combined tracked leave balance" accent="from-violet-700 to-fuchsia-500" />
        <StatCard title="Tracked Leave Types" value={activeLeaveTypes} helper="Active leave balances visible to you" accent="from-amber-500 to-orange-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr),minmax(320px,1fr)]">
        <SectionCard title="Personal information" subtitle="Changes are stored securely and governed by backend permissions." actions={[
          isEditingProfile ? (
            <button key="cancel-edit" type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={handleCancelEditing}>
              Cancel edit
            </button>
          ) : (
            <button key="start-edit" type="button" className="rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-lg" onClick={handleStartEditing}>
              <span className="inline-flex items-center gap-2"><Pencil size={16} />Edit</span>
            </button>
          )
        ]}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">First name</label>
              <input value={form.firstName} disabled className="cursor-not-allowed bg-slate-100 text-slate-500" onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Last name</label>
              <input value={form.lastName} disabled className="cursor-not-allowed bg-slate-100 text-slate-500" onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" value={form.email} disabled className="cursor-not-allowed bg-slate-100 text-slate-500" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
              <input inputMode="numeric" value={form.phone} disabled={!isProfileEditable} className={!isProfileEditable ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '') }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Gender</label>
              <select value={form.gender} disabled className="cursor-not-allowed bg-slate-100 text-slate-500" onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">Position title</label>
              <input value={form.positionTitle} disabled className="cursor-not-allowed bg-slate-100 text-slate-500" onChange={(event) => setForm((current) => ({ ...current, positionTitle: event.target.value }))} />
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              {isEditingProfile ? (
                <button type="submit" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg">
                  Save profile
                </button>
              ) : null}
              {message ? <span className={`text-sm ${messageTone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{message}</span> : null}
            </div>
          </form>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Profile photo" subtitle="Upload your profile photo. This will appear on the top-right profile chip only.">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-200">
                {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Profile" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadProfilePhoto} />
                <button type="button" className="rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-lg" onClick={() => {
                  if (profilePhotoUrl && !window.confirm('Change the current profile picture?')) {
                    return;
                  }
                  fileInputRef.current?.click();
                }}>{profilePhotoUrl ? 'Change profile' : 'Upload photo'}</button>
                {photoMessage ? <span className={`text-sm ${photoMessageTone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{photoMessage}</span> : null}
              </div>
            </div>
          </SectionCard>
          {user?.role !== 'ceo' ? (
            <SectionCard title="Leave balances" subtitle="Live policy balances pulled from PostgreSQL.">
              <div className="space-y-3">
                {visibleBalances.map((balance) => (
                  <div key={balance.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-800">{balance.label}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{balance.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">{balance.balanceDays}</p>
                        <p className="text-xs text-slate-500">Used {balance.usedDays}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Change password" subtitle="Update your account password securely.">
              <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Current password</label>
                  <div className="relative">
                    <input type={passwordVisibility.currentPassword ? 'text' : 'password'} className="pr-12" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
                    <button type="button" onClick={() => togglePasswordVisibility('currentPassword')} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      {passwordVisibility.currentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">New password</label>
                  <div className="relative">
                    <input type={passwordVisibility.newPassword ? 'text' : 'password'} className="pr-12" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
                    <button type="button" onClick={() => togglePasswordVisibility('newPassword')} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      {passwordVisibility.newPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Confirm new password</label>
                  <div className="relative">
                    <input type={passwordVisibility.confirmPassword ? 'text' : 'password'} className="pr-12" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
                    <button type="button" onClick={() => togglePasswordVisibility('confirmPassword')} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      {passwordVisibility.confirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg">
                    Change password
                  </button>
                  {passwordMessage ? <span className={`text-sm ${passwordMessageTone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{passwordMessage}</span> : null}
                </div>
              </form>
            </SectionCard>
        </div>
      </div>
    </div>
  );
}
