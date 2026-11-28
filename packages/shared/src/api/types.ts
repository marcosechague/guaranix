// Shapes of the box API responses as the apps read them (JSON: dates are ISO strings).
import type {
  BookingStatus,
  BoxRole,
  ChargeStatus,
  ClassStatus,
  MemberStatus,
  MovementCategory,
  PaymentMethod,
  PaymentProviderEnvironment,
  PaymentProviderName,
  PaymentStatus,
  PlanKind,
  SavedCardStatus,
  Scaling,
  ScoreType,
  TimerType,
  WorkoutComponentKind,
} from '../domain/enums';

export interface BoxProfile {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  timezone: string;
}

export interface CurrentBoxResponse {
  box: BoxProfile | null;
  role: BoxRole;
}

export interface Member {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalNotes: string | null;
  notes: string | null;
  status: MemberStatus;
  joinedOn: string;
}

export interface Plan {
  id: string;
  name: string;
  kind: PlanKind;
  priceGs: number;
  durationDays: number;
  classesPerWeek: number | null;
  classCount: number | null;
  description: string | null;
  isActive: boolean;
  programIds: string[];
}

export type MemberPlanState = 'upcoming' | 'active' | 'paused' | 'expired' | 'cancelled';

export interface PlanPause {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
}

export interface MemberPlan {
  id: string;
  memberId: string;
  planId: string;
  startsOn: string;
  endsOn: string;
  priceGs: number;
  classesRemaining: number | null;
  state: MemberPlanState;
  pauses: PlanPause[];
}

export interface Program {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface ClassSchedule {
  id: string;
  programId: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  coachUserId: string | null;
  validFrom: string;
  validUntil: string | null;
}

export interface OwnBookingSummary {
  id: string;
  status: BookingStatus;
  waitlistPosition: number | null;
}

export interface ClassSession {
  id: string;
  programId: string;
  scheduleId: string | null;
  coachUserId: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: ClassStatus;
  cancellationReason: string | null;
}

export interface ClassListItem extends ClassSession {
  programName: string;
  programColor: string;
  takenSpots: number;
  spotsLeft: number;
  waitlistCount: number;
  ownBooking: OwnBookingSummary | null;
}

export interface Booking {
  id: string;
  classId: string;
  memberId: string;
  status: BookingStatus;
  waitlistPosition: number | null;
}

export interface OwnBooking {
  booking: Booking;
  class: ClassSession;
}

export interface RosterEntry {
  bookingId: string;
  memberId: string;
  firstName: string;
  lastName: string;
  status: BookingStatus;
  waitlistPosition: number | null;
  checkedInAt: string | null;
}

export interface Movement {
  id: string;
  name: string;
  category: MovementCategory;
}

export interface WorkoutComponent {
  id: string;
  workoutId: string;
  position: number;
  kind: WorkoutComponentKind;
  title: string | null;
  description: string;
  scoreType: ScoreType;
  timerType: TimerType;
  timeCapSeconds: number | null;
  rounds: number | null;
  intervalSeconds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  movementId: string | null;
}

export interface Workout {
  id: string;
  programId: string;
  workoutDate: string;
  title: string | null;
  coachNotes: string | null;
  publishedAt: string | null;
  components: WorkoutComponent[];
}

export interface ScoreValues {
  timeSeconds: number | null;
  rounds: number | null;
  reps: number | null;
  loadGrams: number | null;
  distanceMeters: number | null;
  calories: number | null;
  points: number | null;
}

export interface WorkoutResult extends ScoreValues {
  id: string;
  componentId: string;
  memberId: string;
  scaling: Scaling;
  notes: string | null;
  createdAt: string;
}

export interface LeaderboardEntry extends WorkoutResult {
  firstName: string;
  lastName: string;
  fistBumps: number;
  bumpedByMe: boolean;
}

export interface Leaderboard {
  component: WorkoutComponent;
  entries: LeaderboardEntry[];
}

export interface PersonalRecord {
  id: string;
  memberId: string;
  movementId: string;
  repMax: number | null;
  loadGrams: number | null;
  timeSeconds: number | null;
  reps: number | null;
  achievedOn: string;
}

export interface DashboardReport {
  range: { from: string; to: string };
  money: { collectedGs: number; pendingReviewGs: number; outstandingGs: number; overdueGs: number };
  members: { activeMembers: number; newMembers: number; lostMembers: number };
  classes: { classes: number; occupancyRate: number | null; attended: number };
}

export interface Debtor {
  memberId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  owedGs: number;
  oldestDueOn: string;
  charges: number;
}

export interface Charge {
  id: string;
  memberId: string;
  memberPlanId: string | null;
  description: string;
  amountGs: number;
  dueOn: string;
  status: ChargeStatus;
  paidGs: number;
  outstandingGs: number;
}

export interface Payment {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  chargeId: string | null;
  amountGs: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  reference: string | null;
  /** Private file in R2; open it through `/box/receipts/<key>`. */
  receiptFileKey: string | null;
  notes: string | null;
}

/** The box's own processor account, as the panel sees it: never the private key. */
export interface PaymentAccountView {
  provider: PaymentProviderName;
  environment: PaymentProviderEnvironment;
  publicKeyHint: string;
  privateKeyHint: string;
  autopayEnabled: boolean;
  connected: boolean;
  /** What the box gives Bancard as its confirmation URL. */
  webhookUrl: string;
  updatedAt: string;
}

export interface PaymentSettingsResponse {
  /** The box's GuaraniX plan (or a platform override) includes card payments. */
  included: boolean;
  /** The server can encrypt keys (PAYMENTS_SECRETS_KEY is set). */
  secretsReady: boolean;
  providers: PaymentProviderName[];
  account: PaymentAccountView | null;
}

export interface SavedCardView {
  id: string;
  status: SavedCardStatus;
  brand: string | null;
  last4: string | null;
  expiresOn: string | null;
  autopayConsentAt: string;
  activatedAt: string | null;
}

export interface OwnCardsResponse {
  /** The box takes cards right now. */
  available: boolean;
  autopayEnabled: boolean;
  cards: SavedCardView[];
}

/** The processor's own form. Card numbers are typed there, never in our apps. */
export type HostedCheckoutView =
  | { kind: 'bancard'; form: 'card' | 'payment'; processId: string; scriptUrl: string }
  | { kind: 'mock'; form: 'card' | 'payment'; processId: string };

export interface StartCardResponse {
  card: SavedCardView;
  checkout: HostedCheckoutView;
}

export interface PaymentLinkView {
  status: 'payable' | 'paid' | 'void' | 'expired';
  boxName: string;
  firstName: string;
  description: string;
  amountGs: number;
  dueOn: string;
  expiresAt: string;
}
