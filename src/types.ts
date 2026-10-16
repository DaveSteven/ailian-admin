export type Status = 'pending' | 'approved' | 'rejected';
export type Stats = { total: number; pending: number; approved: number; rejected: number };
export type MerchantRow = { id: string; name: string; contactName: string | null; phone: string; address: string | null; reviewStatus: Status; verified: boolean; createdAt: string; categoryName: string | null; staffName: string | null; coverUrl: string | null };
export type MerchantDetail = Omit<MerchantRow, 'address' | 'coverUrl'> & { tags: string[]; businessHours: string | null; note: string | null; source: string; contacts: { id: string; name: string; phone: string; isPrimary: boolean }[]; images: { id: string; url: string }[]; qualificationImages: { id: string; url: string }[]; address: { detail: string | null; longitude: number | null; latitude: number | null }; staffName: string | null };
export type Category = { id: string; code: string; name: string; description: string | null; createdAt: string; merchantCount: number };
export type StaffMember = { id: string; name: string; phone: string; role: 'field_agent' | 'reviewer' | 'admin'; active: boolean; bound: boolean; createdAt: string; updatedAt: string };
