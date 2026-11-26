import { kvStore } from "@/lib/kv-store";
import { db } from "@/lib/db";
import { DynamicMastersService } from "@/lib/dynamic-masters-service";

export interface MasterItem {
  id: string;
  name: string;
  code?: string;
  category?: string;
  description?: string;
  /** Roles attached to this department or designation (e.g. ["Finance", "Admin"]) */
  roles?: string[];
  extra?: Record<string, any>;
  is_active?: boolean;
}

export type MasterCategoryKey =
  | "companies"
  | "branches"
  | "entities"
  | "departments"
  | "sub_departments"
  | "designations"
  | "grades"
  | "employment_types"
  | "contract_types"
  | "recruitment_reasons"
  | "regions"
  | "countries"
  | "states"
  | "cities"
  | "currencies"
  | "financial_years"
  | "banks"
  | "device_user_ids"
  | "ticket_categories"
  | "complaint_types"
  | "course_categories"
  | "expense_types"
  | "travel_allowances"
  | "kpa_masters"
  | "shifts"
  | "holidays"
  | "week_offs"
  | "salary_components"
  | "statutory_components"
  | "salary_templates"
  | "tax_slabs"
  | "appraisal_intervals"
  | "kt_masters"
  | "notice_periods"
  | "genders"
  | "employee_statuses"
  | "business_units"
  | "leave_types"
  | "document_types"
  | "loan_types";

export const MASTER_CATEGORIES_CONFIG: {
  key: MasterCategoryKey;
  label: string;
  group: "Organization" | "Location" | "HR & Workforce" | "Payroll & Finance" | "System & Service";
  codePrefix: string;
  /** When true the UI renders a Roles editor column for this category */
  supportsRoles?: boolean;
  defaultItems: { name: string; code?: string; description?: string; roles?: string[] }[];
}[] = [
  // ── Organization ──
  {
    key: "companies",
    label: "Company Master",
    group: "Organization",
    codePrefix: "CMP",
    defaultItems: [
      { name: "Zyno Property Management W.L.L", code: "ZYNO", description: "Primary Real Estate Management & Operations Entity" },
      { name: "Zyno Real Estate & Facilities Services", code: "ZRFS", description: "Facility Operations & Asset Maintenance" },
      { name: "Al Ameen Property Holdings W.L.L", code: "AAPH", description: "Commercial & Residential Assets Division" },
    ],
  },
  {
    key: "branches",
    label: "Branch Setup",
    group: "Organization",
    codePrefix: "BRN",
    defaultItems: [
      { name: "Al Ameen Real Estate Head Office", code: "AMEEN-HQ", description: "Central Corporate Head Office & Employee Payroll / Overhead Expenses" },
      { name: "Doha Head Office (D-Ring Road)", code: "DOH-HQ", description: "Central Corporate & Leasing Management HQ" },
      { name: "Old Salata Site Operations Hub", code: "SLT-01", description: "Old Salata & Central Doha Properties" },
      { name: "Al Wakra Operations Center", code: "WKR-01", description: "Wakra Residential & Commercial Portfolio" },
      { name: "Mansoura Facility Office", code: "MNS-01", description: "Mansoura Community & Maintenance Desk" },
      { name: "Musheireb Support Center", code: "MSH-01", description: "Downtown Residential Asset Management" },
      { name: "Bin Omran Site Office", code: "BOM-01", description: "Bin Omran Portfolio Operations" },
    ],
  },
  {
    key: "entities",
    label: "Entity Master",
    group: "Organization",
    codePrefix: "ENT",
    defaultItems: [
      { name: "ZYNO-QA-DOH (PRIMARY)", code: "ZYNO-QA", description: "Primary Property Management & Hospitality Entity" },
      { name: "ZYNO-FACILITIES-LLC", code: "ZYNO-FAC", description: "Integrated Facility Management & Maintenance" },
      { name: "AL-AMEEN-ESTATES-WLL", code: "AMEEN-EST", description: "Real Estate Asset Holding SPV" },
    ],
  },
  {
    key: "business_units",
    label: "Business Unit (BU)",
    group: "Organization",
    codePrefix: "BU",
    defaultItems: [
      { name: "Residential Leasing & Tenancy", code: "BU-RES", description: "Residential Apartment & Villa Operations" },
      { name: "Commercial & Retail Assets", code: "BU-COM", description: "Commercial Spaces, Offices & Retail Units" },
      { name: "Facility Maintenance & MEP", code: "BU-FM", description: "Planned Preventive & Reactive Maintenance" },
      { name: "Corporate & Shared Services", code: "BU-CORP", description: "Finance, HR, IT & Procurement" },
    ],
  },
  {
    key: "departments",
    label: "Department",
    group: "Organization",
    codePrefix: "DEP",
    supportsRoles: true,
    defaultItems: [
      { name: "Management", code: "MGMT", roles: ["Admin", "Executive"] },
      { name: "Finance & Accounts", code: "FIN", roles: ["Finance"] },
      { name: "HR & Administration", code: "HR", roles: ["HR"] },
      { name: "Sales & Marketing", code: "SALES", roles: ["Sales"] },
      { name: "Operations", code: "OPS", roles: ["Operations"] },
      { name: "Procurement", code: "PROC", roles: ["Procurement"] },
      { name: "Information Technology", code: "IT", roles: ["IT"] },
      { name: "Customer Service", code: "CS", roles: ["Customer Service"] },
      { name: "Maintenance / Technical", code: "TECH", roles: ["Maintenance"] },
      { name: "Warehouse", code: "WH", roles: ["Operations"] },
    ],
  },
  {
    key: "sub_departments",
    label: "Sub Department",
    group: "Organization",
    codePrefix: "SDEP",
    defaultItems: [
      { name: "Residential Leasing", code: "LEAS-RES", description: "Apartment & Villa Leases" },
      { name: "Commercial Leasing", code: "LEAS-COM", description: "Retail & Office Leases" },
      { name: "MEP Engineering", code: "MAINT-MEP", description: "Mechanical, Electrical, Plumbing" },
      { name: "HVAC & Chiller Maintenance", code: "MAINT-HVAC", description: "Cooling & Ventilation" },
      { name: "Payroll & Compensation", code: "HR-PAY", description: "Salary disbursement & benefits" },
      { name: "Accounts Payable (AP)", code: "FIN-AP", description: "Vendor invoices & disbursements" },
    ],
  },
  {
    key: "designations",
    label: "Designation Master",
    group: "HR & Workforce",
    codePrefix: "DSG",
    supportsRoles: true,
    defaultItems: [
      { name: "Director", code: "DIR", roles: ["Executive", "Admin"] },
      { name: "General Manager", code: "GM", roles: ["Executive", "Manager"] },
      { name: "Manager", code: "MGR", roles: ["Manager"] },
      { name: "Assistant Manager", code: "AM", roles: ["Manager"] },
      { name: "Accountant", code: "ACC", roles: ["Finance"] },
      { name: "HR Executive", code: "HR-EXEC", roles: ["HR"] },
      { name: "Admin Executive", code: "ADMIN-EXEC", roles: ["Admin"] },
      { name: "Sales Executive", code: "SALES-EXEC", roles: ["Sales"] },
      { name: "Operations Executive", code: "OPS-EXEC", roles: ["Operations"] },
      { name: "Procurement Executive", code: "PROC-EXEC", roles: ["Procurement"] },
      { name: "IT Support", code: "IT-SUPPORT", roles: ["IT"] },
      { name: "Customer Service Executive", code: "CS-EXEC", roles: ["Customer Service"] },
      { name: "Supervisor", code: "SUP", roles: ["Operations", "Manager"] },
      { name: "Technician", code: "TECH", roles: ["Maintenance"] },
      { name: "Driver", code: "DRIVER", roles: ["Operations"] },
      { name: "Office Assistant", code: "OFFICE-ASST", roles: ["Admin"] },
    ],
  },
  {
    key: "grades",
    label: "Grade Master",
    group: "HR & Workforce",
    codePrefix: "GRD",
    defaultItems: [
      { name: "Grade E (Executive / C-Suite)", code: "GRD-E", description: "Top Leadership Level" },
      { name: "Grade M (Management / Heads)", code: "GRD-M", description: "Departmental Managers" },
      { name: "Grade S (Senior Specialists)", code: "GRD-S", description: "Senior Engineers & Analysts" },
      { name: "Grade A (Associates & Officers)", code: "GRD-A", description: "Operational Staff" },
      { name: "Grade T (Technicians & Field)", code: "GRD-T", description: "Field Technical Staff" },
    ],
  },
  {
    key: "employment_types",
    label: "Employment Type",
    group: "HR & Workforce",
    codePrefix: "EMT",
    defaultItems: [
      { name: "Permanent / Full-Time", code: "PERM", description: "Standard regular employment" },
      { name: "Probationary", code: "PROB", description: "Initial evaluation period" },
      { name: "Fixed-Term Contract", code: "CONT", description: "Time-bound contract" },
      { name: "Consultant / Advisor", code: "CONS", description: "Professional advisor" },
      { name: "Part-Time / Intern", code: "PART", description: "Flexible / internship" },
    ],
  },
  {
    key: "genders",
    label: "Gender Master",
    group: "HR & Workforce",
    codePrefix: "GND",
    defaultItems: [
      { name: "Male", code: "M", description: "Male" },
      { name: "Female", code: "F", description: "Female" },
      { name: "Other", code: "O", description: "Other" },
    ],
  },
  {
    key: "employee_statuses",
    label: "Employee Status Master",
    group: "HR & Workforce",
    codePrefix: "EST",
    defaultItems: [
      { name: "Active", code: "ACT", description: "Active employee in service" },
      { name: "Probation", code: "PROB", description: "Under probationary assessment" },
      { name: "On Notice", code: "NOT", description: "Serving notice period" },
      { name: "On Leave", code: "LVE", description: "Extended approved leave" },
      { name: "Suspended", code: "SUSP", description: "Temporarily suspended" },
      { name: "Resigned", code: "RES", description: "Resigned from service" },
      { name: "Terminated", code: "TERM", description: "Service terminated" },
    ],
  },
  {
    key: "contract_types",
    label: "Contract Type",
    group: "HR & Workforce",
    codePrefix: "CNT",
    defaultItems: [
      { name: "Unlimited / Open-Ended (Standard)", code: "UNLTD", description: "Permanent Labor Contract" },
      { name: "Fixed 1-Year Renewable", code: "FX1", description: "Annual Renewable Contract" },
      { name: "Fixed 2-Year Term", code: "FX2", description: "Standard 24-Month Contract" },
      { name: "Secondment / Deputation", code: "SECD", description: "Inter-entity transfer contract" },
    ],
  },
  {
    key: "leave_types",
    label: "Leave Types & Quotas",
    group: "HR & Workforce",
    codePrefix: "LTYP",
    defaultItems: [
      { name: "Annual Leave (30 Calendar Days)", code: "AL", description: "Standard Paid Annual Vacation under Qatar Labor Law" },
      { name: "Sick Leave (Fully Paid 14 Days)", code: "SL", description: "Certified Medical Leave with Primary Health Centre slip" },
      { name: "Casual & Emergency Leave (7 Days)", code: "CL", description: "Short urgent leaves for family or personal needs" },
      { name: "Maternity Leave (50 Paid Days)", code: "ML", description: "Statutory maternity leave for female employees" },
      { name: "Hajj Pilgrimage Leave (20 Days Unpaid)", code: "HAJJ", description: "Once in service pilgrimage leave" },
      { name: "Compensatory Off / Duty Leave", code: "COMP-OFF", description: "Granted in lieu of weekend or holiday duty" },
    ],
  },
  {
    key: "document_types",
    label: "Document Types & Verification",
    group: "HR & Workforce",
    codePrefix: "DOC-TYP",
    defaultItems: [
      { name: "Qatar ID (QID / Residence Card)", code: "DOC-QID", description: "Official Ministry of Interior Civil ID" },
      { name: "Passport & Bio Page", code: "DOC-PPT", description: "International travel passport copy" },
      { name: "Ministry Attested Labor Contract", code: "DOC-MOL", description: "ADLSA / Labor department authenticated contract" },
      { name: "Academic & Degree Certificate", code: "DOC-EDU", description: "Higher education qualification document" },
      { name: "Qatar Driving License", code: "DOC-DL", description: "Valid Qatar Traffic Department license" },
      { name: "Police Clearance Certificate (PCC)", code: "DOC-PCC", description: "Good conduct background clearance" },
      { name: "Health Card & Medical Commission Fit", code: "DOC-MED", description: "Hamad Medical / Public Health certification" },
    ],
  },
  {
    key: "recruitment_reasons",
    label: "Reason For Recruitment",
    group: "HR & Workforce",
    codePrefix: "REC",
    defaultItems: [
      { name: "Business Expansion & New Property Handover", code: "EXPAND", description: "New property phase" },
      { name: "Backfill / Employee Resignation Replacement", code: "REPLACE", description: "Vacancy replacement" },
      { name: "Specialized Technical Competency Requirement", code: "SPEC", description: "Niche technical skill" },
      { name: "Workload Surge / Seasonal Operations", code: "SURGE", description: "Operational demand" },
    ],
  },
  {
    key: "notice_periods",
    label: "Notice Period Master",
    group: "HR & Workforce",
    codePrefix: "NOT",
    defaultItems: [
      { name: "30 Days (Standard Staff)", code: "NP-30", description: "1-Month standard notice" },
      { name: "60 Days (Management / Key Roles)", code: "NP-60", description: "2-Month management notice" },
      { name: "90 Days (C-Suite / Executive)", code: "NP-90", description: "3-Month executive notice" },
      { name: "15 Days (Probation Period Exit)", code: "NP-15", description: "Probation notice period" },
    ],
  },
  {
    key: "kt_masters",
    label: "Knowledge Transfer (KT) Master",
    group: "HR & Workforce",
    codePrefix: "KT",
    defaultItems: [
      { name: "Codebase & System Administration Handover", code: "KT-IT", description: "IT credentials and architecture" },
      { name: "Property Keys & Access Card Handover", code: "KT-KEYS", description: "Physical access clearance" },
      { name: "Active Tenant Lease Accounts & Collections", code: "KT-LEAS", description: "Leasing pipeline handover" },
      { name: "Vendor Contracts & In-Progress Work Orders", code: "KT-MAINT", description: "Maintenance projects status" },
    ],
  },

  // ── Locations ──
  {
    key: "countries",
    label: "Country Master",
    group: "Location",
    codePrefix: "CTY",
    defaultItems: [
      { name: "Qatar", code: "QA", description: "State of Qatar" },
      { name: "India", code: "IN", description: "Republic of India" },
      { name: "United Arab Emirates", code: "AE", description: "UAE" },
      { name: "Saudi Arabia", code: "SA", description: "KSA" },
      { name: "United Kingdom", code: "GB", description: "UK" },
      { name: "Philippines", code: "PH", description: "Republic of the Philippines" },
    ],
  },
  {
    key: "states",
    label: "State / Governorate Master",
    group: "Location",
    codePrefix: "ST",
    defaultItems: [
      { name: "Doha Municipality", code: "QA-DA", description: "Capital Governorate" },
      { name: "Al Rayyan", code: "QA-RA", description: "Western Municipality" },
      { name: "Al Daayen / Lusail", code: "QA-ZA", description: "Lusail & Waterfront" },
      { name: "Al Wakrah", code: "QA-WA", description: "Southern Hub" },
      { name: "Delhi NCR", code: "IN-DL", description: "National Capital Region" },
      { name: "Haryana (Gurugram)", code: "IN-HR", description: "Millennium City Tech Hub" },
    ],
  },
  {
    key: "cities",
    label: "City Master",
    group: "Location",
    codePrefix: "CIT",
    defaultItems: [
      { name: "Doha", code: "DOH", description: "Doha Metropolitan" },
      { name: "Lusail", code: "LSL", description: "Lusail Smart City" },
      { name: "The Pearl-Qatar", code: "PRL", description: "Island Community" },
      { name: "West Bay", code: "WBY", description: "Diplomatic & Financial District" },
      { name: "New Delhi", code: "DEL", description: "New Delhi Central" },
      { name: "Gurugram", code: "GUR", description: "Cyber City" },
    ],
  },
  {
    key: "regions",
    label: "Region Master",
    group: "Location",
    codePrefix: "REG",
    defaultItems: [
      { name: "Middle East & GCC", code: "GCC", description: "Gulf Region" },
      { name: "South Asia", code: "SA", description: "Indian Subcontinent" },
      { name: "Europe & Levant", code: "EUR", description: "International Operations" },
    ],
  },

  // ── Payroll & Finance ──
  {
    key: "financial_years",
    label: "Financial Year",
    group: "Payroll & Finance",
    codePrefix: "FY",
    defaultItems: [
      { name: "2026-2027 (Current Active)", code: "FY26-27", description: "01 Apr 2026 - 31 Mar 2027" },
      { name: "2025-2026 (Audited Past)", code: "FY25-26", description: "01 Apr 2025 - 31 Mar 2026" },
      { name: "2027-2028 (Projected)", code: "FY27-28", description: "01 Apr 2027 - 31 Mar 2028" },
    ],
  },
  {
    key: "currencies",
    label: "Currency Master",
    group: "Payroll & Finance",
    codePrefix: "CUR",
    defaultItems: [
      { name: "Qatari Riyal (QAR)", code: "QAR", description: "Base Operational Currency" },
    ],
  },
  {
    key: "banks",
    label: "Bank Master",
    group: "Payroll & Finance",
    codePrefix: "BNK",
    defaultItems: [
      { name: "Qatar National Bank (QNB)", code: "QNBA", description: "Primary Operating Bank" },
      { name: "Commercial Bank of Qatar (CBQ)", code: "CBQA", description: "Collection & Escrow Bank" },
      { name: "Doha Bank", code: "DHBK", description: "Payroll Disbursement Partner" },
      { name: "Qatar Islamic Bank (QIB)", code: "QISB", description: "Islamic Banking Services" },
      { name: "HDFC Bank India", code: "HDFC", description: "India Corporate Bank" },
    ],
  },
  {
    key: "salary_components",
    label: "Salary Components",
    group: "Payroll & Finance",
    codePrefix: "SAL-COMP",
    defaultItems: [
      { name: "Basic Salary", code: "BASIC", description: "Fixed Base Pay (Earning)" },
      { name: "House Rent Allowance (HRA)", code: "HRA", description: "Monthly Housing Allowance" },
      { name: "Transport Allowance (TRA)", code: "TRA", description: "Conveyance & Travel" },
      { name: "Special Operational Allowance", code: "SPEC_ALW", description: "Performance Fixed Allowance" },
      { name: "Mobile & Utility Allowance", code: "MOB_ALW", description: "Communication reimbursement" },
      { name: "Overtime (OT) Pay", code: "OT_PAY", description: "Calculated Hourly Overtime" },
      { name: "Discretionary Bonus", code: "BONUS", description: "Quarterly / Annual KPI Incentive" },
    ],
  },
  {
    key: "statutory_components",
    label: "Statutory & Deductions",
    group: "Payroll & Finance",
    codePrefix: "STAT",
    defaultItems: [
      { name: "End-of-Service Gratuity Accrual", code: "GRAT", description: "21 Days basic pay per year of service" },
      { name: "Social Insurance / Pension Contribution", code: "SI", description: "Statutory national social insurance" },
      { name: "Disciplinary Penalty / Fine Deduction", code: "FINE", description: "Authorized HR disciplinary fine" },
      { name: "Staff Advance / Loan Deduction", code: "LOAN_DED", description: "Monthly EMI recovery" },
    ],
  },
  {
    key: "salary_templates",
    label: "Salary Structure Templates",
    group: "Payroll & Finance",
    codePrefix: "SAL-TMP",
    defaultItems: [
      { name: "Standard Executive Package (60% Basic + 30% HRA + 10% TRA)", code: "TMPL-EXEC", description: "Executive grade breakdown" },
      { name: "Management Structure (55% Basic + 35% HRA + 10% TRA)", code: "TMPL-MGT", description: "Department heads & managers" },
      { name: "Operational & Technical Package (50% Basic + 35% HRA + 15% TRA)", code: "TMPL-TECH", description: "Field engineers and technical staff" },
    ],
  },
  {
    key: "tax_slabs",
    label: "Tax Slabs & Exemption Rules",
    group: "Payroll & Finance",
    codePrefix: "TAX",
    defaultItems: [
      { name: "Qatar Exemption (0% Personal Income Tax)", code: "QA-TAX-FREE", description: "100% Tax-Free Personal Income under State of Qatar Law" },
      { name: "Standard Foreign Remittance Reporting", code: "INT-REMIT", description: "Cross-border compliance documentation" },
    ],
  },
  {
    key: "loan_types",
    label: "Staff Loan & Advance Types",
    group: "Payroll & Finance",
    codePrefix: "LOAN-TYP",
    defaultItems: [
      { name: "Annual Housing Advance Loan", code: "LN-HOUSE", description: "Advance for annual house rental cheques" },
      { name: "Emergency Medical & Family Loan", code: "LN-EMERG", description: "Zero-interest staff emergency assistance" },
      { name: "Annual Air Ticket Advance", code: "LN-TICKET", description: "Advance against annual leave flight entitlement" },
      { name: "Vehicle / Transportation Advance", code: "LN-VEH", description: "Transportation acquisition loan" },
    ],
  },

  // ── System & Service ──
  {
    key: "shifts",
    label: "Work Shifts Master",
    group: "HR & Workforce",
    codePrefix: "SHF",
    defaultItems: [
      { name: "General Day Shift (08:00 AM - 05:00 PM)", code: "SHF-DAY", description: "Standard Office Hours, 60m break" },
      { name: "Property Site Morning Shift (07:00 AM - 04:00 PM)", code: "SHF-MORN", description: "Site operations & maintenance" },
      { name: "Facility Night Shift (10:00 PM - 07:00 AM)", code: "SHF-NIGHT", description: "Overnight facility security & chiller monitor" },
    ],
  },
  {
    key: "holidays",
    label: "Public Holidays Calendar",
    group: "HR & Workforce",
    codePrefix: "HOL",
    defaultItems: [
      { name: "Qatar National Day (18 December)", code: "HOL-QND", description: "National official holiday" },
      { name: "Qatar National Sports Day (2nd Tuesday February)", code: "HOL-QSD", description: "Sports holiday" },
      { name: "Eid Al-Fitr (3 Days)", code: "HOL-EID-FITR", description: "Religious festival" },
      { name: "Eid Al-Adha (4 Days)", code: "HOL-EID-ADHA", description: "Religious feast" },
      { name: "New Year's Day (01 January)", code: "HOL-NY", description: "Public holiday" },
    ],
  },
  {
    key: "week_offs",
    label: "Week Off Configuration",
    group: "HR & Workforce",
    codePrefix: "WO",
    defaultItems: [
      { name: "Friday & Saturday (Standard Corporate)", code: "WO-FRI-SAT", description: "2 Days weekly off for corporate office" },
      { name: "Friday Only (Rotational Site Roster)", code: "WO-FRI", description: "1 Day off with compensatory off option" },
    ],
  },
  {
    key: "kpa_masters",
    label: "KPA & Performance Goals",
    group: "HR & Workforce",
    codePrefix: "KPA",
    defaultItems: [
      { name: "Property Occupancy & Lease Renewal Rate (>95%)", code: "KPA-OCCUP", description: "Leasing portfolio target" },
      { name: "Service Ticket Resolution SLA Compliance (>98%)", code: "KPA-SLA", description: "Maintenance ticket timeliness" },
      { name: "Rent Collection & Arrear Recovery (>99%)", code: "KPA-COLL", description: "Financial cash collection" },
      { name: "Tenant Satisfaction & Net Promoter Score (>4.5/5)", code: "KPA-CSAT", description: "Customer satisfaction score" },
    ],
  },
  {
    key: "appraisal_intervals",
    label: "Appraisal Intervals",
    group: "HR & Workforce",
    codePrefix: "APP-INT",
    defaultItems: [
      { name: "Annual Performance Appraisal (12 Months)", code: "INT-ANNUAL", description: "Full year comprehensive evaluation" },
      { name: "Mid-Year Milestone Review (6 Months)", code: "INT-MID", description: "Semi-annual progress check" },
      { name: "Quarterly Objective & Key Results (Q1-Q4)", code: "INT-QTR", description: "Quarterly milestone check" },
      { name: "Probation Clearance Review (90 Days)", code: "INT-PROB", description: "Confirmation appraisal" },
    ],
  },
  {
    key: "device_user_ids",
    label: "Device UserID / Biometric Link",
    group: "System & Service",
    codePrefix: "DEV-UID",
    defaultItems: [
      { name: "Biometric Face Recognition Machine - Doha HQ", code: "DEV-HQ-01", description: "IP: 192.168.1.120 - Terminal 1" },
      { name: "Fingerprint Scanner - West Bay Site Office", code: "DEV-WB-02", description: "IP: 192.168.2.145 - Terminal 2" },
      { name: "Mobile Geofence Attendance Punch App", code: "DEV-APP", description: "GPS verified mobile punch" },
    ],
  },
  {
    key: "ticket_categories",
    label: "Ticket Category",
    group: "System & Service",
    codePrefix: "TCAT",
    defaultItems: [
      { name: "HR & Salary Certificate Requests", code: "TCAT-HR", description: "Letters, embassy NOC, experience" },
      { name: "IT & System Access Support", code: "TCAT-IT", description: "Software credentials and hardware" },
      { name: "Payroll & Reimbursement Discrepancy", code: "TCAT-PAY", description: "Salary & expense inquiries" },
      { name: "Facility & Workplace Assets", code: "TCAT-FAC", description: "Desk, chair, locker allocation" },
    ],
  },
  {
    key: "complaint_types",
    label: "Complaint Type",
    group: "System & Service",
    codePrefix: "CMPL",
    defaultItems: [
      { name: "Workplace Harassment & Ethics Grievance", code: "CMPL-ETHICS", description: "Confidential HR review" },
      { name: "Shift & Overtime Dispute", code: "CMPL-SHIFT", description: "Roster discrepancy" },
      { name: "Managerial Feedback / Dispute", code: "CMPL-MGT", description: "Mediation process" },
    ],
  },
  {
    key: "course_categories",
    label: "Course & Learning Category",
    group: "System & Service",
    codePrefix: "CRS",
    defaultItems: [
      { name: "Property Management & Real Estate Law", code: "CRS-LAW", description: "Qatar Tenancy Law & Compliance" },
      { name: "Facility Health & Safety (OSHA / First Aid)", code: "CRS-HSE", description: "Building fire and occupational safety" },
      { name: "Customer Experience & Tenant Relations", code: "CRS-CSAT", description: "Hospitality & communication" },
      { name: "ERP & Financial Accounting Systems", code: "CRS-ERP", description: "Software workflow mastery" },
    ],
  },
  {
    key: "expense_types",
    label: "Type Of Expense",
    group: "System & Service",
    codePrefix: "EXP",
    defaultItems: [
      { name: "Local Travel & Inspection Fuel (Travel Expense)", code: "EXP-TRAV", description: "Property inspection & tenant visits" },
      { name: "Official Food & Refreshments (Reimbursement Expense)", code: "EXP-FOOD", description: "Client meetings & operational lunch" },
      { name: "Office Supplies & Urgent Spares (Other Expense)", code: "EXP-MISC", description: "Emergency on-site petty purchases" },
      { name: "Visa & Government Labor Attestation Fees", code: "EXP-GOV", description: "Official ministry fees" },
    ],
  },
  {
    key: "travel_allowances",
    label: "Travel Allowance & Per Diem",
    group: "System & Service",
    codePrefix: "TA",
    defaultItems: [
      { name: "Per Diem - Local Site Inspection (150 QAR/Day)", code: "TA-LOCAL", description: "Local daily allowance" },
      { name: "Per Diem - International GCC Travel (500 QAR/Day)", code: "TA-GCC", description: "GCC travel rate" },
      { name: "Mileage Allowance - Personal Vehicle (1.2 QAR/KM)", code: "TA-KM", description: "Fuel & vehicle wear rate" },
    ],
  },
];

const MASTER_CACHE_KEY_PREFIX = "zyno_hrms_master_cache_";
const REPLACED_CATALOG_ITEMS: Partial<Record<MasterCategoryKey, string[]>> = {
  departments: [
    "Commercial & Leasing",
    "Facility Operations & Maintenance",
    "Human Resources & Talent",
    "Legal & Compliance",
    "Procurement & Supply Chain",
  ],
  designations: [
    "Managing Director / CEO",
    "Senior Property Manager",
    "Leasing Executive",
    "Chief Financial Officer",
    "Senior Accountant",
    "Chief MEP Engineer",
    "Facility Technician",
    "HR Manager",
  ],
};

const TABLE_BACKED_MASTERS: Partial<
  Record<
    MasterCategoryKey,
    {
      table: string;
      nameCol: string;
      hasDescription: boolean;
      dynamicKey: "department" | "designation";
    }
  >
> = {
  departments: { table: "departments", nameCol: "name", hasDescription: true, dynamicKey: "department" },
  designations: { table: "designations", nameCol: "title", hasDescription: false, dynamicKey: "designation" },
};

function rowToMasterItem(row: any): MasterItem {
  let extra: any = undefined;
  if (row.extra) {
    try {
      extra = JSON.parse(row.extra);
    } catch {
      extra = undefined;
    }
  }
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    description: row.description ?? undefined,
    roles: Array.isArray(extra?.roles) ? extra.roles : undefined,
    extra,
    is_active: row.is_active !== false,
  };
}

export const HrmsMastersApi = {
  // Ensure a department or designation added in DynamicMastersService exists in its real SQL table
  // so foreign-key columns (employees.department_id / employees.designation_id) can reference it.
  async ensureSqlMaster(categoryKey: "departments" | "designations", name: string): Promise<void> {
    const tableCfg = TABLE_BACKED_MASTERS[categoryKey];
    const trimmed = name.trim();
    if (!tableCfg || !trimmed) return;
    try {
      const { data } = await db.from(tableCfg.table).select("*");
      const exists = ((data || []) as any[]).some(
        (row) => String(row[tableCfg.nameCol] || "").trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (!exists) {
        await db.from(tableCfg.table).insert({ [tableCfg.nameCol]: trimmed });
      }
      window.dispatchEvent(new CustomEvent("hrms_masters_updated", { detail: { categoryKey } }));
    } catch (err) {
      console.warn(`[HrmsMastersApi] ensureSqlMaster(${categoryKey}, ${trimmed}) notice:`, err);
    }
  },

  async renameSqlMaster(
    categoryKey: "departments" | "designations",
    oldName: string,
    newName: string
  ): Promise<void> {
    const tableCfg = TABLE_BACKED_MASTERS[categoryKey];
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!tableCfg || !trimmedNew) return;
    try {
      const { data } = await db.from(tableCfg.table).select("*");
      const rows = (data || []) as any[];
      const match = rows.find(
        (row) => String(row[tableCfg.nameCol] || "").trim().toLowerCase() === trimmedOld.toLowerCase()
      );
      if (match) {
        await db.from(tableCfg.table).update({ [tableCfg.nameCol]: trimmedNew }).eq("id", match.id);
      } else {
        const existsNew = rows.some(
          (row) => String(row[tableCfg.nameCol] || "").trim().toLowerCase() === trimmedNew.toLowerCase()
        );
        if (!existsNew) {
          await db.from(tableCfg.table).insert({ [tableCfg.nameCol]: trimmedNew });
        }
      }
      window.dispatchEvent(new CustomEvent("hrms_masters_updated", { detail: { categoryKey } }));
    } catch (err) {
      console.warn(`[HrmsMastersApi] renameSqlMaster(${categoryKey}) notice:`, err);
    }
  },

  async deleteSqlMasterByName(categoryKey: "departments" | "designations", name: string): Promise<void> {
    const tableCfg = TABLE_BACKED_MASTERS[categoryKey];
    const trimmed = name.trim();
    if (!tableCfg || !trimmed) return;
    try {
      const { data } = await db.from(tableCfg.table).select("*");
      const match = ((data || []) as any[]).find(
        (row) => String(row[tableCfg.nameCol] || "").trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (match) {
        await db.from(tableCfg.table).delete().eq("id", match.id);
      }
      window.dispatchEvent(new CustomEvent("hrms_masters_updated", { detail: { categoryKey } }));
    } catch (err) {
      console.warn(`[HrmsMastersApi] deleteSqlMasterByName(${categoryKey}) notice:`, err);
    }
  },

  async getRoles(): Promise<MasterItem[]> {
    try {
      await DynamicMastersService.initFromDb();
    } catch {}
    const dynRoles = DynamicMastersService.getMasterValues("role");
    return dynRoles.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      is_active: true,
    }));
  },

  // Items come from the database only. Departments and designations use their real tables (the employee
  // form links to them) and are automatically reconciled with DynamicMastersService (/admin/masters);
  // every other list is stored in hrms_master_items, keyed by category.
  async getMasterItems(categoryKey: MasterCategoryKey): Promise<MasterItem[]> {
    const tableCfg = TABLE_BACKED_MASTERS[categoryKey];
    if (tableCfg) {
      try {
        await DynamicMastersService.initFromDb();
      } catch {}

      const { data, error } = await db.from(tableCfg.table).select("*").order(tableCfg.nameCol, { ascending: true });
      if (error) throw new Error(error.message || `Failed to load ${categoryKey}`);

      const sqlRows: any[] = [...((data || []) as any[])];
      const existingByName = new Map<string, any>();
      for (const row of sqlRows) {
        const key = String(row[tableCfg.nameCol] || "").trim().toLowerCase();
        if (key) existingByName.set(key, row);
      }

      // Reconcile any entries added via /admin/masters (DynamicMastersService) into the SQL table
      // so they are immediately visible with valid UUIDs in Employee/User assignment forms.
      const dynamicItems = DynamicMastersService.getMasterValues(tableCfg.dynamicKey);
      const rolesByName = new Map<string, string[]>();
      for (const dyn of dynamicItems) {
        const trimmed = String(dyn.name || "").trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (Array.isArray(dyn.extra?.roles) && dyn.extra.roles.length > 0) {
          rolesByName.set(lower, dyn.extra.roles);
        }
        if (!existingByName.has(lower)) {
          try {
            const { data: inserted, error: insertErr } = await db
              .from(tableCfg.table)
              .insert({ [tableCfg.nameCol]: trimmed })
              .select()
              .single();
            if (!insertErr && inserted) {
              sqlRows.push(inserted);
              existingByName.set(lower, inserted);
            }
          } catch (syncErr) {
            console.warn(`[HrmsMastersApi] Failed to sync ${categoryKey} "${trimmed}" to SQL:`, syncErr);
          }
        }
      }

      sqlRows.sort((a, b) =>
        String(a[tableCfg.nameCol] || "").localeCompare(String(b[tableCfg.nameCol] || ""))
      );

      return sqlRows.map((row) => {
        const name = String(row[tableCfg.nameCol] || "");
        const roles = rolesByName.get(name.trim().toLowerCase());
        return {
          id: row.id,
          name,
          code: row.code ?? undefined,
          description: row.description ?? undefined,
          roles,
          is_active: row.is_active !== false,
        };
      });
    }
    const { data, error } = await db
      .from("hrms_master_items")
      .select("*")
      .eq("category", categoryKey)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message || `Failed to load ${categoryKey}`);
    return ((data || []) as any[]).map(rowToMasterItem);
  },

  async addMasterItem(
    categoryKey: MasterCategoryKey,
    item: { name: string; code?: string; description?: string; roles?: string[]; extra?: any }
  ): Promise<MasterItem> {
    const tableCfg = TABLE_BACKED_MASTERS[categoryKey];
    let created: MasterItem;
    if (tableCfg) {
      const payload: Record<string, any> = {
        [tableCfg.nameCol]: item.name.trim(),
        code: item.code || null,
      };
      if (tableCfg.hasDescription) {
        payload.description = item.description || null;
      }
      const { data, error } = await db.from(tableCfg.table).insert(payload).select().single();
      if (error) throw new Error(error.message || `Failed to add ${categoryKey}`);
      const roles = item.roles || (Array.isArray(item.extra?.roles) ? item.extra.roles : undefined);
      // Keep DynamicMastersService in sync so /admin/masters also displays this entry and its roles
      try {
        const existingDyn = DynamicMastersService.getMasterValues(tableCfg.dynamicKey).find(
          (d) => d.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
        if (!existingDyn) {
          if (roles && roles.length > 0) {
            DynamicMastersService.addMasterValueWithRoles(tableCfg.dynamicKey, item.name.trim(), roles);
          } else {
            DynamicMastersService.addMasterValue(tableCfg.dynamicKey, item.name.trim());
          }
        } else if (roles) {
          DynamicMastersService.updateMasterValueRoles(tableCfg.dynamicKey, existingDyn.id, item.name.trim(), roles);
        }
      } catch {}
      created = {
        id: (data as any).id,
        name: item.name.trim(),
        code: (data as any).code ?? undefined,
        description: (data as any).description ?? undefined,
        roles,
        is_active: true,
      };
    } else {
      const payload = {
        category: categoryKey,
        name: item.name,
        code: item.code || null,
        description: item.description || null,
        extra: item.extra ? JSON.stringify(item.extra) : null,
        is_active: true,
      };
      const { data, error } = await db.from("hrms_master_items").insert(payload).select().single();
      if (error) throw new Error(error.message || `Failed to add ${categoryKey}`);
      created = rowToMasterItem(data as any);
    }
    window.dispatchEvent(new CustomEvent("hrms_masters_updated", { detail: { categoryKey } }));
    return created;
  },

  async createMasterItem(
    categoryKey: MasterCategoryKey,
    item: { name: string; code?: string; description?: string; extra?: Record<string, any> }
  ): Promise<MasterItem> {
    return this.addMasterItem(categoryKey, item);
  },

  async updateMasterItem(
    categoryKey: MasterCategoryKey,
    id: string,
    updates: Partial<MasterItem>
  ): Promise<MasterItem | null> {
    const tableCfg = TABLE_BACKED_MASTERS[categoryKey];
    if (tableCfg) {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload[tableCfg.nameCol] = updates.name;
      if (updates.code !== undefined) payload.code = updates.code || null;
      if (tableCfg.hasDescription && updates.description !== undefined) {
        payload.description = updates.description || null;
      }
      if (Object.keys(payload).length > 0) {
        const { error } = await db.from(tableCfg.table).update(payload).eq("id", id);
        if (error) throw new Error(error.message || `Failed to update ${categoryKey}`);
      }
      // Persist roles metadata in DynamicMastersService when provided
      if (updates.roles !== undefined) {
        try {
          const { data: row } = await db.from(tableCfg.table).select("*").eq("id", id).maybeSingle();
          const rowName = String(updates.name ?? (row as any)?.[tableCfg.nameCol] ?? "").trim();
          if (rowName) {
            const existingDyn = DynamicMastersService.getMasterValues(tableCfg.dynamicKey).find(
              (d) => d.name.trim().toLowerCase() === rowName.toLowerCase()
            );
            if (existingDyn) {
              DynamicMastersService.updateMasterValueRoles(tableCfg.dynamicKey, existingDyn.id, rowName, updates.roles);
            } else {
              DynamicMastersService.addMasterValueWithRoles(tableCfg.dynamicKey, rowName, updates.roles);
            }
          }
        } catch {}
      }
    } else {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.code !== undefined) payload.code = updates.code || null;
      if (updates.description !== undefined) payload.description = updates.description || null;
      if (updates.extra !== undefined) payload.extra = updates.extra ? JSON.stringify(updates.extra) : null;
      if (updates.is_active !== undefined) payload.is_active = updates.is_active;
      const { error } = await db.from("hrms_master_items").update(payload).eq("id", id);
      if (error) throw new Error(error.message || `Failed to update ${categoryKey}`);
    }
    window.dispatchEvent(new CustomEvent("hrms_masters_updated", { detail: { categoryKey } }));
    const items = await this.getMasterItems(categoryKey);
    return items.find((i) => i.id === id) || null;
  },

  async deleteMasterItem(categoryKey: MasterCategoryKey, id: string): Promise<boolean> {
    const tableCfg = TABLE_BACKED_MASTERS[categoryKey];
    let existingName = "";
    if (tableCfg) {
      try {
        const { data: row } = await db.from(tableCfg.table).select("*").eq("id", id).maybeSingle();
        existingName = String((row as any)?.[tableCfg.nameCol] || "").trim();
      } catch {}
    }
    const table = tableCfg ? tableCfg.table : "hrms_master_items";
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) throw new Error(error.message || `Failed to delete ${categoryKey}`);
    if (tableCfg && existingName) {
      try {
        const dyn = DynamicMastersService.getMasterValues(tableCfg.dynamicKey).find(
          (d) => d.name.trim().toLowerCase() === existingName.toLowerCase()
        );
        if (dyn) DynamicMastersService.deleteMasterValue(tableCfg.dynamicKey, dyn.id);
      } catch {}
    }
    window.dispatchEvent(new CustomEvent("hrms_masters_updated", { detail: { categoryKey } }));
    return true;
  },

  // Batch getter for common dropdowns — resilient per category so one failing table never blanks out others
  async getEmployeeCreationMasters() {
    const safeGet = (cat: MasterCategoryKey) =>
      this.getMasterItems(cat).catch((err) => {
        console.warn(`[HrmsMastersApi] Failed to load ${cat}:`, err);
        return [] as MasterItem[];
      });

    const [
      companies,
      branches,
      entities,
      businessUnits,
      departments,
      subDepartments,
      designations,
      roles,
      grades,
      employmentTypes,
      contractTypes,
      countries,
      states,
      cities,
      banks,
      genders,
      employeeStatuses,
      documentTypes,
      leaveTypes,
    ] = await Promise.all([
      safeGet("companies"),
      safeGet("branches"),
      safeGet("entities"),
      safeGet("business_units"),
      safeGet("departments"),
      safeGet("sub_departments"),
      safeGet("designations"),
      this.getRoles().catch(() => [] as MasterItem[]),
      safeGet("grades"),
      safeGet("employment_types"),
      safeGet("contract_types"),
      safeGet("countries"),
      safeGet("states"),
      safeGet("cities"),
      safeGet("banks"),
      safeGet("genders"),
      safeGet("employee_statuses"),
      safeGet("document_types"),
      safeGet("leave_types"),
    ]);

    return {
      companies,
      branches,
      entities,
      businessUnits,
      departments,
      subDepartments,
      designations,
      roles,
      grades,
      employmentTypes,
      contractTypes,
      countries,
      states,
      cities,
      banks,
      genders,
      employeeStatuses,
      documentTypes,
      leaveTypes,
    };
  },

  // Generate Next Employee ID based on organization master logic or sequential counter
  async generateNextEmployeeId(prefix: string = "EMP"): Promise<string> {
    try {
      const { data } = await db
        .from('employees')
        .select('employee_id_code');
      
      let maxNum = 0;
      if (data && data.length > 0) {
        for (const row of data) {
          const code = String(row.employee_id_code || '').trim();
          const match = code.match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
      const nextNum = maxNum + 1;
      const formatted = String(nextNum).padStart(nextNum > 999 ? 4 : 3, '0');
      return `${prefix}-${formatted}`;
    } catch {
      return `${prefix}-${String(Math.floor(100 + Math.random() * 900))}`;
    }
  },
};
