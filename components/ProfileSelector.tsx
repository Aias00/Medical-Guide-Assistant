import React, { useState } from 'react';
import { UserProfile, Language } from '../types';
import { Plus, User, Edit2, Check, X, Trash2 } from 'lucide-react';
import { translations } from '../locales';
import { profileService } from '../services/profileService';

interface Props {
  profiles: UserProfile[];
  activeProfileId: string;
  onProfileChange: (id: string) => void;
  onProfilesUpdate: (profiles: UserProfile[]) => void;
  lang: Language;
}

const ProfileSelector: React.FC<Props> = ({ 
  profiles, 
  activeProfileId, 
  onProfileChange, 
  onProfilesUpdate, 
  lang 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  
  // Edit mode state
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{name: string, age: string, gender: string, condition: string}>({
    name: '', age: '', gender: '', condition: ''
  });

  const t = translations[lang];

  const handleCreate = () => {
    if (!newProfileName.trim()) return;
    const newProfile = profileService.addProfile(newProfileName, 'Family', {});
    onProfilesUpdate(profileService.getProfiles());
    onProfileChange(newProfile.id);
    setIsCreating(false);
    setNewProfileName('');
    // Open edit mode for the new profile to fill details
    startEditing(newProfile);
  };

  const startEditing = (profile: UserProfile) => {
    setEditingProfileId(profile.id);
    setEditForm({
      name: profile.name,
      age: profile.context.age || '',
      gender: profile.context.gender || '',
      condition: profile.context.condition || ''
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editingProfileId) {
      const updated = profileService.updateProfile(editingProfileId, {
        name: editForm.name,
        context: {
          age: editForm.age,
          gender: editForm.gender,
          condition: editForm.condition
        }
      });
      onProfilesUpdate(updated);
      setEditingProfileId(null);
      setIsEditing(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm(t.confirmClear)) { // Reuse confirm message or add new one
      const updated = profileService.deleteProfile(id);
      onProfilesUpdate(updated);
      if (activeProfileId === id) {
        onProfileChange(updated[0].id);
      }
      setEditingProfileId(null);
      setIsEditing(false);
    }
  };

  // View Mode: Horizontal Scroll List
  if (!isEditing && !isCreating) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t.userInfo}</label>
          <button 
            onClick={() => setIsCreating(true)}
            className="text-xs text-teal-600 font-medium flex items-center gap-1 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors"
          >
            <Plus size={14} /> {t.addProfile}
          </button>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {profiles.map(p => {
            const isActive = p.id === activeProfileId;
            return (
              <div 
                key={p.id}
                onClick={() => onProfileChange(p.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer min-w-[100px]
                  ${isActive 
                    ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-200' 
                    : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300'
                  }
                `}
              >
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                    ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}
                  `}
                  style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : p.avatarColor + '20', color: isActive ? 'white' : p.avatarColor }}
                >
                  {p.name.charAt(0)}
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{p.name}</span>
                {isActive && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); startEditing(p); }}
                    className="ml-auto p-1 rounded-full hover:bg-white/20"
                  >
                    <Edit2 size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Create Mode
  if (isCreating) {
    return (
      <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <h3 className="text-sm font-bold text-gray-800">{t.createProfileTitle}</h3>
        <input 
          autoFocus
          type="text" 
          placeholder={t.profileName}
          value={newProfileName}
          onChange={e => setNewProfileName(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <div className="flex gap-2">
          <button 
            onClick={handleCreate}
            disabled={!newProfileName.trim()}
            className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {t.save}
          </button>
          <button 
            onClick={() => setIsCreating(false)}
            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="bg-white p-4 rounded-xl border border-teal-100 shadow-sm space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Edit2 size={14} className="text-teal-500"/>
          {t.editProfile}
        </h3>
        {profiles.length > 1 && (
           <button onClick={() => handleDelete(editingProfileId!)} className="text-red-400 hover:text-red-600">
             <Trash2 size={16} />
           </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.profileName}</label>
          <input 
            type="text" 
            value={editForm.name}
            onChange={e => setEditForm({...editForm, name: e.target.value})}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.age}</label>
            <input 
              type="text" 
              value={editForm.age}
              onChange={e => setEditForm({...editForm, age: e.target.value})}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.gender}</label>
            <select 
              value={editForm.gender}
              onChange={e => setEditForm({...editForm, gender: e.target.value})}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{t.notSelected}</option>
              <option value="男">{t.male}</option>
              <option value="女">{t.female}</option>
            </select>
          </div>
        </div>
        <div>
           <label className="block text-xs text-gray-400 mb-1">{t.history}</label>
           <input 
              type="text" 
              placeholder={t.historyPlaceholder}
              value={editForm.condition}
              onChange={e => setEditForm({...editForm, condition: e.target.value})}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
          <button 
            onClick={saveEdit}
            className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
          >
            <Check size={16} /> {t.save}
          </button>
          <button 
            onClick={() => { setIsEditing(false); setEditingProfileId(null); }}
            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
          >
            <X size={16} /> {t.cancel}
          </button>
      </div>
    </div>
  );
};

export default ProfileSelector;