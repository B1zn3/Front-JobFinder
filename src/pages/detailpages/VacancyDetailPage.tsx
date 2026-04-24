import axios from 'axios'
import { useMemo, useState } from 'react'
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

type ApplicationItem = {
  vacancy_id: number
  resume_id: number
  status: 'pending' | 'review' | 'sent' | 'accepted' | 'rejected' | string
  created_at?: string | null
  updated_at?: string | null
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

const normalizeApplications = (data: unknown): ApplicationItem[] => {
  if (Array.isArray(data)) {
    return data as ApplicationItem[]
  }

  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
    return (data as { items: ApplicationItem[] }).items
  }

  return []
}

const fetchMyApplications = async (): Promise<ApplicationItem[]> => {
  const { data } = await http.get('/applicants/me/applications', {
    params: { skip: 0, limit: 200 },
  })

  return normalizeApplications(data)
}

const createApplication = async (vacancyId: number): Promise<ApplicationItem> => {
  const { data } = await http.post('/applicants/me/applications', {
    vacancy_id: vacancyId,
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
    if (min === max) {
      return `${min.toLocaleString('ru-RU')} ${currency}`
    }
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currency}`
  }

  if (min) {
    return `от ${min.toLocaleString('ru-RU')} ${currency}`
  }

  if (max) {
    return `до ${max.toLocaleString('ru-RU')} ${currency}`
  }

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



const getApplicationUi = (status?: string | null) => {
  switch (status) {
    case 'accepted':
      return {
        text: 'Вас пригласили',
        note: 'Работодатель принял ваш отклик.',
        className: 'is-state-accepted',
      }

    case 'rejected':
      return {
        text: 'Получен отказ',
        note: 'По этому отклику пришёл отказ.',
        className: 'is-state-rejected',
      }

    case 'pending':
    case 'review':
    case 'sent':
      return {
        text: 'Отклик отправлен',
        note: 'Ваш отклик уже отправлен и находится на рассмотрении.',
        className: 'is-state-pending',
      }

    default:
      return {
        text: 'Откликнуться',
        note: '',
        className: '',
      }
  }
}

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }

    if (Array.isArray(detail)) {
      const text = detail
        .map((item) => (typeof item?.msg === 'string' ? item.msg : ''))
        .filter(Boolean)
        .join('; ')

      if (text) return text
    }
  }

  return 'Не удалось отправить отклик.'
}

export const VacancyDetailPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { vacancyId } = useParams<{ vacancyId: string }>()

  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const accessToken =
    authSession.getAccessToken?.() ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token')

  const role =
    authSession.getRole?.() ||
    localStorage.getItem('role')

  const isAuthenticated = Boolean(accessToken)
  const isApplicant = role === 'applicant'

  const vacancyQuery = useQuery({
    queryKey: ['vacancy-detail', vacancyId],
    queryFn: () => fetchVacancy(vacancyId as string),
    enabled: Boolean(vacancyId),
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
    refetchOnWindowFocus: false,
  })

  const myApplicationsQuery = useQuery({
    queryKey: ['applicant-my-applications'],
    queryFn: fetchMyApplications,
    enabled: Boolean(vacancyId) && isAuthenticated && isApplicant,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applyMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: async () => {
      setActionError('')
      setActionMessage('Отклик успешно отправлен.')
      await queryClient.invalidateQueries({ queryKey: ['applicant-my-applications'] })
    },
    onError: async (error) => {
      const message = getErrorMessage(error)
      setActionMessage('')
      setActionError(message)

      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 409 || message.toLowerCase().includes('уже отклик'))
      ) {
        await queryClient.invalidateQueries({ queryKey: ['applicant-my-applications'] })
      }
    },
  })

  const relatedVacancies = useMemo(() => {
    if (!relatedQuery.data) return []
    return relatedQuery.data.filter((item) => item.id !== Number(vacancyId)).slice(0, 3)
  }, [relatedQuery.data, vacancyId])

  const existingApplication = useMemo(() => {
    if (!myApplicationsQuery.data || !vacancyId) return null

    return (
      myApplicationsQuery.data.find(
        (item) => Number(item.vacancy_id) === Number(vacancyId),
      ) || null
    )
  }, [myApplicationsQuery.data, vacancyId])

  const applicationUi = getApplicationUi(existingApplication?.status)

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

  const handleApply = async () => {
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

    if (existingApplication) {
      return
    }

    await applyMutation.mutateAsync(Number(vacancyId))
  }

  if (!vacancyId) {
    return <main style={{ padding: 24 }}>Некорректный id вакансии.</main>
  }

  if (vacancyQuery.isLoading) {
    return <main style={{ padding: 24 }}>Загружаем карточку вакансии...</main>
  }

  if (vacancyQuery.isError || !vacancy) {
    return <main style={{ padding: 24 }}>Не удалось загрузить карточку вакансии.</main>
  }

  const vacancyCurrency = vacancy.currency || 'BYN'
  const skills = Array.isArray(vacancy.skills) ? vacancy.skills : []

  const applyButtonText =
    applyMutation.isPending || (isAuthenticated && isApplicant && myApplicationsQuery.isLoading)
      ? 'Проверяем...'
      : applicationUi.text

  const isApplyDisabled =
    applyMutation.isPending ||
    (isAuthenticated && isApplicant && myApplicationsQuery.isLoading) ||
    Boolean(existingApplication)

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
                  className={`btn btn--large vacancy-detail-apply-btn ${applicationUi.className}`}
                  onClick={handleApply}
                  disabled={isApplyDisabled}
                >
                  {applyButtonText}
                </button>

                {existingApplication ? (
                  <p className="vacancy-detail-status-note">{applicationUi.note}</p>
                ) : null}

                {actionMessage ? (
                  <p className="vacancy-detail-status-note vacancy-detail-status-note--success">
                    {actionMessage}
                  </p>
                ) : null}

                {actionError ? (
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
                      {skills.length === 0 && (
                        <span className="vacancy-detail-skill">Не указаны</span>
                      )}

                      {skills.map((skill) => (
                        <span key={skill} className="vacancy-detail-skill">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>

                {relatedVacancies.length > 0 && (
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
                )}
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

                  {companyInfo.description && (
                    <p className="vacancy-company-card__description">
                      {companyInfo.description}
                    </p>
                  )}

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

      <Footer />
    </div>
  )
}