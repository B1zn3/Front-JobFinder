import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './vacancy-detail.css'

type VacancyListItem = {
  id: number
  title: string
  salary_min?: number | null
  salary_max?: number | null
  company_name: string
  currency?: string | null
}

type VacancyDetail = {
  id: number
  title: string
  description: string
  salary_min?: number | null
  salary_max?: number | null
  company_id?: number | null
  company_name: string
  city_name: string
  profession_name: string
  employment_type: string
  work_schedule: string
  currency?: string | null
  experience: string
  skills: string[]
  company_description?: string | null
  company_website?: string | null
  company_logo?: string | null
  company_founded_year?: number | null
  company_employee_count?: number | null
  company_city_names?: string[] | null
}

type CompanyDetail = {
  id: number
  name: string
  description?: string | null
  website?: string | null
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  city_names?: string[] | null
  cities?: Array<{ id: number; name: string }> | null
}

type ResumeItem = {
  id: number
  profession_id?: number | null
  profession?: {
    id: number
    name: string
  } | null
  created_at?: string | null
  updated_at?: string | null
}

type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

type ApplicationItem = {
  id?: number | string | null
  vacancy_id?: number | string | null
  resume_id?: number | string | null
  status?: ApplicationStatus | string | null
  cover_letter?: string | null
  created_at?: string | null
  updated_at?: string | null
  vacancy?: {
    id?: number | string | null
  } | null
  resume?: {
    id?: number | string | null
  } | null
}

type ApplyPayload = {
  vacancy_id: number
  resume_id: number
  cover_letter?: string | null
}

type ApiValidationItem = {
  msg?: string
  loc?: Array<string | number>
  type?: string
}

type ApiErrorResponse = {
  detail?: string | { message?: string; error?: string } | ApiValidationItem[]
  message?: string
  error?: string
}

const MAX_COVER_LETTER_LENGTH = 1000
const RESUMES_PER_PAGE = 3
const APPLICATIONS_PAGE_LIMIT = 100
const APPLICATIONS_MAX_PAGES = 50

const normalizeArrayResponse = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    const objectData = data as {
      items?: unknown[]
      results?: unknown[]
      data?: unknown[]
      applications?: unknown[]
    }

    if (Array.isArray(objectData.items)) return objectData.items as T[]
    if (Array.isArray(objectData.results)) return objectData.results as T[]
    if (Array.isArray(objectData.data)) return objectData.data as T[]
    if (Array.isArray(objectData.applications)) return objectData.applications as T[]
  }

  return []
}

const getApplicationVacancyId = (application: ApplicationItem) => {
  const rawVacancyId = application.vacancy_id ?? application.vacancy?.id

  if (rawVacancyId === null || rawVacancyId === undefined) return null

  const numericVacancyId = Number(rawVacancyId)

  return Number.isFinite(numericVacancyId) ? numericVacancyId : null
}

const fetchVacancy = async (id: string): Promise<VacancyDetail> => {
  const { data } = await http.get(`/public/vacancies/${id}`)
  return data
}

const fetchCompanyDetail = async (id: number): Promise<CompanyDetail> => {
  const { data } = await http.get(`/public/companies/${id}`)
  return data
}

const fetchRelatedVacancies = async (search: string): Promise<VacancyListItem[]> => {
  const { data } = await http.get('/public/vacancies', {
    params: { search, limit: 12, skip: 0 },
  })

  return Array.isArray(data) ? data : []
}

const fetchCurrentApplication = async (vacancyId: string): Promise<ApplicationItem | null> => {
  const currentVacancyId = Number(vacancyId)

  if (!Number.isFinite(currentVacancyId)) return null

  for (let page = 0; page < APPLICATIONS_MAX_PAGES; page += 1) {
    const skip = page * APPLICATIONS_PAGE_LIMIT

    const { data } = await http.get('/applicants/me/applications', {
      params: {
        skip,
        limit: APPLICATIONS_PAGE_LIMIT,
      },
    })

    const applications = normalizeArrayResponse<ApplicationItem>(data)

    const foundApplication =
      applications.find((application) => getApplicationVacancyId(application) === currentVacancyId) ||
      null

    if (foundApplication) return foundApplication

    if (applications.length < APPLICATIONS_PAGE_LIMIT) return null
  }

  return null
}

const fetchMyResumes = async (): Promise<ResumeItem[]> => {
  const { data } = await http.get('/applicants/me/resumes', {
    params: { skip: 0, limit: 100 },
  })

  return normalizeArrayResponse<ResumeItem>(data)
}

const createApplication = async (payload: ApplyPayload): Promise<ApplicationItem> => {
  const { data } = await http.post('/applicants/me/applications', {
    vacancy_id: payload.vacancy_id,
    resume_id: payload.resume_id,
    cover_letter: payload.cover_letter?.trim() || null,
  })

  return data
}

const formatSalary = (
  salaryMin?: number | null,
  salaryMax?: number | null,
  currency = 'BYN',
) => {
  const min = typeof salaryMin === 'number' && salaryMin > 0 ? salaryMin : null
  const max = typeof salaryMax === 'number' && salaryMax > 0 ? salaryMax : null

  if (min && max) {
    if (min === max) return `${min.toLocaleString('ru-RU')} ${currency}`
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currency}`
  }

  if (min) return `от ${min.toLocaleString('ru-RU')} ${currency}`
  if (max) return `до ${max.toLocaleString('ru-RU')} ${currency}`

  return 'Зарплата не указана'
}

const formatCompactCount = (value?: number | null) => {
  const num = Number(value ?? 0)

  if (!Number.isFinite(num) || num <= 0) return '0'
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}m+`
  if (num >= 10_000) return `${Math.floor(num / 1_000)}k+`

  return num.toLocaleString('ru-RU')
}

const formatEmployeeCount = (value?: number | null) => {
  const num = Number(value ?? 0)
  if (!num) return 'Не указано'

  return formatCompactCount(num)
}

const formatDate = (value?: string | null) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('ru-RU')
}

const getResumeTitle = (resume: ResumeItem) => {
  return resume.profession?.name || `Резюме #${resume.id}`
}

const normalizeApplicationStatus = (status?: string | null): ApplicationStatus | null => {
  const normalized = String(status || '').toLowerCase().trim()

  if (!normalized) return null

  if (
    normalized === 'accepted' ||
    normalized.includes('accepted') ||
    normalized.includes('собесед') ||
    normalized.includes('приглас')
  ) {
    return 'accepted'
  }

  if (
    normalized === 'rejected' ||
    normalized.includes('rejected') ||
    normalized.includes('отказ')
  ) {
    return 'rejected'
  }

  if (
    normalized === 'pending' ||
    normalized.includes('pending') ||
    normalized.includes('отклик')
  ) {
    return 'pending'
  }

  return null
}

const getApplicationUi = (status?: string | null, hasApplication = false) => {
  const normalized = normalizeApplicationStatus(status)

  if (normalized === 'accepted') {
    return {
      text: 'Вас пригласили',
      note: 'Работодатель пригласил вас на следующий этап.',
      className: 'is-state-accepted',
    }
  }

  if (normalized === 'rejected') {
    return {
      text: 'Вам отказали',
      note: 'Работодатель отказал по этому отклику.',
      className: 'is-state-rejected',
    }
  }

  if (normalized === 'pending' || hasApplication) {
    return {
      text: 'Вы откликнулись',
      note: 'Ваш отклик отправлен и находится на рассмотрении.',
      className: 'is-state-pending',
    }
  }

  return {
    text: 'Откликнуться',
    note: '',
    className: 'is-cta',
  }
}

const translateApiMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (
    lower.includes('already applied') ||
    lower.includes('duplicate') ||
    lower.includes('уже отклик')
  ) {
    return 'Вы уже откликались на эту вакансию.'
  }

  if (
    lower.includes('resume not found') ||
    lower.includes('резюме не найден') ||
    lower.includes('нет резюме')
  ) {
    return 'Выберите доступное резюме или создайте новое.'
  }

  if (lower.includes('vacancy not found') || lower.includes('вакансия не найден')) {
    return 'Вакансия не найдена.'
  }

  if (lower.includes('cover_letter') || lower.includes('сопровод')) {
    return 'Сопроводительное письмо должно быть не длиннее 1000 символов.'
  }

  if (
    lower.includes('access denied') ||
    lower.includes('не принадлежит') ||
    lower.includes('доступ запрещ')
  ) {
    return 'Недостаточно прав для выполнения действия.'
  }

  if (
    lower.includes('not authenticated') ||
    lower.includes('unauthorized') ||
    lower.includes('credentials')
  ) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав для выполнения действия.'
  if (status === 404) return 'Данные не найдены.'
  if (status === 409) return 'Вы уже откликались на эту вакансию.'
  if (status === 422) return 'Проверьте корректность данных.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return message || 'Не удалось выполнить действие.'
}

const getErrorMessage = (error: unknown, fallback = 'Не удалось выполнить действие.') => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback

  const status = error.response?.status
  const data = error.response?.data

  if (!error.response) {
    return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  }

  if (Array.isArray(data?.detail)) {
    const messages = data.detail
      .map((item) => translateApiMessage(item.msg || '', status))
      .filter(Boolean)

    if (messages.length) return messages[0]
  }

  if (typeof data?.detail === 'string') {
    return translateApiMessage(data.detail, status)
  }

  if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    const message = data.detail.message || data.detail.error
    if (message) return translateApiMessage(message, status)
  }

  if (data?.message) return translateApiMessage(data.message, status)
  if (data?.error) return translateApiMessage(data.error, status)

  if (status === 409) return 'Вы уже откликались на эту вакансию.'
  if (status === 422) return 'Проверьте корректность данных.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return fallback
}

export const VacancyDetailPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { vacancyId } = useParams<{ vacancyId: string }>()

  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [resumePage, setResumePage] = useState(1)
  const [localApplication, setLocalApplication] = useState<ApplicationItem | null>(null)

  const accessToken =
    authSession.getAccessToken?.() ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token')

  const rawRole = authSession.getRole?.() || localStorage.getItem('role') || ''
  const normalizedRole = String(rawRole).toLowerCase().trim()

  const isAuthenticated = Boolean(accessToken)
  const isCompany =
    normalizedRole === 'company' ||
    normalizedRole === 'employer' ||
    normalizedRole === 'работодатель' ||
    normalizedRole.includes('company') ||
    normalizedRole.includes('employer')

  const isApplicant =
    isAuthenticated &&
    !isCompany &&
    (normalizedRole === '' ||
      normalizedRole === 'applicant' ||
      normalizedRole === 'соискатель' ||
      normalizedRole.includes('applicant'))

  const vacancyQuery = useQuery({
    queryKey: ['vacancy-detail', vacancyId],
    queryFn: () => fetchVacancy(vacancyId as string),
    enabled: Boolean(vacancyId),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const companyQuery = useQuery({
    queryKey: ['vacancy-detail-company', vacancyQuery.data?.company_id],
    queryFn: () => fetchCompanyDetail(vacancyQuery.data?.company_id as number),
    enabled: Boolean(vacancyQuery.data?.company_id),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const relatedQuery = useQuery({
    queryKey: ['vacancy-related', vacancyQuery.data?.title],
    enabled: Boolean(vacancyQuery.data?.title),
    queryFn: () => fetchRelatedVacancies(vacancyQuery.data?.title.split(' ')[0] ?? ''),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const currentApplicationQuery = useQuery({
    queryKey: ['applicant-current-application', vacancyId],
    queryFn: () => fetchCurrentApplication(vacancyId as string),
    enabled: Boolean(vacancyId) && isAuthenticated && isApplicant,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const myResumesQuery = useQuery({
    queryKey: ['applicant-my-resumes', 'apply-modal'],
    queryFn: fetchMyResumes,
    enabled: isApplyModalOpen && isAuthenticated && isApplicant,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applyMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: async (createdApplication) => {
      const safeCreatedApplication: ApplicationItem = {
        ...createdApplication,
        vacancy_id: createdApplication.vacancy_id ?? Number(vacancyId),
        status: createdApplication.status || 'pending',
      }

      setActionError('')
      setActionMessage('Отклик успешно отправлен.')
      setLocalApplication(safeCreatedApplication)
      setIsApplyModalOpen(false)
      setCoverLetter('')
      setSelectedResumeId(null)
      setResumePage(1)

      queryClient.setQueryData<ApplicationItem | null>(
        ['applicant-current-application', vacancyId],
        safeCreatedApplication,
      )

      await queryClient.invalidateQueries({ queryKey: ['applicant-current-application', vacancyId] })
      await queryClient.invalidateQueries({ queryKey: ['vacancy-detail', vacancyId] })
    },
    onError: async (error) => {
      const message = getErrorMessage(error, 'Не удалось отправить отклик.')

      setActionMessage('')
      setActionError(message)

      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 409 || message.toLowerCase().includes('уже отклик'))
      ) {
        const duplicateApplication: ApplicationItem = {
          vacancy_id: vacancyId ? Number(vacancyId) : null,
          resume_id: selectedResumeId,
          status: 'pending',
          cover_letter: coverLetter.trim() || null,
        }

        setLocalApplication(duplicateApplication)

        queryClient.setQueryData<ApplicationItem | null>(
          ['applicant-current-application', vacancyId],
          duplicateApplication,
        )

        await queryClient.invalidateQueries({ queryKey: ['applicant-current-application', vacancyId] })
      }
    },
  })

  const relatedVacancies = useMemo(() => {
    if (!relatedQuery.data) return []

    return relatedQuery.data.filter((item) => item.id !== Number(vacancyId)).slice(0, 3)
  }, [relatedQuery.data, vacancyId])

  const currentQueryApplication = currentApplicationQuery.data || null

  const effectiveApplication = useMemo(() => {
    if (!vacancyId) return currentQueryApplication

    const currentVacancyId = Number(vacancyId)
    if (!Number.isFinite(currentVacancyId)) return currentQueryApplication

    if (localApplication && getApplicationVacancyId(localApplication) === currentVacancyId) {
      return localApplication
    }

    return currentQueryApplication
  }, [currentQueryApplication, localApplication, vacancyId])

  const hasEffectiveApplication = Boolean(effectiveApplication)
  const applicationUi = getApplicationUi(effectiveApplication?.status, hasEffectiveApplication)

  const resumes = useMemo(() => myResumesQuery.data || [], [myResumesQuery.data])

  const resumeTotalPages = Math.max(Math.ceil(resumes.length / RESUMES_PER_PAGE), 1)

  const paginatedResumes = useMemo(() => {
    const start = (resumePage - 1) * RESUMES_PER_PAGE
    return resumes.slice(start, start + RESUMES_PER_PAGE)
  }, [resumes, resumePage])

  const visibleResumeStart = resumes.length === 0 ? 0 : (resumePage - 1) * RESUMES_PER_PAGE + 1
  const visibleResumeEnd = Math.min(resumePage * RESUMES_PER_PAGE, resumes.length)

  const selectedResume = useMemo(() => {
    if (!selectedResumeId) return null

    return resumes.find((item) => item.id === selectedResumeId) || null
  }, [resumes, selectedResumeId])

  const vacancy = vacancyQuery.data
  const company = companyQuery.data

  const companyId = vacancy?.company_id ?? company?.id ?? null
  const companyHref = companyId ? `/companies/${companyId}` : ''

  const companyInfo = useMemo(() => {
    return {
      name: company?.name || vacancy?.company_name || 'Компания',
      description: company?.description ?? vacancy?.company_description ?? null,
      website: company?.website ?? vacancy?.company_website ?? null,
      logo: company?.logo ?? vacancy?.company_logo ?? null,
      foundedYear: company?.founded_year ?? vacancy?.company_founded_year ?? null,
      employeeCount: company?.employee_count ?? vacancy?.company_employee_count ?? null,
    }
  }, [company, vacancy])

  const companyOfficeNames = useMemo(() => {
    const names =
      company?.city_names ??
      company?.cities?.map((city) => city.name) ??
      vacancy?.company_city_names ??
      []

    return Array.from(
      new Set(
        names
          .map((name) => String(name || '').trim())
          .filter(Boolean),
      ),
    )
  }, [company, vacancy])

  const visibleCompanyOfficeNames = companyOfficeNames.slice(0, 4)
  const hiddenCompanyOfficeCount = Math.max(
    companyOfficeNames.length - visibleCompanyOfficeNames.length,
    0,
  )

  useEffect(() => {
    setLocalApplication(null)
    setActionMessage('')
    setActionError('')
    setIsApplyModalOpen(false)
    setSelectedResumeId(null)
    setCoverLetter('')
    setResumePage(1)
  }, [vacancyId])

  useEffect(() => {
    if (!isApplyModalOpen) return

    setResumePage(1)
  }, [isApplyModalOpen])

  useEffect(() => {
    if (resumePage <= resumeTotalPages) return

    setResumePage(resumeTotalPages)
  }, [resumePage, resumeTotalPages])

  useEffect(() => {
    if (!isApplyModalOpen || selectedResumeId || resumes.length === 0) return

    setSelectedResumeId(resumes[0].id)
  }, [isApplyModalOpen, resumes, selectedResumeId])

  useEffect(() => {
    if (!isApplyModalOpen) return

    const previousOverflow = document.body.style.overflow

    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || applyMutation.isPending) return

      setIsApplyModalOpen(false)
      setSelectedResumeId(null)
      setCoverLetter('')
      setActionError('')
      setResumePage(1)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeByEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeByEscape)
    }
  }, [isApplyModalOpen, applyMutation.isPending])

  const handleOpenApplyModal = async () => {
    if (!vacancyId) return

    setActionMessage('')
    setActionError('')

    if (!isAuthenticated) {
      const redirectPath = `/vacancies/${vacancyId}`

      navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`, {
        state: { from: redirectPath },
      })

      return
    }

    if (!isApplicant) {
      setActionError('Откликаться на вакансии может только соискатель.')
      return
    }

    if (hasEffectiveApplication) return

    setIsApplyModalOpen(true)
  }

  const handleCloseApplyModal = () => {
    if (applyMutation.isPending) return

    setIsApplyModalOpen(false)
    setSelectedResumeId(null)
    setCoverLetter('')
    setActionError('')
    setResumePage(1)
  }

  const handleSubmitApplication = async () => {
    if (!vacancyId) return

    setActionMessage('')
    setActionError('')

    if (!selectedResumeId) {
      setActionError('Выберите резюме для отклика.')
      return
    }

    if (coverLetter.length > MAX_COVER_LETTER_LENGTH) {
      setActionError('Сопроводительное письмо должно быть не длиннее 1000 символов.')
      return
    }

    await applyMutation.mutateAsync({
      vacancy_id: Number(vacancyId),
      resume_id: selectedResumeId,
      cover_letter: coverLetter.trim() || null,
    })
  }

  if (!vacancyId) {
    return (
      <div className="vacancy-detail-page">
        <Header />
        <main className="vacancy-detail-page__state">Некорректный id вакансии.</main>
        <Footer />
      </div>
    )
  }

  if (vacancyQuery.isLoading) {
    return (
      <div className="vacancy-detail-page">
        <Header />
        <main className="vacancy-detail-page__state">Загружаем карточку вакансии...</main>
        <Footer />
      </div>
    )
  }

  if (vacancyQuery.isError || !vacancy) {
    return (
      <div className="vacancy-detail-page">
        <Header />
        <main className="vacancy-detail-page__state vacancy-detail-page__state--error">
          Не удалось загрузить карточку вакансии.
        </main>
        <Footer />
      </div>
    )
  }

  const vacancyCurrency = vacancy.currency || 'BYN'
  const skills = Array.isArray(vacancy.skills) ? vacancy.skills : []

  const isApplicationChecking =
    isAuthenticated &&
    isApplicant &&
    !hasEffectiveApplication &&
    (currentApplicationQuery.isLoading || currentApplicationQuery.isFetching)

  const applyButtonText =
    applyMutation.isPending || isApplicationChecking ? 'Проверяем...' : applicationUi.text

  const isApplyDisabled = applyMutation.isPending || isApplicationChecking || hasEffectiveApplication

  const applyButtonClassName = `btn btn--large vacancy-detail-apply-btn ${
    hasEffectiveApplication ? applicationUi.className : 'is-cta'
  }`

  return (
    <div className="vacancy-detail-page">
      <Header />

      <main className="vacancy-detail-page__main">
        <section className="vacancy-detail-hero">
          <div className="container">
            <div className="vacancy-detail-hero__card">
              <div className="vacancy-detail-hero__breadcrumbs">
                <Link to="/vacancies">Вакансии</Link>
                <span>•</span>
                <span>{vacancy.profession_name}</span>
              </div>

              <div className="vacancy-detail-hero__top">
                <div className="vacancy-detail-hero__main">
                  <h1 className="vacancy-detail-hero__title">{vacancy.title}</h1>

                  {companyId ? (
                    <Link
                      to={companyHref}
                      className="vacancy-detail-hero__company vacancy-detail-hero__company--link"
                    >
                      {vacancy.company_name}
                    </Link>
                  ) : (
                    <div className="vacancy-detail-hero__company">{vacancy.company_name}</div>
                  )}

                  <div className="vacancy-detail-hero__location">{vacancy.city_name}</div>
                </div>

                <div className="vacancy-detail-hero__salary-box">
                  <strong className="vacancy-detail-hero__salary-value">
                    {formatSalary(vacancy.salary_min, vacancy.salary_max, vacancyCurrency)}
                  </strong>
                </div>
              </div>

              <div className="vacancy-detail-hero__meta">
                <span className="vacancy-detail-pill">{vacancy.profession_name}</span>
                <span className="vacancy-detail-pill">{vacancy.employment_type}</span>
                <span className="vacancy-detail-pill">{vacancy.work_schedule}</span>
                <span className="vacancy-detail-pill">{vacancy.experience}</span>
              </div>

              <div className="vacancy-detail-hero__actions">
                <button
                  type="button"
                  className={applyButtonClassName}
                  onClick={handleOpenApplyModal}
                  disabled={isApplyDisabled}
                >
                  {applyButtonText}
                </button>

                {hasEffectiveApplication && applicationUi.note ? (
                  <p className="vacancy-detail-status-note">{applicationUi.note}</p>
                ) : null}

                {actionMessage ? (
                  <p className="vacancy-detail-status-note vacancy-detail-status-note--success">
                    {actionMessage}
                  </p>
                ) : null}

                {actionError && !isApplyModalOpen ? (
                  <p className="vacancy-detail-status-note vacancy-detail-status-note--error">
                    {actionError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="vacancy-detail-content">
          <div className="container">
            <div className="vacancy-detail-layout">
              <section className="vacancy-detail-main">
                <article className="vacancy-detail-card">
                  <div className="vacancy-detail-card__header">
                    <h2>Описание вакансии</h2>
                  </div>

                  <div className="vacancy-detail-card__body">
                    <p className="vacancy-detail-description">{vacancy.description}</p>
                  </div>
                </article>

                <article className="vacancy-detail-card">
                  <div className="vacancy-detail-card__header">
                    <h2>Ключевые навыки</h2>
                  </div>

                  <div className="vacancy-detail-card__body">
                    <div className="vacancy-detail-skills">
                      {skills.length === 0 ? (
                        <span className="vacancy-detail-skill">Не указаны</span>
                      ) : null}

                      {skills.map((skill) => (
                        <span key={skill} className="vacancy-detail-skill">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>

                {relatedVacancies.length > 0 ? (
                  <article className="vacancy-detail-card">
                    <div className="vacancy-detail-card__header">
                      <h2>Похожие вакансии</h2>
                    </div>

                    <div className="vacancy-related-list">
                      {relatedVacancies.map((item) => (
                        <Link
                          key={item.id}
                          to={`/vacancies/${item.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="vacancy-related-item"
                        >
                          <div className="vacancy-related-item__title">{item.title}</div>

                          <div className="vacancy-related-item__salary">
                            {formatSalary(
                              item.salary_min,
                              item.salary_max,
                              item.currency || vacancyCurrency,
                            )}
                          </div>

                          <div className="vacancy-related-item__company">{item.company_name}</div>
                        </Link>
                      ))}
                    </div>
                  </article>
                ) : null}
              </section>

              <aside className="vacancy-detail-sidebar">
                <section className="vacancy-detail-card vacancy-company-card">
                  {companyId ? (
                    <Link
                      to={companyHref}
                      className="vacancy-company-card__head vacancy-company-card__head--link"
                    >
                      {companyInfo.logo ? (
                        <img
                          src={companyInfo.logo}
                          alt={companyInfo.name}
                          className="vacancy-company-card__logo"
                        />
                      ) : (
                        <div className="vacancy-company-card__logo vacancy-company-card__logo--placeholder">
                          {companyInfo.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      <div className="vacancy-company-card__head-text">
                        <h3>{companyInfo.name}</h3>
                        <p>Открыть карточку компании</p>
                      </div>
                    </Link>
                  ) : (
                    <div className="vacancy-company-card__head">
                      {companyInfo.logo ? (
                        <img
                          src={companyInfo.logo}
                          alt={companyInfo.name}
                          className="vacancy-company-card__logo"
                        />
                      ) : (
                        <div className="vacancy-company-card__logo vacancy-company-card__logo--placeholder">
                          {companyInfo.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      <div className="vacancy-company-card__head-text">
                        <h3>{companyInfo.name}</h3>
                        <p>Информация о компании</p>
                      </div>
                    </div>
                  )}

                  {companyInfo.description ? (
                    <p className="vacancy-company-card__description">{companyInfo.description}</p>
                  ) : null}

                  {companyOfficeNames.length > 0 ? (
                    <div className="vacancy-company-card__offices-block">
                      <div className="vacancy-company-card__offices-title">Города присутствия</div>

                      <div className="vacancy-company-card__offices">
                        {visibleCompanyOfficeNames.map((cityName) => (
                          <span key={cityName} className="vacancy-company-card__office-chip">
                            {cityName}
                          </span>
                        ))}

                        {hiddenCompanyOfficeCount > 0 ? (
                          <span className="vacancy-company-card__office-chip vacancy-company-card__office-chip--more">
                            +{hiddenCompanyOfficeCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <ul className="vacancy-company-card__list">
                    {companyInfo.foundedYear ? (
                      <li>
                        <span>Год основания</span>
                        <strong>{companyInfo.foundedYear}</strong>
                      </li>
                    ) : null}

                    {companyInfo.employeeCount ? (
                      <li>
                        <span>Сотрудников</span>
                        <strong>{formatEmployeeCount(companyInfo.employeeCount)}</strong>
                      </li>
                    ) : null}

                    {companyInfo.website ? (
                      <li>
                        <span>Сайт</span>
                        <a href={companyInfo.website} target="_blank" rel="noreferrer">
                          Перейти
                        </a>
                      </li>
                    ) : null}
                  </ul>

                  {companyId ? (
                    <Link to={companyHref} className="vacancy-company-card__open-link">
                      Перейти к компании
                    </Link>
                  ) : null}
                </section>
              </aside>
            </div>
          </div>
        </section>
      </main>

      {isApplyModalOpen ? (
        <div className="apply-modal-overlay" onMouseDown={handleCloseApplyModal}>
          <section
            className="apply-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="apply-modal__header">
              <div>
                <p className="apply-modal__eyebrow">Отклик на вакансию</p>
                <h2 id="apply-modal-title">{vacancy.title}</h2>
                <p>{vacancy.company_name}</p>
              </div>

              <button
                type="button"
                className="apply-modal__close"
                onClick={handleCloseApplyModal}
                disabled={applyMutation.isPending}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            {myResumesQuery.isLoading ? (
              <div className="apply-modal__state">Загружаем ваши резюме...</div>
            ) : null}

            {myResumesQuery.isError ? (
              <div className="apply-modal__error">Не удалось загрузить резюме.</div>
            ) : null}

            {!myResumesQuery.isLoading && !myResumesQuery.isError && resumes.length === 0 ? (
              <div className="apply-modal__empty">
                <h3>У вас пока нет резюме</h3>
                <p>Создайте резюме, чтобы откликнуться на вакансию.</p>

                <button
                  type="button"
                  className="apply-modal__primary"
                  onClick={() => navigate('/applicant/resume/create')}
                >
                  Создать резюме
                </button>
              </div>
            ) : null}

            {resumes.length > 0 ? (
              <>
                <div className="apply-modal__section">
                  <div className="apply-modal__section-head apply-modal__section-head--resumes">
                    <div>
                      <h3>Выберите резюме</h3>
                      <p>
                        Показано {visibleResumeStart}–{visibleResumeEnd} из {resumes.length}
                      </p>
                    </div>

                    {resumeTotalPages > 1 ? (
                      <div className="apply-resume-pagination">
                        <button
                          type="button"
                          onClick={() => setResumePage((page) => Math.max(page - 1, 1))}
                          disabled={resumePage === 1}
                          aria-label="Предыдущая страница резюме"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M15 6L9 12L15 18" />
                          </svg>
                        </button>

                        <span>
                          {resumePage}/{resumeTotalPages}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setResumePage((page) => Math.min(page + 1, resumeTotalPages))
                          }
                          disabled={resumePage === resumeTotalPages}
                          aria-label="Следующая страница резюме"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9 6L15 12L9 18" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="apply-resume-list">
                    {paginatedResumes.map((resume) => (
                      <button
                        key={resume.id}
                        type="button"
                        className={`apply-resume-card ${
                          selectedResumeId === resume.id ? 'is-selected' : ''
                        }`}
                        onClick={() => setSelectedResumeId(resume.id)}
                      >
                        <span className="apply-resume-card__title">{getResumeTitle(resume)}</span>

                        {resume.updated_at || resume.created_at ? (
                          <span className="apply-resume-card__meta">
                            Обновлено: {formatDate(resume.updated_at || resume.created_at)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="apply-modal__section">
                  <div className="apply-modal__section-head">
                    <h3>Сопроводительное письмо</h3>
                    <span>
                      {coverLetter.length}/{MAX_COVER_LETTER_LENGTH}
                    </span>
                  </div>

                  <textarea
                    className="apply-cover-letter"
                    value={coverLetter}
                    maxLength={MAX_COVER_LETTER_LENGTH}
                    onChange={(event) => setCoverLetter(event.target.value)}
                    placeholder="Можно оставить пустым. Например: Здравствуйте! Меня заинтересовала ваша вакансия, готов обсудить опыт и условия."
                  />
                </div>

                {actionError ? <div className="apply-modal__error">{actionError}</div> : null}

                <div className="apply-modal__footer">
                  <button
                    type="button"
                    className="apply-modal__secondary"
                    onClick={handleCloseApplyModal}
                    disabled={applyMutation.isPending}
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    className="apply-modal__primary"
                    onClick={handleSubmitApplication}
                    disabled={applyMutation.isPending || !selectedResumeId}
                  >
                    {applyMutation.isPending
                      ? 'Отправляем...'
                      : selectedResume
                        ? `Откликнуться с «${getResumeTitle(selectedResume)}»`
                        : 'Откликнуться'}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      <Footer />
    </div>
  )
}