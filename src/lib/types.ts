export const USER_LEVELS = ["superuser", "admin", "user"] as const;

export type UserLevel = (typeof USER_LEVELS)[number];

export type Shift = "NS" | "DS";

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  photo_name: string;
  level: string;
  active: "1" | "0";
  created_at: string;
};

export type RowInput = {
  crew: string;
  unit: string;
  location: string;
  technician: string;
  status: string;
  waiting_labour_at: string;
  repair_started_at: string;
  rd30_at: string;
  hm_awal: string;
  hm_akhir: string;
  unit_backup: string;
  backup_time: string;
  breakdown_problem: string;
  done_action: string;
  continue_handover: string;
  so: string;
};

export type HandoverSheet = {
  id: string;
  sheet_date: string;
  shift: Shift;
  created_by: string;
  created_at: string;
};

export type HandoverRow = RowInput & {
  id: string;
  sheet_id: string;
  sort_order: number;
  updated_at: string;
  updated_by: string;
};

export type BoardData = {
  sheet: HandoverSheet | null;
  rows: HandoverRow[];
};

export type Metrics = {
  erdm: number | null;
  waitingLabourHours: number | null;
  repairHours: number | null;
  dtTotal: number | null;
  dtLabel: string;
};

export const EMPTY_ROW: RowInput = {
  crew: "",
  unit: "",
  location: "",
  technician: "",
  status: "",
  waiting_labour_at: "",
  repair_started_at: "",
  rd30_at: "",
  hm_awal: "",
  hm_akhir: "",
  unit_backup: "",
  backup_time: "",
  breakdown_problem: "",
  done_action: "",
  continue_handover: "",
  so: "",
};

export function emptyRowInput(): RowInput {
  return { ...EMPTY_ROW };
}

export function toRowInput(row: RowInput): RowInput {
  return {
    crew: row.crew,
    unit: row.unit,
    location: row.location,
    technician: row.technician,
    status: row.status,
    waiting_labour_at: row.waiting_labour_at,
    repair_started_at: row.repair_started_at,
    rd30_at: row.rd30_at,
    hm_awal: row.hm_awal,
    hm_akhir: row.hm_akhir,
    unit_backup: row.unit_backup || "",
    backup_time: row.backup_time || "",
    breakdown_problem: row.breakdown_problem,
    done_action: row.done_action,
    continue_handover: row.continue_handover,
    so: row.so,
  };
}
