import type { SkillId } from './resume';

export type SkillIconDef = { src: string; alt: string };

export const skillIcons: Record<SkillId, SkillIconDef> = {
  python:    { src: '/icons/skills/python.svg',    alt: 'Python' },
  csharp:    { src: '/icons/skills/csharp.svg',    alt: 'C#' },
  cpp:       { src: '/icons/skills/cpp.svg',       alt: 'C++' },
  swift:     { src: '/icons/skills/swift.svg',     alt: 'Swift' },
  unity:     { src: '/icons/skills/unity.svg',     alt: 'Unity' },
  realitykit:{ src: '/icons/skills/realitykit.svg',alt: 'RealityKit' },
  visionos:  { src: '/icons/skills/visionos.svg',  alt: 'visionOS' },
  testing:   { src: '/icons/skills/testing.svg',   alt: 'Testing' },
  geometry:  { src: '/icons/skills/geometry.svg',  alt: 'Geometry' },
  matlab:    { src: '/icons/skills/matlab.svg',    alt: 'MATLAB' },
  aws:       { src: '/icons/skills/aws.svg',       alt: 'AWS' },
};
