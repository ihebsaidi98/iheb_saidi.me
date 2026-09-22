export type ProfileStat = {
  value: number;
  suffix?: string;
  label: string;
};

export const profile: {
  name: string;
  title: string;
  titleLines: readonly string[];
  summary: string;
  location: string;
  email: string;
  linkedin: string;
  github: string;
  cv: string;
  stats: readonly ProfileStat[];
} = {
  name: "Iheb Saidi",
  title: "Full Stack Software Engineer — Java · Spring Boot · Angular",
  titleLines: ["Full Stack Engineer", "Java · Spring Boot · Angular"],
  summary:
    "2+ years of experience designing, developing, and delivering high-value enterprise applications. Backend: Java 17, Spring Boot, Spring Security, REST APIs. Frontend: Angular 14, TypeScript, RxJS, NgRx. Track record: real-time industrial platforms, ITIL-compliant ITSM solutions, microservices. Strong DevOps (Docker, Jenkins, SonarQube). Agile/Scrum.",
  location: "Tunis, Tunisia",
  email: "iheb.saidi.it@gmail.com",
  linkedin: "https://linkedin.com/in/iheb-saidi-/",
  github: "https://github.com/ihebsaidi98",
  cv: "/cv-iheb-saidi.pdf",
  stats: [],
};

export const awards = [
  "1st National Prize, Hult Prize 2020 (AI & Innovation) — IoT/AI hospital waste management solution",
  "Software Engineering Mentor at ESPRIT (2022–present) — UML design & architecture",
  "Tunisian National Taekwondo Team — 15 years",
  "Enactus (2019–2021) — team coordination, event management, social innovation",
] as const;

export const languages = "Arabic (Native) · French (Professional, B2) · English (Professional, B2)";