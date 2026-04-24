import axios from 'axios'
import {
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './admin.css'

type TabKey =
  | 'dashboard'
  | 'catalogs'
  | 'admins'
  | 'users'
  | 'companies'
  | 'applicants'
  | 'vacancies'
  | 'applications'

type CatalogKey =
  | 'cities'
  | 'professions'
  | 'skills'
  | 'work-schedules'
  | 'employment-types'
  | 'company-types'
  | 'educational-institutions'
  | 'currencies'
  | 'experiences'
  | 'statuses'

type CatalogItem = {
  id: number
  name: string
}

type AuthMeResponse = {
  id: number
  email: string
  role: string
  is_active: boolean
}

type DashboardResponse = {
  users_total?: number
  users_active?: number
  companies_total?: number
  applicants_total?: number
  vacancies_total?: number
  applications_total?: number
  vacancies_by_status?: Record<string, number>
  applications_by_status?: Record<string, number>
  recent_users?: Array<{
    id: number
    email?: string
    role?: string
    is_active?: boolean
    created_at?: string | null
  }>
  recent_vacancies?: Array<{
    id: number
    title?: string
    company_name?: string | null
    status_name?: string | null
    created_at?: string | null
  }>
  recent_applications?: Array<{
    vacancy_id?: number
    resume_id?: number
    status?: string
    vacancy_title?: string | null
    company_name?: string | null
    resume_profession?: string | null
    created_at?: string | null
  }>
}

type UserAdmin = {
  id: number
  email: string
  role: 'applicant' | 'company' | 'admin'
  is_active: boolean
  company_id?: number | null
  applicant_id?: number | null
  created_at?: string | null
  updated_at?: string | null
  company_name?: string | null
  applicant_full_name?: string | null
  vacancies_count?: number
  resumes_count?: number
  applications_count?: number
}

type CompanyAdmin = {
  id: number
  name: string
  website?: string | null
  company_type_name?: string | null
  cities?: string[]
  vacancies_count?: number
  user_id?: number | null
  user_email?: string | null
  is_active: boolean
  description?: string | null
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  vacancy_ids?: number[]
}

type ApplicantAdmin = {
  id: number
  full_name: string
  email?: string | null
  phone?: string | null
  city_name?: string | null
  resumes_count?: number
  educations_count?: number
  is_active: boolean
  birth_date?: string | null
  gender?: string | null
  photo?: string | null
  resumes?: Array<Record<string, unknown>>
  educations?: Array<Record<string, unknown>>
  applications_count?: number
}

type VacancyAdmin = {
  id: number
  title: string
  description?: string | null
  company_id?: number | null
  city_id?: number | null
  profession_id?: number | null
  status_id?: number | null
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
  company_name?: string | null
  city_name?: string | null
  profession_name?: string | null
  status_name?: string | null
  created_at?: string | null
  skills?: Array<{ id?: number; name?: string } | string>
}

type ApplicationAdmin = {
  vacancy_id: number
  resume_id: number
  status: string
  created_at?: string | null
  updated_at?: string | null
  vacancy_title?: string | null
  company_name?: string | null
  applicant_name?: string | null
  resume_profession?: string | null
  city_name?: string | null
  salary_min?: number | null
  salary_max?: number | null
}

type AdminListItem = {
  id: number
  email: string
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

type AdminDetail = {
  id: number
  email: string
  role: string
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

type DetailTarget =
  | { kind: 'admin'; id: number }
  | { kind: 'user'; id: number }
  | { kind: 'company'; id: number }
  | { kind: 'applicant'; id: number }
  | { kind: 'vacancy'; id: number }
  | { kind: 'application'; vacancyId: number; resumeId: number }
  | null

const catalogDefinitions: Array<{ key: CatalogKey; label: string }> = [
  { key: 'cities', label: 'Города' },
  { key: 'professions', label: 'Профессии' },
  { key: 'skills', label: 'Навыки' },
  { key: 'work-schedules', label: 'Графики работы' },
  { key: 'employment-types', label: 'Типы занятости' },
  { key: 'company-types', label: 'Типы компаний' },
  { key: 'educational-institutions', label: 'Учебные заведения' },
  { key: 'currencies', label: 'Валюты' },
  { key: 'experiences', label: 'Опыт работы' },
  { key: 'statuses', label: 'Статусы вакансий' },
]

const statusLabels: Record<string, string> = {
  pending: 'На рассмотрении',
  review: 'На рассмотрении',
  accepted: 'Принят',
  rejected: 'Отклонён',
  sent: 'Отправлен',
}

const toArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) {
    return (value as { items: T[] }).items
  }
  return []
}

const safeString = (value: unknown) => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU')
}

const formatSalary = (min?: number | null, max?: number | null, currency = 'BYN') => {
  if (min && max) return `${min}–${max} ${currency}`
  if (min) return `от ${min} ${currency}`
  if (max) return `до ${max} ${currency}`
  return 'Не указана'
}

const getUserLabel = (user: UserAdmin) => {
  if (user.role === 'admin') return 'Администратор'
  if (user.role === 'company') return 'Работодатель'
  return 'Соискатель'
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }

    if (Array.isArray(detail)) {
      const joined = detail
        .map((item) => (typeof item?.msg === 'string' ? item.msg : ''))
        .filter(Boolean)
        .join('; ')

      if (joined) return joined
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

const maskEmail = (email: string) => {
  const [localPart = '', domain = ''] = email.split('@')
  if (!domain) return email

  const visible = localPart.slice(0, 3)
  const maskedLength = Math.max(localPart.length - visible.length, 3)
  const masked = '•'.repeat(maskedLength)

  return `${visible}${masked}@${domain}`
}

const normalizeUser = (item: Record<string, unknown>): UserAdmin => ({
  id: safeNumber(item.id) ?? 0,
  email: safeString(item.email) || 'Без email',
  role: (safeString(item.role) as UserAdmin['role']) || 'applicant',
  is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
  company_id: safeNumber(item.company_id),
  applicant_id: safeNumber(item.applicant_id),
  created_at: safeString(item.created_at) || null,
  updated_at: safeString(item.updated_at) || null,
  company_name: safeString(item.company_name) || null,
  applicant_full_name: safeString(item.applicant_full_name) || null,
  vacancies_count: safeNumber(item.vacancies_count) ?? 0,
  resumes_count: safeNumber(item.resumes_count) ?? 0,
  applications_count: safeNumber(item.applications_count) ?? 0,
})

const normalizeCompany = (item: Record<string, unknown>): CompanyAdmin => ({
  id: safeNumber(item.id) ?? 0,
  name: safeString(item.name) || 'Без названия',
  website: safeString(item.website) || null,
  company_type_name: safeString(item.company_type_name) || null,
  cities: toArray<string>(item.cities),
  vacancies_count: safeNumber(item.vacancies_count) ?? 0,
  user_id: safeNumber(item.user_id),
  user_email: safeString(item.user_email) || null,
  is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
  description: safeString(item.description) || null,
  logo: safeString(item.logo) || null,
  founded_year: safeNumber(item.founded_year),
  employee_count: safeNumber(item.employee_count),
  vacancy_ids: toArray<number>(item.vacancy_ids),
})

const normalizeApplicant = (item: Record<string, unknown>): ApplicantAdmin => ({
  id: safeNumber(item.id) ?? 0,
  full_name: safeString(item.full_name) || `Соискатель #${safeNumber(item.id) ?? 0}`,
  email: safeString(item.email) || null,
  phone: safeString(item.phone) || null,
  city_name: safeString(item.city_name) || null,
  resumes_count: safeNumber(item.resumes_count) ?? 0,
  educations_count: safeNumber(item.educations_count) ?? 0,
  is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
  birth_date: safeString(item.birth_date) || null,
  gender: safeString(item.gender) || null,
  photo: safeString(item.photo) || null,
  resumes: toArray<Record<string, unknown>>(item.resumes),
  educations: toArray<Record<string, unknown>>(item.educations),
  applications_count: safeNumber(item.applications_count) ?? 0,
})

const normalizeVacancy = (item: Record<string, unknown>): VacancyAdmin => ({
  id: safeNumber(item.id) ?? 0,
  title: safeString(item.title) || 'Без названия',
  description: safeString(item.description) || null,
  company_id: safeNumber(item.company_id),
  city_id: safeNumber(item.city_id),
  profession_id: safeNumber(item.profession_id),
  status_id: safeNumber(item.status_id),
  salary_min: safeNumber(item.salary_min),
  salary_max: safeNumber(item.salary_max),
  currency: safeString(item.currency) || null,
  company_name: safeString(item.company_name) || null,
  city_name: safeString(item.city_name) || null,
  profession_name: safeString(item.profession_name) || null,
  status_name: safeString(item.status_name) || null,
  created_at: safeString(item.created_at) || null,
  skills: Array.isArray(item.skills)
    ? (item.skills as Array<{ id?: number; name?: string } | string>)
    : [],
})

const normalizeApplication = (item: Record<string, unknown>): ApplicationAdmin => ({
  vacancy_id: safeNumber(item.vacancy_id) ?? 0,
  resume_id: safeNumber(item.resume_id) ?? 0,
  status: safeString(item.status) || 'pending',
  created_at: safeString(item.created_at) || null,
  updated_at: safeString(item.updated_at) || null,
  vacancy_title: safeString(item.vacancy_title) || null,
  company_name: safeString(item.company_name) || null,
  applicant_name: safeString(item.applicant_name) || null,
  resume_profession: safeString(item.resume_profession) || null,
  city_name: safeString(item.city_name) || null,
  salary_min: safeNumber(item.salary_min),
  salary_max: safeNumber(item.salary_max),
})

const normalizeAdmin = (item: Record<string, unknown>): AdminListItem => ({
  id: safeNumber(item.id) ?? 0,
  email: safeString(item.email) || 'Без email',
  is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
  created_at: safeString(item.created_at) || null,
  updated_at: safeString(item.updated_at) || null,
})

const fetchAuthMe = async (): Promise<AuthMeResponse> => {
  const { data } = await http.get('/auth/me')
  return data
}

const fetchDashboard = async (): Promise<DashboardResponse> => {
  const { data } = await http.get('/admin/dashboard')
  return data || {}
}

const fetchCatalog = async (name: string): Promise<CatalogItem[]> => {
  const { data } = await http.get(`/admin/catalogs/${name}`, {
    params: { skip: 0, limit: 200 },
  })

  return toArray<Record<string, unknown>>(data).map((item) => ({
    id: safeNumber(item.id) ?? 0,
    name: safeString(item.name) || 'Без названия',
  }))
}

const fetchUsers = async (): Promise<UserAdmin[]> => {
  const { data } = await http.get('/admin/users', {
    params: { skip: 0, limit: 500 },
  })
  return toArray<Record<string, unknown>>(data).map(normalizeUser)
}

const fetchCompanies = async (): Promise<CompanyAdmin[]> => {
  const { data } = await http.get('/admin/companies', {
    params: { skip: 0, limit: 500 },
  })
  return toArray<Record<string, unknown>>(data).map(normalizeCompany)
}

const fetchApplicants = async (): Promise<ApplicantAdmin[]> => {
  const { data } = await http.get('/admin/applicants', {
    params: { skip: 0, limit: 500 },
  })
  return toArray<Record<string, unknown>>(data).map(normalizeApplicant)
}

const fetchVacancies = async (): Promise<VacancyAdmin[]> => {
  const { data } = await http.get('/admin/vacancies', {
    params: { skip: 0, limit: 500 },
  })
  return toArray<Record<string, unknown>>(data).map(normalizeVacancy)
}

const fetchApplications = async (): Promise<ApplicationAdmin[]> => {
  const { data } = await http.get('/admin/applications', {
    params: { skip: 0, limit: 500 },
  })
  return toArray<Record<string, unknown>>(data).map(normalizeApplication)
}

const fetchAdmins = async (): Promise<AdminListItem[]> => {
  const { data } = await http.get('/admin/admins', {
    params: { skip: 0, limit: 500 },
  })
  return toArray<Record<string, unknown>>(data).map(normalizeAdmin)
}

const fetchUserDetail = async (id: number) => {
  const { data } = await http.get(`/admin/users/${id}`)
  return data as Record<string, unknown>
}

const fetchCompanyDetail = async (id: number) => {
  const { data } = await http.get(`/admin/companies/${id}`)
  return data as Record<string, unknown>
}

const fetchApplicantDetail = async (id: number) => {
  const { data } = await http.get(`/admin/applicants/${id}`)
  return data as Record<string, unknown>
}

const fetchVacancyDetail = async (id: number) => {
  const { data } = await http.get(`/admin/vacancies/${id}`)
  return data as Record<string, unknown>
}

const fetchApplicationDetail = async (vacancyId: number, resumeId: number) => {
  const { data } = await http.get(`/admin/applications/${vacancyId}/${resumeId}`)
  return data as Record<string, unknown>
}

const fetchAdminDetail = async (id: number): Promise<AdminDetail> => {
  const { data } = await http.get(`/admin/admins/${id}`)
  return data
}

const Modal = ({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) => {
  return (
    <div className="admin-modal" onClick={onClose}>
      <div className="admin-modal__dialog" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <div>
            <div className="admin-modal__eyebrow">Администрирование</div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          <button type="button" className="admin-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  )
}

const CustomSelect = ({
  value,
  placeholder,
  options,
  isOpen,
  onToggle,
  onSelect,
}: {
  value: string
  placeholder: string
  options: Array<{ value: string | number; label: string }>
  isOpen: boolean
  onToggle: () => void
  onSelect: (value: string | number) => void
}) => (
  <div className={`admin-custom-select ${isOpen ? 'is-open' : ''}`}>
    <button type="button" className="admin-custom-select__trigger" onClick={onToggle}>
      <span>{value || placeholder}</span>
      <span className="admin-custom-select__arrow">▾</span>
    </button>

    {isOpen ? (
      <div className="admin-custom-select__dropdown">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className={`admin-custom-select__option ${value === option.label ? 'is-active' : ''}`}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    ) : null}
  </div>
)

const renderPrimitiveBadge = (value: boolean) => (
  <span className={`admin-badge ${value ? 'admin-badge--success' : 'admin-badge--danger'}`}>
    {value ? 'Да' : 'Нет'}
  </span>
)

const renderEntityButton = (label: string, onClick: () => void) => (
  <button type="button" className="admin-entity-link" onClick={onClick}>
    {label}
  </button>
)

const renderSummaryField = (label: string, value: ReactNode) => (
  <div className="admin-summary-item">
    <span>{label}</span>
    <div>{value}</div>
  </div>
)

const getVacancySkillNames = (value: unknown) => {
  const items = toArray<unknown>(value)
  return items
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        return safeString((item as Record<string, unknown>).name)
      }
      return ''
    })
    .filter(Boolean)
}

export const AdminPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogKey>('cities')
  const [newCatalogName, setNewCatalogName] = useState('')
  const [editingCatalogId, setEditingCatalogId] = useState<number | null>(null)
  const [editingCatalogName, setEditingCatalogName] = useState('')
  const [message, setMessage] = useState('Управляйте платформой централизованно.')
  const [search, setSearch] = useState('')
  const [detailTarget, setDetailTarget] = useState<DetailTarget>(null)
  const [catalogSelectOpen, setCatalogSelectOpen] = useState(false)

  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminListItem | null>(null)
  const [deletingAdmin, setDeletingAdmin] = useState<AdminListItem | null>(null)

  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')

  const [editAdminEmail, setEditAdminEmail] = useState('')
  const [editAdminPassword, setEditAdminPassword] = useState('')
  const [editAdminIsActive, setEditAdminIsActive] = useState(true)
  const [editAdminCurrentPassword, setEditAdminCurrentPassword] = useState('')

  const [deleteAdminCurrentPassword, setDeleteAdminCurrentPassword] = useState('')

  const [isSelfSettingsOpen, setIsSelfSettingsOpen] = useState(false)
  const [selfEmail, setSelfEmail] = useState('')
  const [selfNewPassword, setSelfNewPassword] = useState('')
  const [selfCurrentPassword, setSelfCurrentPassword] = useState('')

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.admin-custom-select')) {
        setCatalogSelectOpen(false)
      }
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  useEffect(() => {
    const hasModal =
      !!detailTarget ||
      isCreateAdminOpen ||
      !!editingAdmin ||
      !!deletingAdmin ||
      isSelfSettingsOpen

    document.body.style.overflow = hasModal ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [detailTarget, isCreateAdminOpen, editingAdmin, deletingAdmin, isSelfSettingsOpen])

  const authMeQuery = useQuery({
    queryKey: ['admin-auth-me'],
    queryFn: fetchAuthMe,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboard,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const adminsQuery = useQuery({
    queryKey: ['admin-admins'],
    queryFn: fetchAdmins,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const companiesQuery = useQuery({
    queryKey: ['admin-companies'],
    queryFn: fetchCompanies,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applicantsQuery = useQuery({
    queryKey: ['admin-applicants'],
    queryFn: fetchApplicants,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const vacanciesQuery = useQuery({
    queryKey: ['admin-vacancies'],
    queryFn: fetchVacancies,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applicationsQuery = useQuery({
    queryKey: ['admin-applications'],
    queryFn: fetchApplications,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const statusesQuery = useQuery({
    queryKey: ['admin-statuses'],
    queryFn: () => fetchCatalog('statuses'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const selectedCatalogQuery = useQuery({
    queryKey: ['admin-catalog', selectedCatalog],
    queryFn: () => fetchCatalog(selectedCatalog),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const userDetailQuery = useQuery({
    queryKey: ['admin-user-detail', detailTarget?.kind === 'user' ? detailTarget.id : null],
    queryFn: () => fetchUserDetail((detailTarget as { kind: 'user'; id: number }).id),
    enabled: detailTarget?.kind === 'user',
    retry: false,
    refetchOnWindowFocus: false,
  })

  const companyDetailQuery = useQuery({
    queryKey: ['admin-company-detail', detailTarget?.kind === 'company' ? detailTarget.id : null],
    queryFn: () => fetchCompanyDetail((detailTarget as { kind: 'company'; id: number }).id),
    enabled: detailTarget?.kind === 'company',
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applicantDetailQuery = useQuery({
    queryKey: ['admin-applicant-detail', detailTarget?.kind === 'applicant' ? detailTarget.id : null],
    queryFn: () => fetchApplicantDetail((detailTarget as { kind: 'applicant'; id: number }).id),
    enabled: detailTarget?.kind === 'applicant',
    retry: false,
    refetchOnWindowFocus: false,
  })

  const vacancyDetailQuery = useQuery({
    queryKey: ['admin-vacancy-detail', detailTarget?.kind === 'vacancy' ? detailTarget.id : null],
    queryFn: () => fetchVacancyDetail((detailTarget as { kind: 'vacancy'; id: number }).id),
    enabled: detailTarget?.kind === 'vacancy',
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applicationDetailQuery = useQuery({
    queryKey: [
      'admin-application-detail',
      detailTarget?.kind === 'application' ? detailTarget.vacancyId : null,
      detailTarget?.kind === 'application' ? detailTarget.resumeId : null,
    ],
    queryFn: () =>
      fetchApplicationDetail(
        (detailTarget as { kind: 'application'; vacancyId: number; resumeId: number }).vacancyId,
        (detailTarget as { kind: 'application'; vacancyId: number; resumeId: number }).resumeId,
      ),
    enabled: detailTarget?.kind === 'application',
    retry: false,
    refetchOnWindowFocus: false,
  })

  const adminDetailQuery = useQuery({
    queryKey: ['admin-detail', detailTarget?.kind === 'admin' ? detailTarget.id : null],
    queryFn: () => fetchAdminDetail((detailTarget as { kind: 'admin'; id: number }).id),
    enabled: detailTarget?.kind === 'admin',
    retry: false,
    refetchOnWindowFocus: false,
  })

  const toggleUserMutation = useMutation({
    mutationFn: async (user: UserAdmin) => {
      await http.patch(`/admin/users/${user.id}/status`, {
        is_active: !user.is_active,
      })
    },
    onSuccess: async () => {
      setMessage('Статус пользователя обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось изменить статус пользователя.'))
    },
  })

  const toggleCompanyMutation = useMutation({
    mutationFn: async (company: CompanyAdmin) => {
      await http.patch(`/admin/companies/${company.id}/status`, {
        is_active: !company.is_active,
      })
    },
    onSuccess: async () => {
      setMessage('Статус компании обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось обновить статус компании.'))
    },
  })

  const toggleApplicantMutation = useMutation({
    mutationFn: async (applicant: ApplicantAdmin) => {
      await http.patch(`/admin/applicants/${applicant.id}/status`, {
        is_active: !applicant.is_active,
      })
    },
    onSuccess: async () => {
      setMessage('Статус соискателя обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-applicants'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось обновить статус соискателя.'))
    },
  })

  const updateVacancyStatusMutation = useMutation({
    mutationFn: async (params: { vacancyId: number; statusId: number }) => {
      await http.patch(`/admin/vacancies/${params.vacancyId}/status`, {
        status_id: params.statusId,
      })
    },
    onSuccess: async () => {
      setMessage('Статус вакансии обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-vacancies'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось обновить статус вакансии.'))
    },
  })

  const updateApplicationStatusMutation = useMutation({
    mutationFn: async (params: { vacancyId: number; resumeId: number; status: string }) => {
      await http.patch(`/admin/applications/${params.vacancyId}/${params.resumeId}`, {
        status: params.status,
      })
    },
    onSuccess: async () => {
      setMessage('Статус отклика обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-applications'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось обновить статус отклика.'))
    },
  })

  const createCatalogItemMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/admin/catalogs/${selectedCatalog}`, {
        name: newCatalogName.trim(),
      })
    },
    onSuccess: async () => {
      setNewCatalogName('')
      setMessage('Элемент справочника создан.')
      await queryClient.invalidateQueries({ queryKey: ['admin-catalog', selectedCatalog] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось создать элемент справочника.'))
    },
  })

  const updateCatalogItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await http.put(`/admin/catalogs/${selectedCatalog}/${itemId}`, {
        name: editingCatalogName.trim(),
      })
    },
    onSuccess: async () => {
      setEditingCatalogId(null)
      setEditingCatalogName('')
      setMessage('Элемент справочника обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-catalog', selectedCatalog] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось обновить элемент справочника.'))
    },
  })

  const deleteCatalogItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await http.delete(`/admin/catalogs/${selectedCatalog}/${itemId}`)
    },
    onSuccess: async () => {
      setMessage('Элемент справочника удалён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-catalog', selectedCatalog] })
    },
    onError: (error) => {
      setMessage(
        getErrorMessage(
          error,
          'Не удалось удалить элемент справочника. Возможно, он уже используется.',
        ),
      )
    },
  })

  const createAdminMutation = useMutation({
    mutationFn: async () => {
      await http.post('/admin/admins', {
        email: newAdminEmail.trim(),
        password: newAdminPassword,
      })
    },
    onSuccess: async () => {
      setNewAdminEmail('')
      setNewAdminPassword('')
      setIsCreateAdminOpen(false)
      setMessage('Новый администратор создан.')
      await queryClient.invalidateQueries({ queryKey: ['admin-admins'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось создать администратора.'))
    },
  })

  const updateAdminMutation = useMutation({
    mutationFn: async (adminId: number) => {
      await http.patch(`/admin/admins/${adminId}`, {
        email: editAdminEmail.trim(),
        new_password: editAdminPassword.trim() || null,
        is_active: editAdminIsActive,
        current_admin_password: editAdminCurrentPassword,
      })
    },
    onSuccess: async () => {
      setEditingAdmin(null)
      setEditAdminEmail('')
      setEditAdminPassword('')
      setEditAdminCurrentPassword('')
      setMessage('Администратор обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-admins'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось обновить администратора.'))
    },
  })

  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: number) => {
      await http.delete(`/admin/admins/${adminId}`, {
        data: {
          current_admin_password: deleteAdminCurrentPassword,
        },
      })
    },
    onSuccess: async () => {
      setDeletingAdmin(null)
      setDeleteAdminCurrentPassword('')
      setMessage('Администратор удалён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-admins'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось удалить администратора.'))
    },
  })

  const updateSelfSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!authMeQuery.data?.id) {
        throw new Error('Не удалось определить текущего администратора')
      }

      const normalizedEmail = selfEmail.trim()
      const currentEmail = authMeQuery.data.email || ''
      const passwordChanged = selfNewPassword.trim().length > 0
      const emailChanged = normalizedEmail !== currentEmail

      if (!emailChanged && !passwordChanged) {
        throw new Error('Нет изменений для сохранения')
      }

      if (!selfCurrentPassword.trim()) {
        throw new Error('Введите текущий пароль')
      }

      if (passwordChanged && selfNewPassword.trim().length < 8) {
        throw new Error('Новый пароль должен содержать минимум 8 символов')
      }

      await http.patch(`/admin/admins/${authMeQuery.data.id}`, {
        email: normalizedEmail,
        new_password: passwordChanged ? selfNewPassword.trim() : null,
        is_active: authMeQuery.data.is_active ?? true,
        current_admin_password: selfCurrentPassword,
      })

      return { passwordChanged }
    },
    onSuccess: async ({ passwordChanged }) => {
      setMessage(
        passwordChanged
          ? 'Данные обновлены. После смены пароля нужно войти заново.'
          : 'Данные администратора обновлены.',
      )

      setIsSelfSettingsOpen(false)
      setSelfCurrentPassword('')
      setSelfNewPassword('')

      await queryClient.invalidateQueries({ queryKey: ['admin-auth-me'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-admins'] })

      if (passwordChanged) {
        authSession.clear()
        navigate('/admin/login', { replace: true })
      }
    },
    onError: (error) => {
      setMessage(getErrorMessage(error, 'Не удалось обновить данные администратора.'))
    },
  })

  const filteredAdmins = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return adminsQuery.data || []

    return (adminsQuery.data || []).filter((item) => {
      return item.email.toLowerCase().includes(value) || String(item.id).includes(value)
    })
  }, [search, adminsQuery.data])

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return usersQuery.data || []

    return (usersQuery.data || []).filter((item) => {
      return (
        item.email.toLowerCase().includes(value) ||
        item.role.toLowerCase().includes(value) ||
        String(item.id).includes(value)
      )
    })
  }, [search, usersQuery.data])

  const filteredCompanies = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return companiesQuery.data || []

    return (companiesQuery.data || []).filter((item) => {
      return (
        item.name.toLowerCase().includes(value) ||
        safeString(item.website).toLowerCase().includes(value) ||
        String(item.id).includes(value)
      )
    })
  }, [search, companiesQuery.data])

  const filteredApplicants = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return applicantsQuery.data || []

    return (applicantsQuery.data || []).filter((item) => {
      return (
        item.full_name.toLowerCase().includes(value) ||
        safeString(item.phone).toLowerCase().includes(value) ||
        safeString(item.email).toLowerCase().includes(value) ||
        String(item.id).includes(value)
      )
    })
  }, [search, applicantsQuery.data])

  const filteredVacancies = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return vacanciesQuery.data || []

    return (vacanciesQuery.data || []).filter((item) => {
      return (
        item.title.toLowerCase().includes(value) ||
        safeString(item.description).toLowerCase().includes(value) ||
        safeString(item.company_name).toLowerCase().includes(value) ||
        String(item.id).includes(value)
      )
    })
  }, [search, vacanciesQuery.data])

  const filteredApplications = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return applicationsQuery.data || []

    return (applicationsQuery.data || []).filter((item) => {
      return (
        safeString(item.vacancy_title).toLowerCase().includes(value) ||
        safeString(item.company_name).toLowerCase().includes(value) ||
        safeString(item.resume_profession).toLowerCase().includes(value) ||
        safeString(item.applicant_name).toLowerCase().includes(value) ||
        String(item.vacancy_id).includes(value) ||
        String(item.resume_id).includes(value)
      )
    })
  }, [search, applicationsQuery.data])

  const fallbackStats = useMemo(() => {
    return {
      users_total: usersQuery.data?.length ?? 0,
      users_active: usersQuery.data?.filter((item) => item.is_active).length ?? 0,
      companies_total: companiesQuery.data?.length ?? 0,
      applicants_total: applicantsQuery.data?.length ?? 0,
      vacancies_total: vacanciesQuery.data?.length ?? 0,
      applications_total: applicationsQuery.data?.length ?? 0,
    }
  }, [
    usersQuery.data,
    companiesQuery.data,
    applicantsQuery.data,
    vacanciesQuery.data,
    applicationsQuery.data,
  ])

  const dashboard = {
    ...fallbackStats,
    ...(dashboardQuery.data || {}),
  }

  const selectedCatalogLabel = useMemo(() => {
    return catalogDefinitions.find((item) => item.key === selectedCatalog)?.label || 'Справочник'
  }, [selectedCatalog])

  const detailData =
    detailTarget?.kind === 'admin'
      ? adminDetailQuery.data
      : detailTarget?.kind === 'user'
        ? userDetailQuery.data
        : detailTarget?.kind === 'company'
          ? companyDetailQuery.data
          : detailTarget?.kind === 'applicant'
            ? applicantDetailQuery.data
            : detailTarget?.kind === 'vacancy'
              ? vacancyDetailQuery.data
              : detailTarget?.kind === 'application'
                ? applicationDetailQuery.data
                : null

  const detailLoading =
    adminDetailQuery.isLoading ||
    userDetailQuery.isLoading ||
    companyDetailQuery.isLoading ||
    applicantDetailQuery.isLoading ||
    vacancyDetailQuery.isLoading ||
    applicationDetailQuery.isLoading

  const openDetail = (target: DetailTarget) => {
    setDetailTarget(target)
  }

  const closeDetail = () => {
    setDetailTarget(null)
  }

  const openCompanyById = (companyId?: number | null) => {
    if (!companyId) return
    openDetail({ kind: 'company', id: companyId })
  }

  const openApplicantById = (applicantId?: number | null) => {
    if (!applicantId) return
    openDetail({ kind: 'applicant', id: applicantId })
  }

  const openVacancyById = (vacancyId?: number | null) => {
    if (!vacancyId) return
    openDetail({ kind: 'vacancy', id: vacancyId })
  }

  const openUserById = (userId?: number | null) => {
    if (!userId) return
    openDetail({ kind: 'user', id: userId })
  }

  const findCompanyByName = (name?: string | null) => {
    const normalized = safeString(name).trim().toLowerCase()
    if (!normalized) return null
    return (companiesQuery.data || []).find(
      (item) => item.name.trim().toLowerCase() === normalized,
    )
  }

  const findApplicantByName = (name?: string | null) => {
    const normalized = safeString(name).trim().toLowerCase()
    if (!normalized) return null
    return (applicantsQuery.data || []).find(
      (item) => item.full_name.trim().toLowerCase() === normalized,
    )
  }

  const renderAdminDetailContent = () => {
    const data = (detailData || {}) as Record<string, unknown>

    return (
      <div className="admin-detail-layout">
        <section className="admin-section">
          <div className="admin-section__header">
            <h4>{safeString(data.email) || `Администратор #${safeNumber(data.id) ?? 0}`}</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField('Email', <span>{safeString(data.email) || '—'}</span>)}
            {renderSummaryField('Роль', <span>Администратор</span>)}
            {renderSummaryField(
              'Статус',
              typeof data.is_active === 'boolean'
                ? renderPrimitiveBadge(Boolean(data.is_active))
                : <span>—</span>,
            )}
            {renderSummaryField('Создан', <span>{formatDateTime(safeString(data.created_at) || null)}</span>)}
            {renderSummaryField('Обновлён', <span>{formatDateTime(safeString(data.updated_at) || null)}</span>)}
          </div>
        </section>
      </div>
    )
  }

  const renderUserDetailContent = () => {
    const data = (detailData || {}) as Record<string, unknown>
    const role = safeString(data.role)
    const companyId = safeNumber(data.company_id)
    const applicantId = safeNumber(data.applicant_id)
    const companyName = safeString(data.company_name)
    const applicantFullName = safeString(data.applicant_full_name)

    return (
      <div className="admin-detail-layout">
        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Основная информация</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField('Email', <span>{safeString(data.email) || '—'}</span>)}
            {renderSummaryField(
              'Роль',
              <span>
                {role === 'admin'
                  ? 'Администратор'
                  : role === 'company'
                    ? 'Работодатель'
                    : 'Соискатель'}
              </span>,
            )}
            {renderSummaryField(
              'Статус',
              typeof data.is_active === 'boolean'
                ? renderPrimitiveBadge(Boolean(data.is_active))
                : <span>—</span>,
            )}
            {renderSummaryField('Создан', <span>{formatDateTime(safeString(data.created_at) || null)}</span>)}
            {renderSummaryField('Обновлён', <span>{formatDateTime(safeString(data.updated_at) || null)}</span>)}
            {renderSummaryField('Количество вакансий', <span>{safeString(data.vacancies_count) || '0'}</span>)}
            {renderSummaryField('Количество резюме', <span>{safeString(data.resumes_count) || '0'}</span>)}
            {renderSummaryField('Количество откликов', <span>{safeString(data.applications_count) || '0'}</span>)}
          </div>
        </section>

        {role === 'company' ? (
          <section className="admin-section">
            <div className="admin-section__header">
              <h4>Связанная компания</h4>
            </div>

            {companyId ? (
              <div className="admin-section__body">
                {renderEntityButton(companyName || `Компания #${companyId}`, () => openCompanyById(companyId))}
              </div>
            ) : (
              <div className="admin-empty-inline">Компания не привязана</div>
            )}
          </section>
        ) : null}

        {role === 'applicant' ? (
          <section className="admin-section">
            <div className="admin-section__header">
              <h4>Связанный соискатель</h4>
            </div>

            {applicantId ? (
              <div className="admin-section__body">
                {renderEntityButton(
                  applicantFullName || `Соискатель #${applicantId}`,
                  () => openApplicantById(applicantId),
                )}
              </div>
            ) : (
              <div className="admin-empty-inline">Соискатель не привязан</div>
            )}
          </section>
        ) : null}
      </div>
    )
  }

  const renderCompanyDetailContent = () => {
    const data = (detailData || {}) as Record<string, unknown>
    const companyId = safeNumber(data.id) ?? 0
    const linkedVacancies = (vacanciesQuery.data || []).filter((item) => item.company_id === companyId)

    return (
      <div className="admin-detail-layout">
        <section className="admin-section">
          <div className="admin-section__header">
            <h4>{safeString(data.name) || `Компания #${companyId}`}</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField('Тип компании', <span>{safeString(data.company_type_name) || '—'}</span>)}
            {renderSummaryField(
              'Сайт',
              safeString(data.website) ? (
                <a href={safeString(data.website)} target="_blank" rel="noreferrer" className="admin-detail-link">
                  {safeString(data.website)}
                </a>
              ) : (
                <span>—</span>
              ),
            )}
            {renderSummaryField(
              'Статус',
              typeof data.is_active === 'boolean'
                ? renderPrimitiveBadge(Boolean(data.is_active))
                : <span>—</span>,
            )}
            {renderSummaryField('Год основания', <span>{safeString(data.founded_year) || '—'}</span>)}
            {renderSummaryField('Сотрудников', <span>{safeString(data.employee_count) || '—'}</span>)}
            {renderSummaryField('Вакансий', <span>{safeString(data.vacancies_count) || '0'}</span>)}
          </div>

          {safeString(data.description) ? (
            <div className="admin-description-box">{safeString(data.description)}</div>
          ) : null}
        </section>

        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Связанные данные</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField(
              'Пользователь',
              safeNumber(data.user_id) ? (
                renderEntityButton(
                  safeString(data.user_email) || `Пользователь #${safeNumber(data.user_id)}`,
                  () => openUserById(safeNumber(data.user_id)),
                )
              ) : (
                <span>—</span>
              ),
            )}

            {renderSummaryField(
              'Города',
              toArray<string>(data.cities).length ? (
                <div className="admin-chip-list">
                  {toArray<string>(data.cities).map((city) => (
                    <span key={city} className="admin-chip">{city}</span>
                  ))}
                </div>
              ) : (
                <span>—</span>
              ),
            )}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Вакансии компании</h4>
          </div>

          {linkedVacancies.length > 0 ? (
            <div className="admin-linked-card-grid">
              {linkedVacancies.map((vacancy) => (
                <button
                  key={vacancy.id}
                  type="button"
                  className="admin-linked-card"
                  onClick={() => openVacancyById(vacancy.id)}
                >
                  <div className="admin-linked-card__title">{vacancy.title}</div>
                  <div className="admin-linked-card__meta">
                    <span>{vacancy.city_name || 'Город не указан'}</span>
                    <span>{vacancy.status_name || 'Статус не указан'}</span>
                  </div>
                  <div className="admin-linked-card__text">
                    {formatSalary(vacancy.salary_min, vacancy.salary_max, vacancy.currency || 'BYN')}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="admin-empty-inline">У компании пока нет вакансий</div>
          )}
        </section>
      </div>
    )
  }

  const renderApplicantDetailContent = () => {
    const data = (detailData || {}) as Record<string, unknown>
    const resumes = toArray<Record<string, unknown>>(data.resumes)
    const educations = toArray<Record<string, unknown>>(data.educations)

    const workExperienceCards = resumes.flatMap((resume) => {
      const workExperiences = toArray<Record<string, unknown>>(resume.work_experiences)
      const professionName = safeString(resume.profession_name) || `Резюме #${safeNumber(resume.id) ?? '—'}`
      const count = safeNumber(resume.work_experiences_count) ?? 0

      if (workExperiences.length > 0) {
        return workExperiences.map((item, index) => ({
          id: `${safeNumber(resume.id) ?? 'resume'}-${index}`,
          title:
            safeString(item.position) ||
            safeString(item.job_title) ||
            safeString(item.company_name) ||
            'Опыт работы',
          subtitle: safeString(item.company_name) || professionName,
          period: [
            safeString(item.start_date) ? formatDateTime(safeString(item.start_date)) : '',
            safeString(item.end_date) ? formatDateTime(safeString(item.end_date)) : 'по настоящее время',
          ]
            .filter(Boolean)
            .join(' — '),
          description: safeString(item.description) || '',
        }))
      }

      if (count > 0) {
        return [
          {
            id: `resume-summary-${safeNumber(resume.id) ?? professionName}`,
            title: professionName,
            subtitle: 'Сводка по резюме',
            period: '',
            description: `Количество записей опыта работы: ${count}`,
          },
        ]
      }

      return []
    })

    return (
      <div className="admin-detail-layout">
        <section className="admin-section">
          <div className="admin-section__header">
            <h4>{safeString(data.full_name) || `Соискатель #${safeNumber(data.id) ?? 0}`}</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField('Email', <span>{safeString(data.email) || '—'}</span>)}
            {renderSummaryField('Телефон', <span>{safeString(data.phone) || '—'}</span>)}
            {renderSummaryField('Город', <span>{safeString(data.city_name) || '—'}</span>)}
            {renderSummaryField(
              'Пол',
              <span>
                {safeString(data.gender) === 'м'
                  ? 'Мужской'
                  : safeString(data.gender) === 'ж'
                    ? 'Женский'
                    : safeString(data.gender) || '—'}
              </span>,
            )}
            {renderSummaryField('Дата рождения', <span>{formatDateTime(safeString(data.birth_date) || null)}</span>)}
            {renderSummaryField(
              'Статус',
              typeof data.is_active === 'boolean'
                ? renderPrimitiveBadge(Boolean(data.is_active))
                : <span>—</span>,
            )}
            {renderSummaryField('Резюме', <span>{safeString(data.resumes_count) || '0'}</span>)}
            {renderSummaryField('Образование', <span>{safeString(data.educations_count) || '0'}</span>)}
            {renderSummaryField('Отклики', <span>{safeString(data.applications_count) || '0'}</span>)}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Резюме</h4>
          </div>

          {resumes.length > 0 ? (
            <div className="admin-linked-card-grid">
              {resumes.map((resume) => (
                <div key={String(resume.id)} className="admin-linked-card admin-linked-card--static">
                  <div className="admin-linked-card__title">
                    {safeString(resume.profession_name) || `Резюме #${safeNumber(resume.id) ?? '—'}`}
                  </div>

                  <div className="admin-linked-card__meta">
                    <span>Откликов: {safeString(resume.applications_count) || '0'}</span>
                    <span>Опытов работы: {safeString(resume.work_experiences_count) || '0'}</span>
                  </div>

                  {toArray<string>(resume.skills).length > 0 ? (
                    <div className="admin-chip-list">
                      {toArray<string>(resume.skills).map((skill) => (
                        <span key={skill} className="admin-chip">{skill}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty-inline">Резюме не найдены</div>
          )}
        </section>

        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Образование</h4>
          </div>

          {educations.length > 0 ? (
            <div className="admin-linked-card-grid">
              {educations.map((education) => (
                <div key={String(education.id)} className="admin-linked-card admin-linked-card--static">
                  <div className="admin-linked-card__title">
                    {safeString(education.institution_name) || `Образование #${safeNumber(education.id) ?? '—'}`}
                  </div>
                  <div className="admin-linked-card__meta">
                    <span>{safeString(education.start_date) ? formatDateTime(safeString(education.start_date)) : '—'}</span>
                    <span>{safeString(education.end_date) ? formatDateTime(safeString(education.end_date)) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty-inline">Образование не указано</div>
          )}
        </section>

        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Опыт работы</h4>
          </div>

          {workExperienceCards.length > 0 ? (
            <div className="admin-linked-card-grid">
              {workExperienceCards.map((item) => (
                <div key={item.id} className="admin-linked-card admin-linked-card--static">
                  <div className="admin-linked-card__title">{item.title}</div>
                  <div className="admin-linked-card__meta">
                    <span>{item.subtitle}</span>
                    {item.period ? <span>{item.period}</span> : null}
                  </div>
                  {item.description ? (
                    <div className="admin-linked-card__text">{item.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty-inline">Опыт работы не указан</div>
          )}
        </section>
      </div>
    )
  }

  const renderVacancyDetailContent = () => {
    const data = (detailData || {}) as Record<string, unknown>
    const companyId = safeNumber(data.company_id)
    const skillNames = getVacancySkillNames(data.skills)

    return (
      <div className="admin-detail-layout">
        <section className="admin-section">
          <div className="admin-section__header">
            <h4>{safeString(data.title) || `Вакансия #${safeNumber(data.id) ?? 0}`}</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField(
              'Компания',
              companyId ? (
                renderEntityButton(
                  safeString(data.company_name) || `Компания #${companyId}`,
                  () => openCompanyById(companyId),
                )
              ) : (
                <span>{safeString(data.company_name) || '—'}</span>
              ),
            )}
            {renderSummaryField('Город', <span>{safeString(data.city_name) || '—'}</span>)}
            {renderSummaryField('Профессия', <span>{safeString(data.profession_name) || '—'}</span>)}
            {renderSummaryField('Статус', <span>{safeString(data.status_name) || '—'}</span>)}
            {renderSummaryField(
              'Зарплата',
              <span>
                {formatSalary(
                  safeNumber(data.salary_min),
                  safeNumber(data.salary_max),
                  safeString(data.currency) || 'BYN',
                )}
              </span>,
            )}
            {renderSummaryField('Создана', <span>{formatDateTime(safeString(data.created_at) || null)}</span>)}
          </div>

          {safeString(data.description) ? (
            <div className="admin-description-box">{safeString(data.description)}</div>
          ) : null}
        </section>

        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Навыки</h4>
          </div>

          {skillNames.length > 0 ? (
            <div className="admin-chip-list">
              {skillNames.map((skill) => (
                <span key={skill} className="admin-chip">{skill}</span>
              ))}
            </div>
          ) : (
            <div className="admin-empty-inline">Навыки не указаны</div>
          )}
        </section>
      </div>
    )
  }

  const renderApplicationDetailContent = () => {
    const data = (detailData || {}) as Record<string, unknown>
    const matchedCompany = findCompanyByName(safeString(data.company_name))
    const matchedApplicant = findApplicantByName(safeString(data.applicant_name))

    return (
      <div className="admin-detail-layout">
        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Информация об отклике</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField(
              'Вакансия',
              safeNumber(data.vacancy_id) ? (
                renderEntityButton(
                  safeString(data.vacancy_title) || `Вакансия #${safeNumber(data.vacancy_id)}`,
                  () => openVacancyById(safeNumber(data.vacancy_id)),
                )
              ) : (
                <span>{safeString(data.vacancy_title) || '—'}</span>
              ),
            )}

            {renderSummaryField(
              'Компания',
              matchedCompany ? (
                renderEntityButton(matchedCompany.name, () => openCompanyById(matchedCompany.id))
              ) : (
                <span>{safeString(data.company_name) || '—'}</span>
              ),
            )}

            {renderSummaryField(
              'Соискатель',
              matchedApplicant ? (
                renderEntityButton(matchedApplicant.full_name, () => openApplicantById(matchedApplicant.id))
              ) : (
                <span>{safeString(data.applicant_name) || '—'}</span>
              ),
            )}

            {renderSummaryField('Профессия резюме', <span>{safeString(data.resume_profession) || '—'}</span>)}
            {renderSummaryField('Город', <span>{safeString(data.city_name) || '—'}</span>)}
            {renderSummaryField(
              'Статус',
              <span>{statusLabels[safeString(data.status)] || safeString(data.status) || '—'}</span>,
            )}
            {renderSummaryField('Создан', <span>{formatDateTime(safeString(data.created_at) || null)}</span>)}
            {renderSummaryField('Обновлён', <span>{formatDateTime(safeString(data.updated_at) || null)}</span>)}
            {renderSummaryField(
              'Зарплата по вакансии',
              <span>{formatSalary(safeNumber(data.salary_min), safeNumber(data.salary_max), 'BYN')}</span>,
            )}
          </div>
        </section>
      </div>
    )
  }

  const renderDashboard = () => (
    <div className="admin-panel">
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <span>Пользователи</span>
          <strong>{dashboard.users_total ?? 0}</strong>
        </div>

        <div className="admin-stat-card">
          <span>Активные пользователи</span>
          <strong>{dashboard.users_active ?? 0}</strong>
        </div>

        <div className="admin-stat-card">
          <span>Компании</span>
          <strong>{dashboard.companies_total ?? 0}</strong>
        </div>

        <div className="admin-stat-card">
          <span>Соискатели</span>
          <strong>{dashboard.applicants_total ?? 0}</strong>
        </div>

        <div className="admin-stat-card">
          <span>Вакансии</span>
          <strong>{dashboard.vacancies_total ?? 0}</strong>
        </div>

        <div className="admin-stat-card">
          <span>Отклики</span>
          <strong>{dashboard.applications_total ?? 0}</strong>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-card">
          <div className="admin-card__header">
            <h3>Последние пользователи</h3>
          </div>

          <div className="admin-stack">
            {(dashboard.recent_users || []).length > 0 ? (
              dashboard.recent_users?.map((item) => (
                <div key={item.id} className="admin-list-row">
                  <div>
                    <strong className="admin-email-text">
                      {item.email ? maskEmail(item.email) : `Пользователь #${item.id}`}
                    </strong>
                    <p>
                      {item.role === 'admin'
                        ? 'Администратор'
                        : item.role === 'company'
                          ? 'Работодатель'
                          : 'Соискатель'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="admin-action-btn"
                    onClick={() => {
                      setActiveTab(item.role === 'admin' ? 'admins' : 'users')
                      openDetail(
                        item.role === 'admin'
                          ? { kind: 'admin', id: item.id }
                          : { kind: 'user', id: item.id },
                      )
                    }}
                  >
                    Подробнее
                  </button>
                </div>
              ))
            ) : (
              <div className="admin-empty-inline">Нет данных</div>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card__header">
            <h3>Последние вакансии</h3>
          </div>

          <div className="admin-stack">
            {(dashboard.recent_vacancies || []).length > 0 ? (
              dashboard.recent_vacancies?.map((item) => (
                <div key={item.id} className="admin-list-row">
                  <div>
                    <strong>{item.title || `Вакансия #${item.id}`}</strong>
                    <p>{item.company_name || 'Компания не указана'}</p>
                  </div>

                  <button
                    type="button"
                    className="admin-action-btn"
                    onClick={() => {
                      setActiveTab('vacancies')
                      openDetail({ kind: 'vacancy', id: item.id })
                    }}
                  >
                    Подробнее
                  </button>
                </div>
              ))
            ) : (
              <div className="admin-empty-inline">Нет данных</div>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card__header">
            <h3>Последние отклики</h3>
          </div>

          <div className="admin-stack">
            {(dashboard.recent_applications || []).length > 0 ? (
              dashboard.recent_applications?.map((item, index) => (
                <div key={`${item.vacancy_id}-${item.resume_id}-${index}`} className="admin-list-row">
                  <div>
                    <strong>{item.vacancy_title || `Вакансия #${item.vacancy_id}`}</strong>
                    <p>{statusLabels[item.status || ''] || item.status || 'Без статуса'}</p>
                  </div>

                  {item.vacancy_id && item.resume_id ? (
                    <button
                      type="button"
                      className="admin-action-btn"
                      onClick={() => {
                        setActiveTab('applications')
                        openDetail({
                          kind: 'application',
                          vacancyId: item.vacancy_id ?? 0,
                          resumeId: item.resume_id ?? 0,
                        })
                      }}
                    >
                      Подробнее
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="admin-empty-inline">Нет данных</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderCatalogs = () => (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="admin-card__header admin-card__header--catalogs">
          <h3>Справочники</h3>

          <CustomSelect
            value={selectedCatalogLabel}
            placeholder="Выберите справочник"
            options={catalogDefinitions.map((item) => ({
              value: item.key,
              label: item.label,
            }))}
            isOpen={catalogSelectOpen}
            onToggle={() => setCatalogSelectOpen((prev) => !prev)}
            onSelect={(value) => {
              setSelectedCatalog(value as CatalogKey)
              setEditingCatalogId(null)
              setEditingCatalogName('')
              setCatalogSelectOpen(false)
            }}
          />
        </div>

        <div className="admin-inline-form admin-inline-form--catalogs">
          <input
            className="admin-input"
            value={newCatalogName}
            onChange={(e) => setNewCatalogName(e.target.value)}
            placeholder="Название нового элемента"
          />

          <button
            type="button"
            className="admin-primary-btn"
            onClick={() => createCatalogItemMutation.mutate()}
            disabled={createCatalogItemMutation.isPending || !newCatalogName.trim()}
          >
            Добавить
          </button>
        </div>

        <div className="admin-stack">
          {selectedCatalogQuery.data?.map((item) => (
            <div key={item.id} className="admin-list-row">
              {editingCatalogId === item.id ? (
                <>
                  <input
                    className="admin-input admin-input--compact"
                    value={editingCatalogName}
                    onChange={(e) => setEditingCatalogName(e.target.value)}
                  />

                  <div className="admin-actions-row">
                    <button
                      type="button"
                      className="admin-primary-btn"
                      onClick={() => updateCatalogItemMutation.mutate(item.id)}
                      disabled={updateCatalogItemMutation.isPending || !editingCatalogName.trim()}
                    >
                      Сохранить
                    </button>

                    <button
                      type="button"
                      className="admin-ghost-btn"
                      onClick={() => {
                        setEditingCatalogId(null)
                        setEditingCatalogName('')
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{item.name}</strong>
                    <p>ID: {item.id}</p>
                  </div>

                  <div className="admin-actions-row">
                    <button
                      type="button"
                      className="admin-action-btn"
                      onClick={() => {
                        setEditingCatalogId(item.id)
                        setEditingCatalogName(item.name)
                      }}
                    >
                      Редактировать
                    </button>

                    <button
                      type="button"
                      className="admin-danger-btn"
                      onClick={() => deleteCatalogItemMutation.mutate(item.id)}
                      disabled={deleteCatalogItemMutation.isPending}
                    >
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {selectedCatalogQuery.data?.length === 0 ? (
            <div className="admin-empty-inline">Справочник пуст</div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderAdmins = () => (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="admin-card__header">
          <h3>Администраторы</h3>

          <div className="admin-header-actions">
            <input
              className="admin-input admin-input--search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по email или ID"
            />
            <button
              type="button"
              className="admin-primary-btn"
              onClick={() => {
                setNewAdminEmail('')
                setNewAdminPassword('')
                setIsCreateAdminOpen(true)
              }}
            >
              Создать администратора
            </button>
          </div>
        </div>

        <div className="admin-stack">
          {filteredAdmins.map((admin) => (
            <div key={admin.id} className="admin-list-row">
              <div>
                <strong>{admin.email}</strong>
                <p>
                  ID: {admin.id} • {admin.is_active ? 'Активен' : 'Заблокирован'} • Создан:{' '}
                  {formatDateTime(admin.created_at)}
                </p>
              </div>

              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => openDetail({ kind: 'admin', id: admin.id })}
                >
                  Подробнее
                </button>

                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => {
                    setEditingAdmin(admin)
                    setEditAdminEmail(admin.email)
                    setEditAdminPassword('')
                    setEditAdminIsActive(admin.is_active)
                    setEditAdminCurrentPassword('')
                  }}
                >
                  Редактировать
                </button>

                <button
                  type="button"
                  className="admin-danger-btn"
                  onClick={() => {
                    setDeletingAdmin(admin)
                    setDeleteAdminCurrentPassword('')
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}

          {filteredAdmins.length === 0 ? (
            <div className="admin-empty-inline">Администраторы не найдены</div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderUsers = () => (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="admin-card__header">
          <h3>Пользователи</h3>
          <input
            className="admin-input admin-input--search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по email, роли или ID"
          />
        </div>

        <div className="admin-stack">
          {filteredUsers.map((user) => (
            <div key={user.id} className="admin-list-row">
              <div>
                <strong>{user.email}</strong>
                <p>
                  {getUserLabel(user)} • ID: {user.id} •{' '}
                  {user.is_active ? 'Активен' : 'Заблокирован'}
                </p>
              </div>

              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => openDetail({ kind: 'user', id: user.id })}
                >
                  Подробнее
                </button>

                <button
                  type="button"
                  className={user.is_active ? 'admin-danger-btn' : 'admin-primary-btn'}
                  onClick={() => toggleUserMutation.mutate(user)}
                  disabled={toggleUserMutation.isPending}
                >
                  {user.is_active ? 'Заблокировать' : 'Разблокировать'}
                </button>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 ? (
            <div className="admin-empty-inline">Нет пользователей</div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderCompanies = () => (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="admin-card__header">
          <h3>Компании</h3>
          <input
            className="admin-input admin-input--search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, сайту или ID"
          />
        </div>

        <div className="admin-stack">
          {filteredCompanies.map((company) => (
            <div key={company.id} className="admin-list-row">
              <div>
                <strong>{company.name}</strong>
                <p>
                  ID: {company.id} • {company.is_active ? 'Активна' : 'Заблокирована'}
                  {company.website ? ` • ${company.website}` : ''}
                </p>
              </div>

              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => openDetail({ kind: 'company', id: company.id })}
                >
                  Подробнее
                </button>

                <button
                  type="button"
                  className={company.is_active ? 'admin-danger-btn' : 'admin-primary-btn'}
                  onClick={() => toggleCompanyMutation.mutate(company)}
                  disabled={toggleCompanyMutation.isPending}
                >
                  {company.is_active ? 'Заблокировать' : 'Разблокировать'}
                </button>
              </div>
            </div>
          ))}

          {filteredCompanies.length === 0 ? (
            <div className="admin-empty-inline">Нет компаний</div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderApplicants = () => (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="admin-card__header">
          <h3>Соискатели</h3>
          <input
            className="admin-input admin-input--search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, email или ID"
          />
        </div>

        <div className="admin-stack">
          {filteredApplicants.map((applicant) => (
            <div key={applicant.id} className="admin-list-row">
              <div>
                <strong>{applicant.full_name}</strong>
                <p>
                  ID: {applicant.id} • {applicant.phone || 'Телефон не указан'} •{' '}
                  {applicant.is_active ? 'Активен' : 'Заблокирован'}
                </p>
              </div>

              <div className="admin-actions-row">
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => openDetail({ kind: 'applicant', id: applicant.id })}
                >
                  Подробнее
                </button>

                <button
                  type="button"
                  className={applicant.is_active ? 'admin-danger-btn' : 'admin-primary-btn'}
                  onClick={() => toggleApplicantMutation.mutate(applicant)}
                  disabled={toggleApplicantMutation.isPending}
                >
                  {applicant.is_active ? 'Заблокировать' : 'Разблокировать'}
                </button>
              </div>
            </div>
          ))}

          {filteredApplicants.length === 0 ? (
            <div className="admin-empty-inline">Нет соискателей</div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderVacancies = () => (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="admin-card__header">
          <h3>Вакансии</h3>
          <input
            className="admin-input admin-input--search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, компании, описанию или ID"
          />
        </div>

        <div className="admin-stack">
          {filteredVacancies.map((vacancy) => (
            <div key={vacancy.id} className="admin-list-row">
              <div>
                <strong>{vacancy.title}</strong>
                <p>
                  ID: {vacancy.id} • {vacancy.company_name || `Компания #${vacancy.company_id ?? '—'}`} •{' '}
                  {formatSalary(vacancy.salary_min, vacancy.salary_max, vacancy.currency || 'BYN')}
                </p>
              </div>

              <div className="admin-actions-row">
                <select
                  className="admin-select admin-select--compact"
                  value={vacancy.status_id ?? ''}
                  onChange={(e) =>
                    updateVacancyStatusMutation.mutate({
                      vacancyId: vacancy.id,
                      statusId: Number(e.target.value),
                    })
                  }
                >
                  <option value="" disabled>
                    Статус
                  </option>
                  {statusesQuery.data?.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => openDetail({ kind: 'vacancy', id: vacancy.id })}
                >
                  Подробнее
                </button>
              </div>
            </div>
          ))}

          {filteredVacancies.length === 0 ? (
            <div className="admin-empty-inline">Нет вакансий</div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderApplications = () => (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="admin-card__header">
          <h3>Отклики</h3>
          <input
            className="admin-input admin-input--search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по вакансии, компании, резюме или ID"
          />
        </div>

        <div className="admin-stack">
          {filteredApplications.map((item) => (
            <div key={`${item.vacancy_id}-${item.resume_id}`} className="admin-list-row">
              <div>
                <strong>
                  {item.vacancy_title || `Вакансия #${item.vacancy_id}`} /{' '}
                  {item.resume_profession || `Резюме #${item.resume_id}`}
                </strong>
                <p>
                  {item.company_name || 'Компания не указана'} • Статус:{' '}
                  {statusLabels[item.status] || item.status}
                </p>
              </div>

              <div className="admin-actions-row">
                <select
                  className="admin-select admin-select--compact"
                  value={item.status}
                  onChange={(e) =>
                    updateApplicationStatusMutation.mutate({
                      vacancyId: item.vacancy_id,
                      resumeId: item.resume_id,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="pending">На рассмотрении</option>
                  <option value="accepted">Принят</option>
                  <option value="rejected">Отклонён</option>
                </select>

                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() =>
                    openDetail({
                      kind: 'application',
                      vacancyId: item.vacancy_id,
                      resumeId: item.resume_id,
                    })
                  }
                >
                  Подробнее
                </button>
              </div>
            </div>
          ))}

          {filteredApplications.length === 0 ? (
            <div className="admin-empty-inline">Нет откликов</div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderDetailModal = () => {
    if (!detailTarget) return null

    const title =
      detailTarget.kind === 'admin'
        ? `Администратор #${detailTarget.id}`
        : detailTarget.kind === 'user'
          ? `Пользователь #${detailTarget.id}`
          : detailTarget.kind === 'company'
            ? `Компания #${detailTarget.id}`
            : detailTarget.kind === 'applicant'
              ? `Соискатель #${detailTarget.id}`
              : detailTarget.kind === 'vacancy'
                ? `Вакансия #${detailTarget.id}`
                : `Отклик ${detailTarget.vacancyId}/${detailTarget.resumeId}`

    return (
      <Modal
        title={title}
        subtitle="Подробная информация по выбранной сущности."
        onClose={closeDetail}
      >
        {detailLoading ? (
          <div className="admin-empty-inline">Загрузка...</div>
        ) : !detailData ? (
          <div className="admin-empty-inline">Не удалось загрузить данные.</div>
        ) : detailTarget.kind === 'admin' ? (
          renderAdminDetailContent()
        ) : detailTarget.kind === 'user' ? (
          renderUserDetailContent()
        ) : detailTarget.kind === 'company' ? (
          renderCompanyDetailContent()
        ) : detailTarget.kind === 'applicant' ? (
          renderApplicantDetailContent()
        ) : detailTarget.kind === 'vacancy' ? (
          renderVacancyDetailContent()
        ) : (
          renderApplicationDetailContent()
        )}
      </Modal>
    )
  }

  const tabContent: Record<TabKey, JSX.Element> = {
    dashboard: renderDashboard(),
    catalogs: renderCatalogs(),
    admins: renderAdmins(),
    users: renderUsers(),
    companies: renderCompanies(),
    applicants: renderApplicants(),
    vacancies: renderVacancies(),
    applications: renderApplications(),
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
        </div>

        <div className="admin-sidebar__nav">
          <button
            type="button"
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => {
              setActiveTab('dashboard')
              setSearch('')
            }}
          >
            Обзор
          </button>

          <button
            type="button"
            className={activeTab === 'catalogs' ? 'active' : ''}
            onClick={() => {
              setActiveTab('catalogs')
              setSearch('')
            }}
          >
            Справочники
          </button>

          <button
            type="button"
            className={activeTab === 'admins' ? 'active' : ''}
            onClick={() => {
              setActiveTab('admins')
              setSearch('')
            }}
          >
            Администраторы
          </button>

          <button
            type="button"
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            Пользователи
          </button>

          <button
            type="button"
            className={activeTab === 'companies' ? 'active' : ''}
            onClick={() => setActiveTab('companies')}
          >
            Компании
          </button>

          <button
            type="button"
            className={activeTab === 'applicants' ? 'active' : ''}
            onClick={() => setActiveTab('applicants')}
          >
            Соискатели
          </button>

          <button
            type="button"
            className={activeTab === 'vacancies' ? 'active' : ''}
            onClick={() => setActiveTab('vacancies')}
          >
            Вакансии
          </button>

          <button
            type="button"
            className={activeTab === 'applications' ? 'active' : ''}
            onClick={() => setActiveTab('applications')}
          >
            Отклики
          </button>
        </div>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__current-user">
            <span>Текущий админ</span>
            <strong>{authMeQuery.data?.email ? maskEmail(authMeQuery.data.email) : '—'}</strong>
          </div>

          <button
            type="button"
            className="admin-sidebar__settings"
            onClick={() => {
              setSelfEmail(authMeQuery.data?.email || '')
              setSelfNewPassword('')
              setSelfCurrentPassword('')
              setIsSelfSettingsOpen(true)
            }}
          >
            Изменить свои данные
          </button>

          <button
            type="button"
            className="admin-sidebar__danger"
            onClick={() => {
              authSession.clear()
              navigate('/admin/login', { replace: true })
            }}
          >
            Выйти
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-main__topbar">
          <div className="admin-main__eyebrow">Администрирование</div>
          <h2>
            {activeTab === 'dashboard' && 'Обзор платформы'}
            {activeTab === 'catalogs' && 'Управление справочниками'}
            {activeTab === 'admins' && 'Управление администраторами'}
            {activeTab === 'users' && 'Управление пользователями'}
            {activeTab === 'companies' && 'Управление компаниями'}
            {activeTab === 'applicants' && 'Управление соискателями'}
            {activeTab === 'vacancies' && 'Управление вакансиями'}
            {activeTab === 'applications' && 'Управление откликами'}
          </h2>
          <p>{message}</p>
        </div>

        <section className="admin-content">{tabContent[activeTab]}</section>
      </main>

      {renderDetailModal()}

      {isCreateAdminOpen ? (
        <Modal
          title="Создание администратора"
          subtitle="Новый пользователь сразу получит роль администратора."
          onClose={() => setIsCreateAdminOpen(false)}
        >
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Email</span>
              <input
                className="admin-input"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@jobfinder.by"
              />
            </label>

            <label className="admin-field">
              <span>Пароль</span>
              <input
                className="admin-input"
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="Минимум 8 символов"
              />
            </label>
          </div>

          <div className="admin-modal__footer">
            <button type="button" className="admin-ghost-btn" onClick={() => setIsCreateAdminOpen(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="admin-primary-btn"
              onClick={() => createAdminMutation.mutate()}
              disabled={
                createAdminMutation.isPending ||
                !newAdminEmail.trim() ||
                newAdminPassword.trim().length < 8
              }
            >
              {createAdminMutation.isPending ? 'Создаём...' : 'Создать'}
            </button>
          </div>
        </Modal>
      ) : null}

      {editingAdmin ? (
        <Modal
          title={`Редактирование администратора #${editingAdmin.id}`}
          subtitle="Для сохранения изменений требуется пароль текущего администратора."
          onClose={() => setEditingAdmin(null)}
        >
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Email</span>
              <input
                className="admin-input"
                type="email"
                value={editAdminEmail}
                onChange={(e) => setEditAdminEmail(e.target.value)}
                placeholder="Введите email"
              />
            </label>

            <label className="admin-field">
              <span>Новый пароль</span>
              <input
                className="admin-input"
                type="password"
                value={editAdminPassword}
                onChange={(e) => setEditAdminPassword(e.target.value)}
                placeholder="Оставь пустым, если не меняешь"
              />
            </label>

            <label className="admin-field admin-field--full">
              <span>Пароль текущего администратора</span>
              <input
                className="admin-input"
                type="password"
                value={editAdminCurrentPassword}
                onChange={(e) => setEditAdminCurrentPassword(e.target.value)}
                placeholder="Подтверждение действия"
              />
            </label>

            <label className="admin-checkbox admin-field--full">
              <input
                type="checkbox"
                checked={editAdminIsActive}
                onChange={(e) => setEditAdminIsActive(e.target.checked)}
              />
              <span>Администратор активен</span>
            </label>
          </div>

          <div className="admin-modal__footer">
            <button type="button" className="admin-ghost-btn" onClick={() => setEditingAdmin(null)}>
              Отмена
            </button>
            <button
              type="button"
              className="admin-primary-btn"
              onClick={() => updateAdminMutation.mutate(editingAdmin.id)}
              disabled={
                updateAdminMutation.isPending ||
                !editAdminEmail.trim() ||
                !editAdminCurrentPassword.trim() ||
                (editAdminPassword.trim().length > 0 && editAdminPassword.trim().length < 8)
              }
            >
              {updateAdminMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </Modal>
      ) : null}

      {deletingAdmin ? (
        <Modal
          title={`Удаление администратора #${deletingAdmin.id}`}
          subtitle="Удаление необратимо. Для подтверждения введи пароль текущего администратора."
          onClose={() => setDeletingAdmin(null)}
        >
          <div className="admin-warning-box">
            Будет удалён администратор <strong>{deletingAdmin.email}</strong>.
          </div>

          <label className="admin-field">
            <span>Пароль текущего администратора</span>
            <input
              className="admin-input"
              type="password"
              value={deleteAdminCurrentPassword}
              onChange={(e) => setDeleteAdminCurrentPassword(e.target.value)}
              placeholder="Подтверждение действия"
            />
          </label>

          <div className="admin-modal__footer">
            <button type="button" className="admin-ghost-btn" onClick={() => setDeletingAdmin(null)}>
              Отмена
            </button>
            <button
              type="button"
              className="admin-danger-btn"
              onClick={() => deleteAdminMutation.mutate(deletingAdmin.id)}
              disabled={deleteAdminMutation.isPending || !deleteAdminCurrentPassword.trim()}
            >
              {deleteAdminMutation.isPending ? 'Удаляем...' : 'Удалить'}
            </button>
          </div>
        </Modal>
      ) : null}

      {isSelfSettingsOpen ? (
        <Modal
          title="Мои данные"
          subtitle="Здесь можно изменить свой email и пароль."
          onClose={() => setIsSelfSettingsOpen(false)}
        >
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Новый email</span>
              <input
                className="admin-input"
                type="email"
                value={selfEmail}
                onChange={(e) => setSelfEmail(e.target.value)}
                placeholder="Введите email"
              />
            </label>

            <label className="admin-field">
              <span>Новый пароль</span>
              <input
                className="admin-input"
                type="password"
                value={selfNewPassword}
                onChange={(e) => setSelfNewPassword(e.target.value)}
                placeholder="Оставь пустым, если не меняешь"
              />
            </label>

            <label className="admin-field admin-field--full">
              <span>Текущий пароль</span>
              <input
                className="admin-input"
                type="password"
                value={selfCurrentPassword}
                onChange={(e) => setSelfCurrentPassword(e.target.value)}
                placeholder="Подтверждение действия"
              />
            </label>
          </div>

          <div className="admin-modal__footer">
            <button
              type="button"
              className="admin-ghost-btn"
              onClick={() => setIsSelfSettingsOpen(false)}
            >
              Отмена
            </button>

            <button
              type="button"
              className="admin-primary-btn"
              onClick={() => updateSelfSettingsMutation.mutate()}
              disabled={
                updateSelfSettingsMutation.isPending ||
                !selfCurrentPassword.trim() ||
                (selfNewPassword.trim().length > 0 && selfNewPassword.trim().length < 8)
              }
            >
              {updateSelfSettingsMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}