import { UserProfile, PatientContext } from '../types';

const PROFILE_KEY = 'medical_guide_profiles';
const ACTIVE_PROFILE_KEY = 'medical_guide_active_profile_id';

const DEFAULT_PROFILE: UserProfile = {
  id: 'default_me',
  name: '我自己',
  relation: 'Me',
  avatarColor: '#0d9488', // Teal
  context: { age: '', gender: '', condition: '' }
};

export const profileService = {
  getProfiles(): UserProfile[] {
    const stored = localStorage.getItem(PROFILE_KEY);
    if (!stored) {
      // Initialize with default
      this.saveProfiles([DEFAULT_PROFILE]);
      return [DEFAULT_PROFILE];
    }
    return JSON.parse(stored);
  },

  saveProfiles(profiles: UserProfile[]) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  },

  addProfile(name: string, relation: string, context: PatientContext): UserProfile {
    const profiles = this.getProfiles();
    const newProfile: UserProfile = {
      id: Date.now().toString(),
      name,
      relation,
      avatarColor: this.getRandomColor(),
      context
    };
    profiles.push(newProfile);
    this.saveProfiles(profiles);
    return newProfile;
  },

  updateProfile(id: string, updates: Partial<UserProfile>) {
    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.id === id);
    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updates };
      this.saveProfiles(profiles);
    }
    return profiles;
  },

  deleteProfile(id: string) {
    let profiles = this.getProfiles();
    profiles = profiles.filter(p => p.id !== id);
    if (profiles.length === 0) {
      profiles = [DEFAULT_PROFILE];
    }
    this.saveProfiles(profiles);
    return profiles;
  },

  getActiveProfileId(): string {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || DEFAULT_PROFILE.id;
  },

  setActiveProfileId(id: string) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  },

  getRandomColor() {
    const colors = ['#0d9488', '#2563eb', '#db2777', '#d97706', '#7c3aed', '#059669'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
};