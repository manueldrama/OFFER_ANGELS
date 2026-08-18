// İnsan Kaynakları modülü — paylaşılan tipler.
// DB karşılığı: supabase/migrations/20260818a_hr_core.sql

export type EmploymentType = 'full_time' | 'part_time' | 'contractor' | 'intern';

export type HrDepartment =
    | 'sales' | 'support' | 'service' | 'logistics' | 'finance' | 'management' | 'other';

export type PayPeriod = 'monthly' | 'daily' | 'hourly';

/** sales_users'tan gelen kimlik bilgisi (hr_employees'e embed edilir). */
export interface HrEmployeeUser {
    full_name: string | null;
    email: string | null;
    role: string | null;
    is_active: boolean | null;
}

export interface HrEmployee {
    employee_id: string;              // = sales_users.id = auth.users.id
    employee_code: string | null;
    hire_date: string;               // YYYY-MM-DD
    termination_date: string | null;
    employment_type: EmploymentType;
    /** Tam istihdam mı hizmet/danışmanlık mı — sözleşme türünü belirler. */
    engagement_type: EngagementType;
    department: HrDepartment | null;
    job_title: string | null;
    manager_id: string | null;

    work_country: string;            // src/utils/countries.ts kodu
    timezone: string;                // IANA — puantajın gün sınırı buna göre
    work_days: number[];             // ISO gün (1=Pzt … 7=Paz)
    shift_start: string | null;      // HH:MM:SS
    shift_end: string | null;
    weekly_hours: number | null;

    salary_currency: string;

    /** Deneme süresi (ay). İş K. m.15 — sözleşmede yazılı olmalı. */
    probation_months: number | null;

    /** Kişiye özel maksimum aylık bonus. null = global varsayılan kullanılır. */
    max_monthly_bonus: number | null;
    /** Bonus para birimi. null = global varsayılan. Kur dönüşümü YAPILMAZ. */
    bonus_currency: string | null;

    // KVKK hassas — RLS gereği yalnızca super_admin/finance için dolu gelir
    /** İş sözleşmesinin zorunlu unsuru; onboarding formundan da işlenebilir. */
    address: string | null;
    phone: string | null;
    personal_email: string | null;
    iban: string | null;
    national_id: string | null;
    notes: string | null;

    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface HrEmployeeWithUser extends HrEmployee {
    user: HrEmployeeUser | null;
    /** O an geçerli ücret kaydı; İK yetkisi yoksa (RLS) null gelir. */
    current_compensation?: HrCompensation | null;
}

/** Ücretin brüt mü net mi kararlaştırıldığı — 20260820c. */
export type AmountType = 'gross' | 'net';

/**
 * İstihdam şekli — 20260821a.
 *
 * 'contractor' seçilen kişiyle İŞ İLİŞKİSİ KURULMAZ; hizmet sözleşmesi yapılır.
 * Sabit mesai/çalışma günü tanımlıyken bu seçim yanlış sınıflandırma riskidir
 * (geriye dönük prim ve tazminat doğurabilir) — ekran uyarı gösterir.
 */
export type EngagementType = 'employee' | 'contractor';

/** İşveren tüzel kişiliği — ülke başına bir kayıt (20260821a). */
export interface HrCompany {
    id: string;
    country_code: string;
    legal_name: string;
    address: string | null;
    tax_info: string | null;
    registration_no: string | null;
    default_currency: string | null;
    /** Sözleşme dili: TR → 'tr', diğerleri → 'en'. */
    default_language: string;
    /**
     * Ülkenin aylık bonus tavanı (20260901a). Kur = default_currency.
     * NULL = tanım yok → global değere düşülür; 0 = bu ülkede bonus yok.
     */
    max_monthly_bonus: number | null;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrCompensation {
    id: string;
    employee_id: string;
    effective_from: string;          // YYYY-MM-DD
    effective_to: string | null;     // null = hâlen geçerli
    base_amount: number;
    currency: string;
    pay_period: PayPeriod;
    /**
     * Tutarın brüt mü net mi kararlaştırıldığı. OTOMATİK DÖNÜŞÜM YOK — TR'de
     * brüt↔net hesabı SGK, kümülatif vergi matrahı ve istisnalara bağlıdır;
     * yanlış bir net rakam çalışana taahhüt gibi görünür.
     */
    amount_type: AmountType;
    note: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// İşe alım / evrak / onboarding — 20260818b_hr_recruitment_documents.sql
// ─────────────────────────────────────────────────────────────────────────────

export type CandidateStatus =
    | 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn';

export type CandidateSource =
    | 'referral' | 'linkedin' | 'instagram' | 'website' | 'agency' | 'other';

export type DocumentStatus = 'pending_review' | 'approved' | 'rejected';

export type InviteStatus =
    | 'sent' | 'opened' | 'submitted' | 'completed' | 'expired' | 'cancelled';

export interface HrCandidate {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    position_title: string | null;
    department: HrDepartment | null;
    work_country: string;
    source: CandidateSource;
    status: CandidateStatus;
    /** Değerlendirmelerin ortalaması (trigger ile türetilir), 1-5. */
    rating: number | null;
    assigned_to: string | null;
    /** ADAYIN beklentisi. */
    expected_salary: number | null;
    expected_currency: string | null;
    /** ŞİRKETİN teklifi — beklentiden farklıdır (20260820a). */
    offered_salary: number | null;
    offered_currency: string | null;
    offered_start_date: string | null;
    /** Teklif brüt mü net mi — mektupta açıkça yazılır (20260820c). */
    offered_amount_type: AmountType;
    /** Tam istihdam mı danışmanlık mı teklif ediliyor (20260821a). */
    offered_engagement_type: EngagementType;
    notes: string | null;
    rejected_reason: string | null;
    hired_employee_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;

    // ── 20260820b: CV ayrıştırma çıktısı ─────────────────────────────────────
    /** CV'den çıkarılan metin. KVKK: yalnız İK yöneticisi görür. */
    cv_text: string | null;
    /** AI uygunluk TAVSİYESİ (0-100). Karar değildir; rating ile karışmaz. */
    ai_fit_score: number | null;
    ai_evaluation: CandidateAiEvaluation | null;
    ai_evaluated_at: string | null;
    education_level: string | null;
    experience_years: number | null;
    current_company: string | null;
    skills: string[] | null;

    // ── 20260830a: profil, müsaitlik ve teklif onayı ─────────────────────────
    city: string | null;
    /** CV'den çıkarılan iş geçmişi. Yalnız gösterim içindir; sorgulanmaz. */
    work_history: CandidateWorkHistoryItem[] | null;
    /** ADAYIN kaç hafta içinde başlayabileceği — offered_start_date DEĞİL. */
    availability_weeks: number | null;
    /** Teklif bandın üstündeyse 'pending' olur; gereklilik TÜRETİLİR. */
    /** Başvurduğu ilan (20260831a). İlan silinirse NULL olur. */
    job_posting_id: string | null;
    offer_approval_status: OfferApprovalStatus;
    offer_approved_by: string | null;
    offer_approved_at: string | null;
}

export type OfferApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export interface CandidateWorkHistoryItem {
    title: string;
    company: string | null;
    /** YYYY-MM */
    start: string | null;
    /** YYYY-MM — hâlen çalışıyorsa null. */
    end: string | null;
    summary: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// İş ilanları — 20260831a_hr_job_postings.sql
// ─────────────────────────────────────────────────────────────────────────────

export type JobPostingStatus = 'draft' | 'published' | 'closed';
export type JobWorkMode = 'onsite' | 'hybrid' | 'remote';
export type JobEmploymentType = 'full_time' | 'part_time' | 'temporary' | 'intern';

/** Tek dilin içeriği. Boş dil anahtarı content'e HİÇ yazılmaz. */
export interface JobPostingContent {
    title: string;
    summary?: string;
    responsibilities?: string[];
    requirements?: string[];
    benefits?: string[];
}

export interface HrJobPosting {
    id: string;
    slug: string;
    status: JobPostingStatus;
    department: HrDepartment | null;
    work_country: string;
    city: string | null;
    work_mode: JobWorkMode;
    employment_type: JobEmploymentType;
    engagement_type: EngagementType;
    /** Dil → içerik. Çeviri eksikse okuma tarafı default_language'a düşer. */
    content: Record<string, JobPostingContent>;
    default_language: string;
    openings: number;
    closes_at: string | null;
    published_at: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
}

/** Pozisyon maaş bandı — 20260830a_hr_candidate_profile.sql */
export interface HrSalaryBand {
    id: string;
    country_code: string;
    department: string | null;
    position_title: string | null;
    currency: string;
    min_amount: number;
    mid_amount: number | null;
    max_amount: number;
    note: string | null;
}

export interface CandidateAiEvaluation {
    summary: string | null;
    strengths: string[];
    concerns: string[];
    interview_questions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Aday değerlendirme — 20260820b_hr_cv_evaluation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationRecommendation = 'strong_yes' | 'yes' | 'maybe' | 'no';

export interface HrCandidateEvaluation {
    id: string;
    candidate_id: string;
    evaluator_id: string;
    /** Kriter anahtarı → 1-5 puan. Anahtarlar candidateEvaluation.ts'de tanımlı. */
    criteria: Record<string, number>;
    overall: number;
    recommendation: EvaluationRecommendation | null;
    comment: string | null;
    created_at: string;
    updated_at: string;
    /** Join ile gelir — listede "kim puanladı" göstermek için. */
    evaluator_name?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Online video mülakat — 20260822a_hr_interviews.sql
//
// TEK ÇEKİM: aday her soruyu yalnız bir kez cevaplar. Kural veri tabanında
// yaşar (unique(invite_id, question_order) + status kontrolü); buradaki tipler
// yalnızca onu yansıtır.
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewAnswerType = 'video' | 'text';

export type InterviewStatus =
    | 'sent' | 'opened' | 'in_progress' | 'submitted' | 'reviewed' | 'expired' | 'cancelled';

export type InterviewAnswerStatus =
    | 'locked' | 'pending' | 'uploaded' | 'failed' | 'purged';

/** Çok dilli metin: {"tr": "...", "en": "..."}. i18n anahtarı değil VERİDİR. */
export type LocalizedText = Record<string, string>;

export interface HrInterviewTemplate {
    id: string;
    name: string;
    description: string | null;
    position_title: string | null;
    /** null = tüm ülkeler. */
    country_code: string | null;
    default_language: string;
    languages: string[];
    intro_text: LocalizedText;
    outro_text: LocalizedText;
    default_max_seconds: number;
    /** null = düşünme süresi sınırsız; aday hazır olunca başlatır. */
    default_think_seconds: number | null;
    retention_days: number;
    /** Şablon PASİF doğar — yarım soru seti gönderilemez. */
    is_active: boolean;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    /** Join ile gelir. */
    question_count?: number;
}

export interface HrInterviewQuestion {
    id: string;
    template_id: string;
    sort_order: number;
    answer_type: InterviewAnswerType;
    prompt: LocalizedText;
    help_text: LocalizedText;
    is_required: boolean;
    /** null = şablon varsayılanı. */
    max_seconds: number | null;
    think_seconds: number | null;
    max_chars: number;
    created_at: string;
    updated_at: string;
}

/** Davet anında dondurulan soru (INVARIANT B) — şablon değişse de sabit kalır. */
export interface InterviewSnapshotQuestion {
    order: number;
    question_id: string | null;
    answer_type: InterviewAnswerType;
    prompt: LocalizedText;
    help_text: LocalizedText;
    is_required: boolean;
    max_seconds: number;
    think_seconds: number | null;
    max_chars: number;
}

export interface HrInterviewInvite {
    id: string;
    candidate_id: string;
    template_id: string | null;
    language_code: string;
    work_country: string;
    full_name: string | null;
    email: string | null;
    status: InterviewStatus;
    expires_at: string;
    opened_at: string | null;
    started_at: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    questions: InterviewSnapshotQuestion[];
    consent_kvkk: boolean;
    consent_at: string | null;
    /** Aday arayüz dilini değiştirdiyse — language_code yeniden yazılmaz. */
    answered_language: string | null;
    /** hr_interview_reviews ortalaması. hr_candidates.rating'e YAZILMAZ. */
    avg_score: number | null;
    retention_days: number;
    retention_until: string | null;
    purged_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    /** Join ile gelir — panelde "4/6 yanıt" göstermek için. */
    answered_count?: number;
}

export interface HrInterviewAnswer {
    id: string;
    invite_id: string;
    question_id: string | null;
    question_order: number;
    answer_type: InterviewAnswerType;
    text_answer: string | null;
    storage_path: string | null;
    mime_type: string | null;
    file_size: number | null;
    duration_seconds: number | null;
    /** İK "yeniden hak ver" dedikçe artar. Adayın tekrar hakkı DEĞİLDİR. */
    attempt_no: number;
    /** Ağ hatasında yükleme kaç kez denendi. Kayıt tekrarlanmaz. */
    upload_tries: number;
    started_at: string | null;
    status: InterviewAnswerStatus;
    /** AI TAVSİYESİ (1-5) — insan kararıyla aynı alan değildir. */
    ai_score: number | null;
    ai_note: string | null;
    transcript: string | null;
    transcript_lang: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrInterviewReview {
    id: string;
    invite_id: string;
    reviewer_id: string;
    /** {question_id: 1..5} */
    scores: Record<string, number>;
    overall: number;
    recommendation: EvaluationRecommendation | null;
    comment: string | null;
    created_at: string;
    updated_at: string;
    reviewer_name?: string | null;
}

export interface HrCandidateEvent {
    id: string;
    candidate_id: string;
    event_type: 'status_change' | 'note' | 'interview' | 'document' | 'invite';
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    scheduled_at: string | null;
    created_by: string | null;
    created_at: string;
}

export interface HrDocumentType {
    key: string;
    label: string;
    description: string | null;
    uploaded_side: 'employee' | 'company';
    applies_to: 'employee' | 'candidate' | 'both';
    is_required: boolean;
    requires_expiry: boolean;
    country_scope: string[] | null;
    sort_order: number;
    is_active: boolean;
}

export interface HrDocument {
    id: string;
    employee_id: string | null;
    candidate_id: string | null;
    doc_type: string;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    file_size: number | null;
    issued_at: string | null;
    expires_at: string | null;
    status: DocumentStatus;
    review_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    uploaded_via: 'admin' | 'onboarding';
    uploaded_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrOnboardingInvite {
    id: string;
    employee_id: string | null;
    candidate_id: string | null;
    email: string | null;
    full_name: string | null;
    work_country: string;
    status: InviteStatus;
    expires_at: string;
    opened_at: string | null;
    submitted_at: string | null;
    completed_at: string | null;
    personal_data: Record<string, string>;
    consent_kvkk: boolean;
    consent_at: string | null;
    created_at: string;
    updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aday kariyer portalı — 20260824a_hr_candidate_portal.sql
//
// Adayın KALICI adresi: /career/<slug>-<code>. Aday kaydı açılır açılmaz DB
// trigger'ı üretir. `code` ASIL kimliktir; `slug` kozmetiktir ve yetki taşımaz.
// ─────────────────────────────────────────────────────────────────────────────
export interface HrCandidatePortal {
    id: string;
    candidate_id: string;
    slug: string;
    code: string;
    is_active: boolean;
    opened_at: string | null;
    last_seen_at: string | null;
    view_count: number;
    notified_at: string | null;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sözleşmeler — 20260818c_hr_contracts.sql
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 'offer' = İŞ TEKLİFİ MEKTUBU. Sözleşme değildir; adaya gönderilir, kabul
 * edilirse onboarding açılır. Aynı hr_contracts altyapısını kullanır.
 */
/**
 * 'service' = HİZMET / DANIŞMANLIK SÖZLEŞMESİ. İş sözleşmesi değildir;
 * iş kanunu maddeleri (fesih, ihbar, kıdem) İÇERMEZ, bağımsız yüklenici
 * beyanı içerir.
 */
export type ContractType =
    | 'employment' | 'nda' | 'amendment' | 'annex' | 'termination' | 'other'
    | 'offer' | 'service';

export type ContractStatus =
    | 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'cancelled' | 'countersigned';

/**
 * 'e_consent'          → tarayıcıdan ad-soyad beyanı + onay kutusu (delil kaydı;
 *                        NİTELİKLİ E-İMZA DEĞİL)
 * 'wet_signed_upload'  → ıslak imzalı nüshanın taranıp geri yüklenmesi
 */
export type SignatureMethod = 'e_consent' | 'wet_signed_upload';

export interface HrContract {
    id: string;
    employee_id: string | null;
    candidate_id: string | null;
    title: string;
    contract_type: ContractType;
    description: string | null;
    /** Şablondan üretilen sözleşmelerde NULL — metin body_html'de durur. */
    storage_path: string | null;
    file_name: string;
    mime_type: string | null;
    file_size: number | null;
    /** Gönderim anındaki dosya özeti — imza sonrası değiştirilemez. */
    content_sha256: string | null;
    status: ContractStatus;
    valid_from: string | null;
    valid_to: string | null;
    sent_at: string | null;
    viewed_at: string | null;
    signed_at: string | null;
    declined_at: string | null;
    decline_reason: string | null;
    countersigned_at: string | null;
    countersigned_by: string | null;
    signature_method: SignatureMethod | null;
    signed_full_name: string | null;
    signed_ip: string | null;
    signed_user_agent: string | null;
    signed_storage_path: string | null;
    signed_file_name: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;

    // ── 20260819e: sistem içi metin ──────────────────────────────────────────
    /** Sistemde üretilen final metin. İmzadan sonra DB trigger'ı kilitler. */
    body_html: string | null;
    /**
     * Doldurulan değerlerin SNAPSHOT'ı. Maaş sonradan değişse bile imzalanan
     * tutar sabit kalır — canlı veriden yeniden üretilmez.
     */
    variables: Record<string, string> | null;
    template_id: string | null;
    generation_source: 'upload' | 'template';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sözleşme şablonları — 20260819e_hr_contract_templates.sql
// ─────────────────────────────────────────────────────────────────────────────

export interface HrContractTemplate {
    id: string;
    name: string;
    contract_type: ContractType;
    language_code: string;
    /** null = tüm ülkelerde geçerli. Mevcut şablonlar null kalır (20260821a). */
    country_code: string | null;
    /** null = her iki istihdam şekli için de uygun. */
    engagement_type: EngagementType | null;
    /** Yer tutuculu metin — {{adSoyad}} gibi tokenlar KORUNUR. */
    body_html: string | null;
    /** false = TASLAK. AI çıktısı hukuki inceleme görmeden gönderilemez. */
    is_active: boolean;
    /** Esinlenilen örnek sözleşme metni — denetlenebilirlik için saklanır. */
    source_sample: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Puantaj / izin — 20260818d_hr_attendance.sql
// ─────────────────────────────────────────────────────────────────────────────

/** 'auto' = sistemin gözlemi (taslak). Diğerleri İK beyanıdır. */
export type AttendanceStatus =
    | 'auto' | 'present' | 'remote' | 'half_day' | 'leave' | 'sick' | 'holiday' | 'absent';

// 20260827b: paternity/parental/bereavement eklendi. AB ulkelerinde ebeveyn
// ve babalik izni YASAL zorunluluktur; listede olmadigi icin DE/ES/FR/PL
// personeli icin bu izinler hic acilamiyordu.
export type LeaveType =
    | 'annual' | 'unpaid' | 'sick' | 'excuse'
    | 'maternity' | 'paternity' | 'parental' | 'bereavement' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface HrAttendanceDay {
    id: string;
    employee_id: string;
    work_date: string;                  // YYYY-MM-DD (çalışanın saat diliminde)
    /** Sistem gözlemi — elle düzenlenmez, düzeltme bunu silmez. */
    auto_first_seen_at: string | null;
    auto_last_seen_at: string | null;
    auto_active_minutes: number;
    /** Gerçek klavye/fare hareketi olan dakika. auto ile farkı "açık ama boşta". */
    interaction_minutes: number;
    /** Menü grubu bazında dakika dağılımı. Sayfa bazlı kayıt TUTULMAZ (KVKK). */
    section_minutes: Record<string, number>;
    last_interaction_at: string | null;
    /** İK beyanı. */
    effective_check_in: string | null;
    effective_check_out: string | null;
    effective_minutes: number | null;
    status: AttendanceStatus;
    override_reason: string | null;
    overridden_by: string | null;
    overridden_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrLeave {
    id: string;
    employee_id: string;
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    days: number | null;
    reason: string | null;
    status: LeaveStatus;
    decided_by: string | null;
    decided_at: string | null;
    decision_note: string | null;
    requested_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrHoliday {
    id: string;
    holiday_date: string;
    country_code: string;
    label: string;
    is_half_day: boolean;
    /** Hicri takvime bagli — resmi ilanla ±1 gun kayabilir (20260827c). */
    is_estimated: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI — 20260818e_hr_kpi.sql
// ─────────────────────────────────────────────────────────────────────────────

export type KpiUnit = 'currency' | 'count' | 'percent' | 'minutes' | 'hours';
export type KpiDirection = 'higher_better' | 'lower_better';
/** 'manual' = veri sistemde yok, yönetici elle girer (ör. sevkiyat). */
export type KpiSource = 'auto' | 'manual';

export interface HrKpiDefinition {
    key: string;
    label: string;
    description: string | null;
    department_scope: string[] | null;
    source: KpiSource;
    metric: string;
    unit: KpiUnit;
    direction: KpiDirection;
    is_active: boolean;
    sort_order: number;
}

export interface HrKpiTarget {
    id: string;
    employee_id: string | null;   // dolu = kişiye özel, boş = departman geneli
    department: string | null;
    kpi_key: string;
    period_month: string;         // ayın 1'i
    target_value: number;
    currency: string | null;
    note: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrKpiSnapshot {
    id: string;
    employee_id: string;
    kpi_key: string;
    period_month: string;
    currency: string;             // '' = para birimsiz metrik
    actual_value: number | null;
    target_value: number | null;
    /** Hedef yoksa null — sıfır DEĞİL. */
    achievement_pct: number | null;
    note: string | null;
    computed_at: string;
    locked: boolean;
    locked_at: string | null;
    locked_by: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prim — 20260818f_hr_commission.sql
// ─────────────────────────────────────────────────────────────────────────────

export type CommissionRunStatus = 'draft' | 'calculated' | 'approved' | 'locked' | 'cancelled';

export interface HrCommissionRule {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    priority: number;
    scope: Record<string, string[] | undefined>;
    /** Şema: src/lib/hr/commissionRules.ts → CommissionDefinition */
    definition: unknown;
    valid_from: string;
    valid_to: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrCommissionRun {
    id: string;
    period_month: string;
    status: CommissionRunStatus;
    calculated_at: string | null;
    calculated_by: string | null;
    approved_at: string | null;
    approved_by: string | null;
    locked_at: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrCommissionEntry {
    id: string;
    run_id: string;
    employee_id: string;
    currency: string;
    basis_amount: number;
    deal_count: number;
    target_amount: number | null;
    achievement_pct: number | null;
    rule_id: string | null;
    rule_name: string | null;
    /** Hesaplama anındaki kural — sonradan kural değişse bu satır değişmez. */
    rule_snapshot: unknown;
    suggested_amount: number;
    final_amount: number;
    adjustment_reason: string | null;
    source_breakdown: { explanation?: string } | null;
    created_at: string;
    updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bordro / hakediş — 20260818g_hr_payroll.sql
//
// KAPSAM: Basit hakediş. SGK/vergi motoru YOK.
//   net = (baz ücret + prim + ek kalemler) − (avans + kesintiler)
// ─────────────────────────────────────────────────────────────────────────────

export type PayrollPeriodStatus = 'draft' | 'ready' | 'approved' | 'paid' | 'cancelled';
export type PayrollPaymentStatus = 'unpaid' | 'partial' | 'paid';
export type PayrollItemKind =
    | 'bonus' | 'allowance' | 'overtime' | 'advance' | 'deduction' | 'other';

export interface HrPayrollPeriod {
    id: string;
    period_month: string;
    status: PayrollPeriodStatus;
    commission_run_id: string | null;
    note: string | null;
    opened_by: string | null;
    opened_at: string;
    approved_by: string | null;
    approved_at: string | null;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrPayrollLine {
    id: string;
    period_id: string;
    employee_id: string;
    currency: string;
    base_amount: number;
    commission_amount: number;
    worked_days: number | null;
    leave_days: number | null;
    absent_days: number | null;
    /** Bu üç alan SQL trigger'ı tarafından yazılır; uygulama yazmaz. */
    gross_amount: number;
    deduction_amount: number;
    net_payable: number;
    payment_status: PayrollPaymentStatus;
    paid_at: string | null;
    payment_note: string | null;
    created_at: string;
    updated_at: string;
}

export interface HrPayrollItem {
    id: string;
    line_id: string;
    kind: PayrollItemKind;
    label: string;
    /** Her zaman POZİTİF; yön kind ile belirlenir. */
    amount: number;
    note: string | null;
    created_by: string | null;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI v2 — 20260819a_hr_kpi_v2.sql
//
// 5 bileşenli 100 puanlık bileşik skor; bonus SADECE bu skordan hesaplanır.
// Eski hr_kpi_definitions / hr_commission_entries modeli devre dışıdır.
// ─────────────────────────────────────────────────────────────────────────────

export interface HrKpiConfig {
    id: number;
    /** Conversion hedefi (yüzde). Başarı = gerçekleşen / hedef, 1.0'da kırpılır. */
    target_conversion_rate: number;
    /** Bu etiketlere sahip leadler conversion paydasından düşer. */
    invalid_lead_tag_ids: string[];

    followup_tolerance_hours: number;

    /**
     * Öncelikli sayılan leads.status değerleri (ör. hot, warm).
     * AI skoruyla BİRLEŞİM olarak çalışır; biri diğerinin yerine geçmez.
     */
    priority_statuses: string[];
    /** AI skor eşiği. lead_ai_states boşsa etkisizdir. */
    priority_ai_min: number;
    priority_stale_days: number;

    sla_band_high_min: number;
    sla_band_mid_min: number;
    sla_minutes_high: number;
    sla_minutes_mid: number;
    sla_minutes_low: number;

    weight_conversion: number;
    weight_followup: number;
    weight_priority: number;
    weight_sla: number;
    weight_crm: number;
    weight_activity: number;

    /** Bu süre boyunca etkileşim yoksa "boşta" sayılır. */
    activity_idle_minutes: number;
    /** Hedef mesai doluluğu (%). Başarı = doluluk / hedef, 1.0'da kırpılır. */
    activity_target_fill_pct: number;

    max_monthly_bonus: number;
    bonus_currency: string;
    bonus_scale: { min: number; max: number; pct: number }[];

    // ── İşveren bilgileri (20260819e) ────────────────────────────────────────
    // Bu satır fiilen İK modülünün tekil ayar kaydıdır; sözleşme şablonlarının
    // {{sirket*}} yer tutucularını doldurur.
    company_legal_name: string | null;
    company_address: string | null;
    company_tax_info: string | null;

    updated_by: string | null;
    updated_at: string;
}

export interface HrKpiScore {
    id: string;
    employee_id: string;
    period_month: string;
    /** ComponentResult[] — bkz. src/lib/hr/kpiScoring.ts */
    components: unknown;
    /** N/A bileşenler düşüldükten sonraki geçerli ağırlık toplamı. */
    applied_weight: number | null;
    total_score: number | null;
    computed_at: string;
    locked: boolean;
    locked_at: string | null;
    locked_by: string | null;
}

export interface HrPremiumGateViolation {
    id: string;
    employee_id: string;
    period_month: string;
    description: string;
    evidence: string | null;
    /** Bonusa uygulanacak TAVAN yüzdesi. KPI skorunu değiştirmez. */
    cap_pct: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
}

export interface HrBonusEntry {
    id: string;
    run_id: string;
    employee_id: string;
    kpi_score: number | null;
    eligibility_pct: number;
    max_bonus: number;
    /** Gate ÖNCESİ hesaplanan tutar. */
    calculated_bonus: number;
    gate_applied: boolean;
    gate_cap_pct: number | null;
    gate_note: string | null;
    /** Gate SONRASI ödenecek tutar — bordroya bu girer. */
    final_bonus: number;
    currency: string;
    score_snapshot: unknown;
    scale_snapshot: unknown;
    adjustment_reason: string | null;
    created_at: string;
    updated_at: string;
}

/** Çalışanın görünen adı — hr profilinde ad yok, sales_users'tan gelir. */
export function employeeDisplayName(e: Pick<HrEmployeeWithUser, 'user' | 'employee_id'>): string {
    return e.user?.full_name?.trim() || e.user?.email || e.employee_id.slice(0, 8);
}
