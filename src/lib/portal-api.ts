import { request } from "@/lib/api-client";

export function formatQAR(amount: number): string {
  return `QAR ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export interface PortalLease {
  id: string;
  contractNumber: string;
  property: string;
  unit: string;
  floor: string;
  bedrooms: number;
  area: string;
  parkingSlot: string;
  unitCondition: string;
  landlord: string;
  propertyManager: string;
  pmContact: string;
  startDate: string;
  endDate: string;
  moveInDate: string;
  annualRent: number;
  installments: number;
  installmentAmount: number;
  securityDeposit: number;
  noticePeriodDays: number;
  renewalStatus: "none" | "pending" | "confirmed" | "declined";
  customerName?: string;
  customerId?: string;
}

export interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  description: string;
  dueDate: string;
  amount: number;
  paidAmount?: number;
  status: "paid" | "overdue" | "outstanding";
}

export interface PortalPdc {
  id: string;
  chequeNumber: string;
  bank: string;
  installmentLabel: string;
  dueDate: string;
  amount: number;
  status: "cleared" | "upcoming" | "bounced" | "deposited";
}

export interface PortalPayment {
  id: string;
  reference: string;
  description?: string;
  date: string;
  method: string;
  amount: number;
  status: "completed" | "pending" | "failed";
}

export interface PortalTicket {
  id: string;
  subject: string;
  description: string;
  unit: string;
  property: string;
  complaintArea: string;
  category: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "new" | "assigned" | "in_progress" | "resolved" | "closed";
  assignee?: string;
  assigneePhone?: string;
  estimatedVisit?: string;
  createdAt: string;
  timeline?: Array<{ date: string; event: string; by?: string }>;
}

export interface PortalDocumentItem {
  id: string;
  name: string;
  category: "Legal" | "Finance" | "Inspection" | "Policy" | "NOC & Letters";
  date: string;
  size: string;
  action: "download" | "sign";
  url?: string;
}

export interface PortalFacility {
  id: string;
  name: string;
  type: string;
  hours: string;
  capacity: number;
  availableSlots: number;
  status: string;
  bookingFee?: number;
}

export interface PortalBookingItem {
  id: string;
  facilityId: string;
  facilityName: string;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled";
  reference: string;
}

export interface PortalSummary {
  lease: PortalLease | null;
  invoices: PortalInvoice[];
  pdcs: PortalPdc[];
  payments: PortalPayment[];
  tickets: PortalTicket[];
  documents: PortalDocumentItem[];
  facilities: PortalFacility[];
  bookings: PortalBookingItem[];
}

export interface OwnerStatementData {
  property_count: number;
  totals: { gross_revenue: number; expenses: number; net_payable: number };
  statements: Array<{
    id: string;
    period: string;
    gross_revenue: number;
    expenses: number;
    net_payable: number;
  }>;
}

export async function fetchPortalSummary(): Promise<PortalSummary> {
  const res = await request<{ data: PortalSummary }>("/api/portal/summary");
  return res.data;
}

export async function fetchOwnerStatements(): Promise<OwnerStatementData> {
  const res = await request<{ data: OwnerStatementData }>("/api/portal/owner-statements");
  return res.data;
}
