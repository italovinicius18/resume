import type { Profile } from './schema';

export const PROFILE: Profile = process.env.PROFILE === 'software' ? 'software' : 'data';

export const SITES: Record<Profile, string> = {
  data: 'https://data.italoguimaraes.dev',
  software: 'https://software.italoguimaraes.dev',
};

export const OTHER: Record<Profile, Profile> = { data: 'software', software: 'data' };
