export interface UserProfile {
  uid: string;
  establishmentName: string;
  establishmentType: string;
  ownerName: string;
  email: string;
  phone: string;
  logoUrl?: string;
  logoDeleteToken?: string;
  createdAt: number;
  updatedAt: number;
} 