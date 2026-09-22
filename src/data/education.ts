export type EducationEntry = {
  degree: string;
  school?: string;
  institution?: string;
  period: string;
  description?: string;
  details?: string[];
  gpa?: string;
  courses?: readonly string[];
};

export const education: readonly EducationEntry[] = [
  { degree: "Engineering Degree in Computer Science (Bac+5)", school: "ESPRIT", period: "2021–2024" },
  { degree: "Bachelor's Degree in Computer Science (Bac+3)", school: "ISIMS Sfax", period: "2017–2021" },
];
