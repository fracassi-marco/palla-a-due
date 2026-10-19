export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  number: string;
  role: string;
  country: string;
  birthDate: string | null;
  birthPlace: string | null;
  heightCm: number | null;
  weightKg: number | null;
  photoUrl: string | null;
  teamId: number;
  teamName: string;
}
