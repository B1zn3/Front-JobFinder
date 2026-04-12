import { useEffect, useMemo, useState, type JSX } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './admin.css'

type TabKey =
  | 'dashboard'
  | 'catalogs'
  | 'users'
  | 'companies'
  | 'applicants'
  | 'vacancies'
  | 'applications'

type CatalogKey =
  | 'roles'
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

type DashboardResponse = {
  users_total?: number
  users_active?: number
  companies_total?: number
  applicants_total?: number
  vacancies_total?: number
  applications_total?: number
  vacancies_by_status?: Array<{ name?: string; count?: number }>
  applications_by_status?: Array<{ name?: string; count?: number }>
  recent_users?: Array<{ id: number; email?: string; role?: string }>
  recent_vacancies?: Array<{ id: number; title?: string }>
  recent_applications?: Array<{ vacancy_id?: number; resume_id?: number; status?: string }>
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
}

type CompanyAdmin = {
  id: number
  name: string
  description?: string | null
  website?: string | null
  is_active?: boolean
  user_id?: number | null
  moderation_status?: string | null
  created_at?: string | null
}

type ApplicantAdmin = {
  id: number
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  phone?: string | null
  is_active?: boolean
  user_id?: number | null
  created_at?: string | null
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
  is_active?: boolean
  created_at?: string | null
}

type ApplicationAdmin = {
  vacancy_id: number
  resume_id: number
  status: string
  company_id?: number | null
  applicant_id?: number | null
  created_at?: string | null
  updated_at?: string | null
  vacancy_title?: string | null
  company_name?: string | null
  resume_title?: string | null
}

type DetailTarget =
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

const fieldLabels: Record<string, string> = {
  id: 'ID',
  email: 'Email',
  role: 'Роль',
  is_active: 'Активен',
  created_at: 'Создан',
  updated_at: 'Обновлён',
  title: 'Название',
  description: 'Описание',
  name: 'Название',
  phone: 'Телефон',
  website: 'Сайт',
  user_id: 'ID пользователя',
  company_id: 'ID компании',
  applicant_id: 'ID соискателя',
  city_id: 'ID города',
  profession_id: 'ID профессии',
  status_id: 'ID статуса',
  employment_type_id: 'Тип занятости',
  work_schedule_id: 'График работы',
  experience_id: 'Опыт',
  currency_id: 'Валюта',
  salary_min: 'Зарплата от',
  salary_max: 'Зарплата до',
  moderation_status: 'Статус модерации',
  moderation_comment: 'Комментарий модерации',
  vacancy_id: 'ID вакансии',
  resume_id: 'ID резюме',
  vacancy_title: 'Вакансия',
  company_name: 'Компания',
  resume_title: 'Резюме',
  status: 'Статус',
  first_name: 'Имя',
  last_name: 'Фамилия',
  middle_name: 'Отчество',
  educations: 'Образование',
  resumes: 'Резюме',
  applications: 'Отклики',
  vacancies: 'Вакансии',
}

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

const prettifyKey = (key: string) => {
  if (fieldLabels[key]) return fieldLabels[key]

  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
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

const normalizeUser = (item: Record<string, unknown>): UserAdmin => ({
  id: safeNumber(item.id) ?? 0,
  email: safeString(item.email) || 'Без email',
  role: (safeString(item.role) as UserAdmin['role']) || 'applicant',
  is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
  company_id: safeNumber(item.company_id),
  applicant_id: safeNumber(item.applicant_id),
  created_at: safeString(item.created_at) || null,
  updated_at: safeString(item.updated_at) || null,
})

const normalizeCompany = (item: Record<string, unknown>): CompanyAdmin => ({
  id: safeNumber(item.id) ?? 0,
  name: safeString(item.name) || 'Без названия',
  description: safeString(item.description) || null,
  website: safeString(item.website) || null,
  is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
  user_id: safeNumber(item.user_id),
  moderation_status: safeString(item.moderation_status) || null,
  created_at: safeString(item.created_at) || null,
})

const normalizeApplicant = (item: Record<string, unknown>): ApplicantAdmin => ({
  id: safeNumber(item.id) ?? 0,
  first_name: safeString(item.first_name) || null,
  last_name: safeString(item.last_name) || null,
  middle_name: safeString(item.middle_name) || null,
  phone: safeString(item.phone) || null,
  is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
  user_id: safeNumber(item.user_id),
  created_at: safeString(item.created_at) || null,
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
  is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
  created_at: safeString(item.created_at) || null,
})

const normalizeApplication = (item: Record<string, unknown>): ApplicationAdmin => ({
  vacancy_id: safeNumber(item.vacancy_id) ?? 0,
  resume_id: safeNumber(item.resume_id) ?? 0,
  status: safeString(item.status) || 'pending',
  company_id: safeNumber(item.company_id),
  applicant_id: safeNumber(item.applicant_id),
  created_at: safeString(item.created_at) || null,
  updated_at: safeString(item.updated_at) || null,
  vacancy_title: safeString(item.vacancy_title) || null,
  company_name: safeString(item.company_name) || null,
  resume_title: safeString(item.resume_title) || null,
})

const fetchDashboard = async (): Promise<DashboardResponse> => {
  const { data } = await http.get('/admin/dashboard')
  return data || {}
}

const fetchCatalog = async (name: string): Promise<CatalogItem[]> => {
  const { data } = await http.get(`/admin/catalogs/${name}`, {
    params: { skip: 0, limit: 100 },
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

const renderDetailValue = (key: string, value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return <span className="admin-detail-empty">—</span>
  }

  if (key === 'website' && typeof value === 'string') {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="admin-detail-link">
        {value}
      </a>
    )
  }

  if (key.includes('created_at') || key.includes('updated_at') || key.includes('moderated_at')) {
    return <span>{formatDateTime(safeString(value) || null)}</span>
  }

  if (typeof value === 'boolean') {
    return (
      <span className={`admin-badge ${value ? 'admin-badge--success' : 'admin-badge--danger'}`}>
        {value ? 'Да' : 'Нет'}
      </span>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="admin-detail-empty">Пусто</span>
    }

    const primitiveArray = value.every(
      (item) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean' ||
        item === null,
    )

    if (primitiveArray) {
      return (
        <div className="admin-chip-list">
          {value.map((item, index) => (
            <span key={`${String(item)}-${index}`} className="admin-chip">
              {String(item)}
            </span>
          ))}
        </div>
      )
    }

    return (
      <div className="admin-json-stack">
        {value.map((item, index) => (
          <pre key={index} className="admin-json-block">
            {JSON.stringify(item, null, 2)}
          </pre>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    return (
      <pre className="admin-json-block">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <span>{String(value)}</span>
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
useEffect(() => {
  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (!target.closest('.custom-select')) {
      setCatalogSelectOpen(false)
    }
  }

  document.addEventListener('click', handleDocumentClick)
  return () => document.removeEventListener('click', handleDocumentClick)
}, [])
  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboard,
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
    onError: () => {
      setMessage('Не удалось изменить статус пользователя.')
    },
  })

  const toggleCompanyMutation = useMutation({
    mutationFn: async (company: CompanyAdmin) => {
      await http.patch(`/admin/companies/${company.id}/status`, {
        is_active: !(company.is_active ?? true),
      })
    },
    onSuccess: async () => {
      setMessage('Статус компании обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: () => {
      setMessage('Не удалось обновить статус компании.')
    },
  })

  const toggleApplicantMutation = useMutation({
    mutationFn: async (applicant: ApplicantAdmin) => {
      await http.patch(`/admin/applicants/${applicant.id}/status`, {
        is_active: !(applicant.is_active ?? true),
      })
    },
    onSuccess: async () => {
      setMessage('Статус соискателя обновлён.')
      await queryClient.invalidateQueries({ queryKey: ['admin-applicants'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: () => {
      setMessage('Не удалось обновить статус соискателя.')
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
    onError: () => {
      setMessage('Не удалось обновить статус вакансии.')
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
    onError: () => {
      setMessage('Не удалось обновить статус отклика.')
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
    onError: () => {
      setMessage('Не удалось создать элемент справочника.')
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
    onError: () => {
      setMessage('Не удалось обновить элемент справочника.')
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
    onError: () => {
      setMessage('Не удалось удалить элемент справочника. Возможно, он уже используется.')
    },
  })

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

  const selectedCatalogLabel = useMemo(() => {
    return (
        catalogDefinitions.find((item) => item.key === selectedCatalog)?.label || 'Выберите справочник'
    )
    }, [selectedCatalog])

  const filteredApplicants = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return applicantsQuery.data || []

    return (applicantsQuery.data || []).filter((item) => {
      const fullName = [item.last_name, item.first_name, item.middle_name].filter(Boolean).join(' ')
      return (
        fullName.toLowerCase().includes(value) ||
        safeString(item.phone).toLowerCase().includes(value) ||
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
        safeString(item.resume_title).toLowerCase().includes(value) ||
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
  }, [usersQuery.data, companiesQuery.data, applicantsQuery.data, vacanciesQuery.data, applicationsQuery.data])

  const dashboard = {
    ...fallbackStats,
    ...(dashboardQuery.data || {}),
  }

  const detailData =
    detailTarget?.kind === 'user'
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
                    <strong>{item.email || `Пользователь #${item.id}`}</strong>
                    <p>
                      {getUserLabel({
                        id: item.id,
                        email: item.email || '',
                        role: (item.role as UserAdmin['role']) || 'applicant',
                        is_active: true,
                      })}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="admin-action-btn"
                    onClick={() => {
                      setActiveTab('users')
                      openDetail({ kind: 'user', id: item.id })
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
                    <p>ID: {item.id}</p>
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
                    <strong>
                      Вакансия #{item.vacancy_id} / Резюме #{item.resume_id}
                    </strong>
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

         <div className={`custom-select ${catalogSelectOpen ? 'is-open' : ''}`}>
                <button
                    type="button"
                    className={`custom-select__trigger ${catalogSelectOpen ? 'is-open' : ''}`}
                    onClick={() => setCatalogSelectOpen((prev) => !prev)}
                >
                    <span>{selectedCatalogLabel}</span>
                    <span className="custom-select__arrow">▾</span>
                </button>

                {catalogSelectOpen && (
                    <div className="custom-select__dropdown">
                    {catalogDefinitions.map((item) => (
                        <button
                        key={item.key}
                        type="button"
                        className={`custom-select__option ${
                            selectedCatalog === item.key ? 'is-active' : ''
                        }`}
                        onClick={() => {
                            setSelectedCatalog(item.key)
                            setEditingCatalogId(null)
                            setEditingCatalogName('')
                            setCatalogSelectOpen(false)
                        }}
                        >
                        {item.label}
                        </button>
                    ))}
                    </div>
                )}
                </div>
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
                  {company.moderation_status ? ` • ${company.moderation_status}` : ''}
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
            placeholder="Поиск по имени, телефону или ID"
          />
        </div>

        <div className="admin-stack">
          {filteredApplicants.map((applicant) => {
            const fullName =
              [applicant.last_name, applicant.first_name, applicant.middle_name]
                .filter(Boolean)
                .join(' ') || `Соискатель #${applicant.id}`

            return (
              <div key={applicant.id} className="admin-list-row">
                <div>
                  <strong>{fullName}</strong>
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
            )
          })}

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
            placeholder="Поиск по названию, описанию или ID"
          />
        </div>

        <div className="admin-stack">
          {filteredVacancies.map((vacancy) => (
            <div key={vacancy.id} className="admin-list-row">
              <div>
                <strong>{vacancy.title}</strong>
                <p>
                  ID: {vacancy.id} • Компания #{vacancy.company_id ?? '—'} • Зарплата{' '}
                  {formatSalary(vacancy.salary_min, vacancy.salary_max)}
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
                  {item.resume_title || `Резюме #${item.resume_id}`}
                </strong>
                <p>
                  {item.company_name || `Компания #${item.company_id ?? '—'}`} • Статус:{' '}
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
      detailTarget.kind === 'user'
        ? `Пользователь #${detailTarget.id}`
        : detailTarget.kind === 'company'
          ? `Компания #${detailTarget.id}`
          : detailTarget.kind === 'applicant'
            ? `Соискатель #${detailTarget.id}`
            : detailTarget.kind === 'vacancy'
              ? `Вакансия #${detailTarget.id}`
              : `Отклик ${detailTarget.vacancyId}/${detailTarget.resumeId}`

    return (
      <div className="admin-modal" onClick={closeDetail}>
        <div className="admin-modal__dialog" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal__header">
            <div>
              <div className="admin-modal__eyebrow">Подробная информация</div>
              <h3>{title}</h3>
            </div>

            <button type="button" className="admin-modal__close" onClick={closeDetail}>
              ×
            </button>
          </div>

          <div className="admin-modal__body">
            {detailLoading ? (
              <div className="admin-empty-inline">Загрузка...</div>
            ) : !detailData ? (
              <div className="admin-empty-inline">Не удалось загрузить данные.</div>
            ) : (
              <div className="admin-detail-grid admin-detail-grid--modal">
                {Object.entries(detailData).map(([key, value]) => (
                  <div
                    key={key}
                    className={`admin-detail-row ${
                      Array.isArray(value) || (value && typeof value === 'object' && !Array.isArray(value))
                        ? 'admin-detail-row--full'
                        : ''
                    }`}
                  >
                    <span>{prettifyKey(key)}</span>
                    <div className="admin-detail-row__content">{renderDetailValue(key, value)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const tabContent: Record<TabKey, JSX.Element> = {
    dashboard: renderDashboard(),
    catalogs: renderCatalogs(),
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
          <div className="admin-sidebar__eyebrow">JobFinder</div>
          <h1>Admin</h1>
          <p>Панель управления платформой</p>
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
    </div>
  )
}