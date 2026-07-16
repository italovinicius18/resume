import type { Profile } from './schema';

export const PROFILE: Profile = process.env.PROFILE === 'software' ? 'software' : 'data';

export const SITES: Record<Profile, string> = {
  data: 'https://data.italoguimaraes.com',
  software: 'https://software.italoguimaraes.com',
};

export const OTHER: Record<Profile, Profile> = { data: 'software', software: 'data' };
