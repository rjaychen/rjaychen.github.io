// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const identity = {
  name: 'Ryan J. Chen',
  title: 'Software Engineer · Embracing the Pursuit of Knowledge',
  tagline: 'ECE/CS @ Duke · CG, XR, Geometry',
  summary:
    'My interests lie in Geometry, Graphics, Vision, and Mixed Reality. I want to build technology that can be applied to health to improve the human experience. My background lies in BME, EE, and CS, featuring signal processing research with EEG signals, AR Development in Unity, and Swift development in visionOS.',
  github: 'https://github.com/rjaychen',
  linkedIn: 'https://www.linkedin.com/in/ryanjaychen',
  googleScholar: 'https://scholar.google.com/citations?user=vrnGdhwAAAAJ',
};

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export type SkillId =
  | 'swift'
  | 'unity'
  | 'csharp'
  | 'python'
  | 'cpp'
  | 'aws'
  | 'realitykit'
  | 'visionos'
  | 'testing'
  | 'geometry'
  | 'matlab';

export type SkillDef = { id: SkillId; label: string };

/** Technical tools shown with icons in the resume skills grid (sharp SVG marks only). */
export const technicalSkills: SkillDef[] = [
  { id: 'swift', label: 'Swift' },
  { id: 'unity', label: 'Unity' },
  { id: 'csharp', label: 'C#' },
  { id: 'python', label: 'Python' },
  { id: 'cpp', label: 'C++' },
  { id: 'aws', label: 'AWS' },
  { id: 'matlab', label: 'MATLAB' },
];

/** Domain skills / platforms listed as text chips (no icons). */
export const softSkills: string[] = [
  'RealityKit',
  'visionOS',
  'Testing',
  'Geometric Modeling',
  'Computational Geometry',
  'Signal Processing',
  'XR / AR Development',
];

/** Skill IDs that may appear in `TimelineEntry.tools` but should not render icons under experience cards. */
export const SKILL_IDS_WITH_EXPERIENCE_ICONS: ReadonlySet<SkillId> = new Set([
  'swift',
  'unity',
  'csharp',
  'python',
  'cpp',
  'aws',
  'matlab',
]);

export function filterExperienceToolIcons(tools: SkillId[]): SkillId[] {
  return tools.filter((id) => SKILL_IDS_WITH_EXPERIENCE_ICONS.has(id));
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export type TimelineEntry = {
  role: string;
  organization: string;
  orgUrl?: string;
  range: string;
  /** Skill IDs for this role (icons shown only for `SKILL_IDS_WITH_EXPERIENCE_ICONS`). */
  tools: SkillId[];
  /** Optional logo under `public/` (e.g. `/icons/orgs/foo.svg`). Shown at right of the card. */
  logoSrc?: string;
  logoAlt?: string;
};

export const experience: TimelineEntry[] = [
  {
    role: '3D Software Development Engineer in Test',
    organization: 'Align Technology',
    orgUrl: 'https://www.aligntech.com/',
    range: 'July 2025 – Present',
    tools: ['python', 'csharp', 'cpp', 'testing', 'geometry', 'aws'],
    logoSrc: '/icons/orgs/aligntech.svg',
    logoAlt: 'Align Technology',
  },
  {
    role: 'XR Undergraduate Researcher',
    organization: 'I³T Lab',
    orgUrl: 'https://gorlatova.pratt.duke.edu/', //https://maria.gorlatova.com/current-research/
    range: 'Sep 2023 – May 2025',
    tools: ['unity', 'csharp', 'python', 'visionos', 'realitykit'],
    logoSrc: '/icons/orgs/duke.svg',
    logoAlt: 'I³T Lab',
  },
  {
    role: 'Software Quality Engineering Intern',
    organization: 'Align Technology',
    orgUrl: 'https://www.aligntech.com/',
    range: 'Summer 2023',
    tools: ['python', 'testing'],
    logoSrc: '/icons/orgs/aligntech.svg',
    logoAlt: 'Align Technology',
  },
  {
    role: 'BME Undergraduate Researcher',
    organization: 'Big Ideas Lab',
    orgUrl: 'https://dunn.pratt.duke.edu/',
    range: 'Sep 2022 – May 2023',
    tools: ['python', 'matlab'],
    logoSrc: '/icons/orgs/duke.svg',
    logoAlt: 'Big Ideas Lab',
  },
];

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export type EducationEntry = {
  degree: string;
  institution: string;
  range: string;
  logoSrc?: string;
  logoAlt?: string;
};

export const education: EducationEntry[] = [
  {
    degree: 'Dual B.S. in Electrical & Computer Engineering / Computer Science',
    institution: 'Duke University',
    range: '2021 – 2025',
    logoSrc: '/icons/orgs/duke.svg',
    logoAlt: 'Duke University',
  },
];

// ---------------------------------------------------------------------------
// Languages & interests
// ---------------------------------------------------------------------------

export const languagesSpoken = [
  'English',
  'Chinese (中文)',
  'Japanese (日本語)',
  'German (Deutsch)',
  'Spanish (Español)',
  'Portuguese (Português)',
  'Turkish (Türkçe)',
  'Arabic (العربية)',
];

export const interests =
  'My dream is to make a full-game, full-movie, and full-animation series. I enjoy learning world languages, drawing, music, playing piano, running, hiking, and watching television.';

/** @deprecated use technicalSkills and softSkills instead */
export const skills = technicalSkills.map((s) => s.label);
